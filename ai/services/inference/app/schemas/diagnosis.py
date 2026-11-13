from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class UpstreamClassMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    support: int


class UpstreamCropMetrics(BaseModel):
    test_images: int
    macro_f1: float
    accuracy: float


class Prediction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    label: str = Field(description="Checkpoint label, '<crop>::<condition>'")
    crop: str
    class_: str = Field(alias="class", description="Disease / condition name")
    score: float = Field(description="Softmax score, renormalised over the selected crop when one is given")
    raw_score: float = Field(description="Global softmax score over all 387 classes")
    is_healthy: bool
    upstream_metrics: UpstreamClassMetrics | None = None


class GlobalTop(BaseModel):
    label: str
    raw_score: float


class CropScore(BaseModel):
    crop: str
    score: float


class Advisory(BaseModel):
    code: str
    message: str
    basis: Literal["model_global_distribution", "upstream_evaluation", "heuristic"]


class Assessment(BaseModel):
    status: Literal["REVIEW_REQUIRED"]
    reasons: list[str]
    advisories: list[Advisory]


class QualityWarning(BaseModel):
    code: str
    message: str


class ImageQuality(BaseModel):
    status: Literal["ok", "warning"]
    method: Literal["heuristic"]
    width: int
    height: int
    brightness: float
    contrast: float
    sharpness: float
    warnings: list[QualityWarning]


class DiagnosisResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: Literal[True]
    request_id: str
    model: str
    model_version: str
    model_sha256: str
    inference_mode: Literal["real"]
    device: str
    crop: str | None
    crop_source: Literal["user", "model"]
    predicted_crop: str
    predicted_class: str
    predicted_label: str
    is_healthy: bool
    confidence: float
    margin: float = Field(description="Top-1 score minus top-2 score")
    global_top: GlobalTop = Field(description="Most likely class over all 387 classes, ignoring the crop hint")
    score_type: Literal["crop_conditioned_softmax", "global_softmax"]
    top_predictions: list[Prediction]
    crop_scores: list[CropScore] = Field(description="Top 5 crops by global probability mass")
    selected_crop_mass: float | None
    image_quality: ImageQuality
    assessment: Assessment
    is_laboratory_confirmed: Literal[False]
    preprocessing: str
    latency_ms: int
    inference_ms: int
    disclaimer: str


class CropClass(BaseModel):
    label: str
    name: str
    is_healthy: bool
    upstream_metrics: UpstreamClassMetrics | None = None


class Crop(BaseModel):
    id: str
    name: str
    class_count: int
    classes: list[CropClass]
    upstream_metrics: UpstreamCropMetrics | None = None


class CropsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    success: Literal[True]
    model_version: str
    crop_count: int
    class_count: int
    crops: list[Crop]


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    success: Literal[False]
    error: ErrorDetail
