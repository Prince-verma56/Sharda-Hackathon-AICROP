from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import InferenceError
from app.dependencies import get_inference_service, get_request_id
from app.schemas.diagnosis import DiagnosisResponse, ErrorResponse
from app.services.inference_service import InferenceService

router = APIRouter(prefix="/v1", tags=["diagnosis"])

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_FIELDS = {"image", "crop", "top_k"}


@router.post(
    "/predict",
    response_model=DiagnosisResponse,
    response_model_by_alias=True,
    responses={code: {"model": ErrorResponse} for code in (400, 401, 413, 415, 422, 429, 503, 504)},
    summary="Classify a leaf photo with AgriSmart India v1",
    description=("Multipart form: `image` (JPEG/PNG/WebP, <= 8 MiB), optional `crop` "
                 "(an id from /v1/crops) and optional `top_k` (1-10, default 5)."),
    openapi_extra={"requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {
        "type": "object", "required": ["image"], "properties": {
            "image": {"type": "string", "format": "binary"},
            "crop": {"type": "string", "example": "tomato"},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 10, "default": 5}}}}}}},
)
async def predict(request: Request, service: InferenceService = Depends(get_inference_service),
                  request_id: str = Depends(get_request_id)):
    # Fail fast before reading the body when the model cannot serve.
    service.require_model()
    try:
        async with request.form(max_files=1, max_fields=2) as form:
            if set(form) - ALLOWED_FIELDS:
                raise InferenceError("INVALID_FIELDS")
            image = form.get("image")
            if not isinstance(image, UploadFile):
                raise InferenceError("IMAGE_REQUIRED")
            crop = form.get("crop") or None
            if crop is not None and not isinstance(crop, str):
                raise InferenceError("CROP_UNSUPPORTED")
            raw_top_k = form.get("top_k") or "5"
            if not isinstance(raw_top_k, str) or not raw_top_k.strip().isdigit():
                raise InferenceError("TOP_K_INVALID")
            top_k = int(raw_top_k)
            payload = await image.read(MAX_UPLOAD_BYTES + 1)
    except StarletteHTTPException:
        raise InferenceError("INVALID_MULTIPART") from None
    if not payload or len(payload) > MAX_UPLOAD_BYTES:
        raise InferenceError("IMAGE_SIZE_INVALID")
    crop = crop.strip().lower() if crop else None
    return await service.predict(payload, crop, top_k, request_id)
