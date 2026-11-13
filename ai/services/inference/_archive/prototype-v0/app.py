"""Private AgriSmart inference service. No farmer data, database or public CORS."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from functools import partial
import hmac
from io import BytesIO
import os
from pathlib import Path
import sys
import threading
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

MODEL_DIR = Path(__file__).resolve().parents[2] / "models" / "agrismart-india"
sys.path.insert(0, str(MODEL_DIR))
from predict import IndiaPredictor, MAX_BYTES, MANIFEST


def build_predictor():
    import torch
    from PIL import Image
    threads = int(os.environ.get("AI_INFERENCE_THREADS", "4"))
    if not 1 <= threads <= 16:
        raise ValueError("AI_INFERENCE_THREADS_INVALID")
    torch.set_num_threads(threads)
    configured = os.environ.get("AGRISMART_MODEL_PATH")
    predictor = IndiaPredictor(Path(configured) if configured else None)
    sample = BytesIO()
    Image.new("RGB", (224, 224)).save(sample, format="JPEG")
    predictor.predict(sample.getvalue(), top_k=1)
    return predictor


def error(code: str, status: int, request_id: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": code.replace("_", " ").capitalize(),
                                    "requestId": request_id}}, status_code=status)


class BodyLimitExceeded(Exception):
    pass


class PrivateBoundary:
    """Authenticate before multipart parsing; cap the actual streamed body."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request_id = str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        if scope["path"] not in {"/health", "/ready"}:
            headers = dict(scope.get("headers", []))
            expected = os.environ.get("AI_SERVICE_TOKEN", "")
            supplied = headers.get(b"authorization", b"")
            if not expected or not hmac.compare_digest(supplied, f"Bearer {expected}".encode()):
                return await error("UNAUTHORIZED", 401, request_id)(scope, receive, send)
        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            consumed += len(message.get("body", b""))
            if consumed > MAX_BYTES + 65536:
                raise BodyLimitExceeded()
            return message

        try:
            await self.app(scope, bounded_receive, send)
        except BodyLimitExceeded:
            await error("IMAGE_SIZE_INVALID", 413, request_id)(scope, receive, send)


def create_app(predictor_factory=build_predictor) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application):
        token = os.environ.get("AI_SERVICE_TOKEN", "")
        if len(token) < 32:
            raise RuntimeError("AI_SERVICE_TOKEN must be configured with at least 32 characters")
        application.state.predictor = None
        application.state.capacity = threading.BoundedSemaphore(2)
        with ThreadPoolExecutor(max_workers=1, thread_name_prefix="agrismart") as executor:
            application.state.executor = executor
            try:
                application.state.predictor = await asyncio.get_running_loop().run_in_executor(
                    executor, predictor_factory)
            except (OSError, ValueError, RuntimeError, ImportError):
                application.state.predictor = None
            yield
            application.state.predictor = None

    service = FastAPI(title="Private AgriSmart India inference", version="1.0.0",
                      lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    service.add_middleware(PrivateBoundary)

    @service.get("/health")
    async def health():
        return {"status": "alive"}

    @service.get("/ready")
    async def ready():
        available = service.state.predictor is not None
        return JSONResponse({"ready": available, "mode": "real" if available else "unavailable"},
                            status_code=200 if available else 503)

    @service.get("/v1/model/metadata")
    async def metadata(request: Request):
        predictor = service.state.predictor
        if predictor is None:
            return error("MODEL_UNAVAILABLE", 503, request.state.request_id)
        return {"version": MANIFEST["release"], "sha256": predictor.sha256,
                "crops": list(predictor.crop_classes), "labels": predictor.labels,
                "cropCount": len(predictor.crop_classes), "classCount": len(predictor.labels)}

    @service.post("/v1/predict")
    async def predict_image(request: Request):
        request_id = request.state.request_id
        predictor = service.state.predictor
        if predictor is None:
            return error("MODEL_UNAVAILABLE", 503, request_id)
        try:
            async with request.form(max_files=1, max_fields=2) as form:
                if set(form) - {"image", "crop", "top_k"}:
                    return error("INVALID_FIELDS", 422, request_id)
                image = form.get("image")
                if not isinstance(image, UploadFile):
                    return error("IMAGE_REQUIRED", 422, request_id)
                crop = form.get("crop") or None
                if crop is not None and not isinstance(crop, str):
                    return error("CROP_UNSUPPORTED", 422, request_id)
                top_k = int(str(form.get("top_k", "5")))
                if not 1 <= top_k <= 10:
                    return error("TOP_K_INVALID", 422, request_id)
                payload = await image.read(MAX_BYTES + 1)
            if len(payload) > MAX_BYTES:
                return error("IMAGE_SIZE_INVALID", 413, request_id)
            if not service.state.capacity.acquire(blocking=False):
                return error("INFERENCE_BUSY", 429, request_id)
            started = time.perf_counter()
            future = service.state.executor.submit(partial(predictor.predict, payload, crop, top_k))
            future.add_done_callback(lambda _: service.state.capacity.release())
            result = await asyncio.wait_for(asyncio.shield(asyncio.wrap_future(future)), timeout=60)
            result.update(schemaVersion="1", requestId=request_id, severity=None,
                          processingMs=round((time.perf_counter() - started) * 1000),
                          quality={"status": "NOT_AGRONOMICALLY_VALIDATED", "warnings": []})
            result["model"]["taxonomyVersion"] = predictor.sha256
            return result
        except BodyLimitExceeded:
            return error("IMAGE_SIZE_INVALID", 413, request_id)
        except StarletteHTTPException:
            return error("INVALID_MULTIPART", 400, request_id)
        except ValueError as exc:
            code = str(exc) if str(exc).isupper() and " " not in str(exc) else "INVALID_REQUEST"
            status = 415 if code == "IMAGE_FORMAT_UNSUPPORTED" else 422
            return error(code, status, request_id)
        except asyncio.TimeoutError:
            return error("INFERENCE_TIMEOUT", 504, request_id)
        except Exception:
            return error("INFERENCE_FAILED", 500, request_id)

    return service


app = create_app()
