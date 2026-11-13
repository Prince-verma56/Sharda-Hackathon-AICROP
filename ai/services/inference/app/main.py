"""AgriSmart private inference service (FastAPI).

Run from ai/services/inference:
    uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1

Owns model inference only. Farmers, auth, history and persistence belong to the
Next.js application backend, which is the only intended caller.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import hmac
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import crops, diagnosis, health
from app.config import Settings, get_settings
from app.core.exceptions import InferenceError, error_body
from app.core.model_loader import load_model
from app.services.inference_service import InferenceService

PUBLIC_PATHS = {"/health", "/ready", "/docs", "/docs/oauth2-redirect", "/openapi.json"}
BODY_LIMIT = 8 * 1024 * 1024 + 64 * 1024  # max image + multipart overhead


class _BodyLimitExceeded(Exception):
    pass


class PrivateBoundary:
    """Assign a request id, authenticate before multipart parsing, cap streamed body size."""

    def __init__(self, app, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        supplied_id = headers.get(b"x-request-id", b"").decode("latin-1")
        request_id = supplied_id if 8 <= len(supplied_id) <= 64 and supplied_id.isascii() else str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        if scope["path"] not in PUBLIC_PATHS:
            expected = f"Bearer {self.settings.ai_service_token}".encode()
            if not hmac.compare_digest(headers.get(b"authorization", b""), expected):
                response = JSONResponse(error_body("UNAUTHORIZED", request_id), status_code=401)
                return await response(scope, receive, send)

        consumed = 0

        async def bounded_receive():
            nonlocal consumed
            message = await receive()
            consumed += len(message.get("body", b""))
            if consumed > BODY_LIMIT:
                raise _BodyLimitExceeded()
            return message

        try:
            await self.app(scope, bounded_receive, send)
        except _BodyLimitExceeded:
            response = JSONResponse(error_body("IMAGE_SIZE_INVALID", request_id), status_code=413)
            await response(scope, receive, send)


def create_app(settings: Settings | None = None, loader=load_model) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper(),
                        format="%(asctime)s %(levelname)s %(name)s %(message)s")

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        if len(settings.ai_service_token) < 32:
            raise RuntimeError("AI_SERVICE_TOKEN must be set to at least 32 characters")
        service = InferenceService(settings, loader)
        application.state.inference = service
        # Load in the background so /health can report "loading" instead of refusing connections.
        task = asyncio.create_task(service.start())
        try:
            yield
        finally:
            task.cancel()
            service.shutdown()

    application = FastAPI(
        title="AgriSmart India inference service",
        version="1.0.0",
        description=("Private crop disease classifier (AgriSmart India v1, DINOv2 ViT-B/14, 59 crops, "
                     "387 classes). Scores are model outputs, not calibrated diagnostic certainty. "
                     "Authorize with `Bearer <AI_SERVICE_TOKEN>`."),
        lifespan=lifespan,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )
    application.add_middleware(PrivateBoundary, settings=settings)

    @application.exception_handler(InferenceError)
    async def _inference_error(request: Request, exc: InferenceError):
        return JSONResponse(error_body(exc.code, request.scope["state"]["request_id"]), status_code=exc.status)

    @application.exception_handler(_BodyLimitExceeded)
    async def _body_limit(request: Request, exc: _BodyLimitExceeded):
        return JSONResponse(error_body("IMAGE_SIZE_INVALID", request.scope["state"]["request_id"]),
                            status_code=413)

    @application.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        return JSONResponse(error_body("INVALID_FIELDS", request.scope["state"]["request_id"]), status_code=422)

    @application.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        logging.getLogger("agrismart").exception("Unhandled error")
        return JSONResponse(error_body("INFERENCE_FAILED", request.scope["state"]["request_id"]), status_code=500)

    application.include_router(health.router)
    application.include_router(crops.router)
    application.include_router(diagnosis.router)

    if settings.enable_docs:
        from fastapi.openapi.utils import get_openapi

        def openapi():
            if application.openapi_schema is None:
                schema = get_openapi(title=application.title, version=application.version,
                                     description=application.description, routes=application.routes)
                schema.setdefault("components", {})["securitySchemes"] = {
                    "bearer": {"type": "http", "scheme": "bearer"}}
                schema["security"] = [{"bearer": []}]
                application.openapi_schema = schema
            return application.openapi_schema

        application.openapi = openapi
    return application


app = create_app()
