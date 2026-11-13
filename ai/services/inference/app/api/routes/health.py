from __future__ import annotations

import time

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.dependencies import get_inference_service
from app.schemas.health import HealthResponse
from app.services.inference_service import InferenceService

router = APIRouter(tags=["health"])


def _health(service: InferenceService) -> dict:
    model = service.model
    return {
        "status": {"ready": "healthy", "loading": "loading"}.get(service.state, "degraded"),
        "model_loaded": model is not None,
        "model_state": service.state,
        "model_version": model.version if model else None,
        "model_sha256": model.predictor.sha256 if model else None,
        "device": model.device if model else None,
        "mode": "real" if model else "unavailable",
        "error_code": service.error_code,
        "load_ms": model.load_ms if model else None,
        "uptime_s": round(time.time() - service.started_at),
        "requests_served": service.requests_served,
    }


@router.get("/health", response_model=HealthResponse,
            summary="Service and model status (always 200 while the process is alive)")
async def health(service: InferenceService = Depends(get_inference_service)):
    return _health(service)


@router.get("/ready", response_model=HealthResponse, responses={503: {"model": HealthResponse}},
            summary="Readiness probe: 200 only when the real model is loaded")
async def ready(service: InferenceService = Depends(get_inference_service)):
    body = _health(service)
    return JSONResponse(body, status_code=200 if body["model_loaded"] else 503)
