from __future__ import annotations

from fastapi import Request

from app.services.inference_service import InferenceService


def get_inference_service(request: Request) -> InferenceService:
    return request.app.state.inference


def get_request_id(request: Request) -> str:
    return request.scope["state"]["request_id"]
