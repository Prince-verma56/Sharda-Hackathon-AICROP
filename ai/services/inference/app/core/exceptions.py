"""Stable error codes returned to the Next.js server. Never include stack traces or paths."""
from __future__ import annotations

ERROR_STATUS = {
    "UNAUTHORIZED": 401,
    "INVALID_MULTIPART": 400,
    "INVALID_FIELDS": 422,
    "IMAGE_REQUIRED": 422,
    "IMAGE_SIZE_INVALID": 413,
    "IMAGE_PIXEL_LIMIT": 413,
    "IMAGE_FORMAT_UNSUPPORTED": 415,
    "IMAGE_INVALID": 422,
    "IMAGE_DIMENSIONS_OR_ANIMATION_INVALID": 422,
    "CROP_UNSUPPORTED": 422,
    "TOP_K_INVALID": 422,
    "INFERENCE_BUSY": 429,
    "MODEL_LOADING": 503,
    "MODEL_UNAVAILABLE": 503,
    "INFERENCE_TIMEOUT": 504,
    "INFERENCE_FAILED": 500,
}

ERROR_MESSAGE = {
    "UNAUTHORIZED": "Missing or invalid service credential.",
    "INVALID_MULTIPART": "The request body is not valid multipart form data.",
    "INVALID_FIELDS": "Only 'image', 'crop' and 'top_k' fields are accepted.",
    "IMAGE_REQUIRED": "An image file is required in the 'image' field.",
    "IMAGE_SIZE_INVALID": "The image is empty or larger than 8 MiB.",
    "IMAGE_PIXEL_LIMIT": "The image has more than 20 megapixels.",
    "IMAGE_FORMAT_UNSUPPORTED": "Only JPEG, PNG and WebP images are supported.",
    "IMAGE_INVALID": "The file could not be decoded as an image.",
    "IMAGE_DIMENSIONS_OR_ANIMATION_INVALID": "The image must be a single frame at least 64 px on each side.",
    "CROP_UNSUPPORTED": "The selected crop is not supported by this model.",
    "TOP_K_INVALID": "top_k must be an integer between 1 and 10.",
    "INFERENCE_BUSY": "The model is busy with other requests. Retry shortly.",
    "MODEL_LOADING": "The model is still loading. Retry shortly.",
    "MODEL_UNAVAILABLE": "The model is not available.",
    "INFERENCE_TIMEOUT": "Inference did not finish within the deadline.",
    "INFERENCE_FAILED": "Inference failed unexpectedly.",
}


class InferenceError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code if code in ERROR_STATUS else "INFERENCE_FAILED"

    @property
    def status(self) -> int:
        return ERROR_STATUS[self.code]

    @property
    def message(self) -> str:
        return ERROR_MESSAGE[self.code]


def error_body(code: str, request_id: str) -> dict:
    return {"success": False,
            "error": {"code": code, "message": ERROR_MESSAGE.get(code, code), "request_id": request_id}}
