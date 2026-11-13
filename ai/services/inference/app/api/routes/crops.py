from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_inference_service
from app.schemas.diagnosis import CropsResponse, ErrorResponse
from app.services.inference_service import InferenceService

router = APIRouter(prefix="/v1", tags=["catalogue"])


@router.get("/crops", response_model=CropsResponse, responses={503: {"model": ErrorResponse}},
            summary="Crops and disease/condition classes from the loaded checkpoint")
async def list_crops(service: InferenceService = Depends(get_inference_service)):
    crops = service.crops()
    return {"success": True, "model_version": service.model.version, "crop_count": len(crops),
            "class_count": sum(crop["class_count"] for crop in crops), "crops": crops}
