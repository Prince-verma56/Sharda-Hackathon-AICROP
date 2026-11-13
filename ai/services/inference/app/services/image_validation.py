"""Upload validation and photo-quality heuristics.

Hard validation (format, byte size, pixel count, dimensions, single frame, EXIF removal)
is delegated to decode_image() in the model package. Quality checks below are
*heuristic retake hints*: they never block inference and are not agronomic validation
or proof that the photo shows a plant.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageFilter

# Heuristic cut-offs, chosen for photographs viewed at 512 px on the short side.
# They are deliberately conservative and reported as warnings only.
DARK_MEAN = 40.0
BRIGHT_MEAN = 225.0
LOW_CONTRAST_STD = 18.0
# Local smoke photos: real PlantDoc leaves scored 59.8-595.6; a Gaussian-blurred copy scored 10.2.
BLUR_LAPLACIAN_VAR = 25.0
MIN_RECOMMENDED_SIDE = 224  # model input size; smaller photos are upscaled


@dataclass
class QualityReport:
    width: int
    height: int
    brightness: float
    contrast: float
    sharpness: float
    warnings: list[dict] = field(default_factory=list)

    @property
    def status(self) -> str:
        return "warning" if self.warnings else "ok"

    def as_dict(self) -> dict:
        return {"status": self.status, "method": "heuristic", "width": self.width,
                "height": self.height, "brightness": round(self.brightness, 1),
                "contrast": round(self.contrast, 1), "sharpness": round(self.sharpness, 1),
                "warnings": self.warnings}


def assess_quality(image: Image.Image) -> QualityReport:
    width, height = image.size
    scale = 512 / min(width, height)
    probe = image if scale >= 1 else image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.BILINEAR)
    gray = probe.convert("L")
    pixels = np.asarray(gray, dtype=np.float32)
    brightness = float(pixels.mean())
    contrast = float(pixels.std())
    # Variance of a Laplacian response: a standard, cheap focus measure.
    laplacian = gray.filter(ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1, offset=128))
    sharpness = float(np.asarray(laplacian, dtype=np.float32).var())

    report = QualityReport(width, height, brightness, contrast, sharpness)
    if min(width, height) < MIN_RECOMMENDED_SIDE:
        report.warnings.append({"code": "LOW_RESOLUTION",
                                "message": f"Photo is smaller than {MIN_RECOMMENDED_SIDE} px; details may be lost."})
    if brightness < DARK_MEAN:
        report.warnings.append({"code": "TOO_DARK", "message": "Photo looks very dark. Retake in daylight."})
    elif brightness > BRIGHT_MEAN:
        report.warnings.append({"code": "OVEREXPOSED", "message": "Photo looks overexposed. Avoid direct glare."})
    if contrast < LOW_CONTRAST_STD:
        report.warnings.append({"code": "LOW_CONTRAST", "message": "Photo has very little detail or contrast."})
    if sharpness < BLUR_LAPLACIAN_VAR:
        report.warnings.append({"code": "POSSIBLY_BLURRY",
                                "message": "Photo may be out of focus. Hold steady and tap to focus on the leaf."})
    return report
