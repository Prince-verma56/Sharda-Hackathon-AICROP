"""Original strict adapter for the AgriSmart India v1 checkpoint.

Inference mathematics follow the documented upstream interface; no upstream source
is vendored. This is preparation code, pending dependency and field validation.
"""
from __future__ import annotations

import argparse
from io import BytesIO
import json
from pathlib import Path
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from scripts.download_weights import MANIFEST, MODEL_DIR, verify_checkpoint

MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 20_000_000


def decode_image(data: bytes) -> Image.Image:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("IMAGE_SIZE_INVALID")
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(BytesIO(data)) as original:
                if original.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("IMAGE_FORMAT_UNSUPPORTED")
                if original.width * original.height > MAX_PIXELS:
                    raise ValueError("IMAGE_PIXEL_LIMIT")
                if min(original.size) < 64 or getattr(original, "n_frames", 1) != 1:
                    raise ValueError("IMAGE_DIMENSIONS_OR_ANIMATION_INVALID")
                original.load()
                rgb = ImageOps.exif_transpose(original).convert("RGB")
                # Copy pixel data into a metadata-free image; never retain EXIF/GPS.
                return Image.frombytes("RGB", rgb.size, rgb.tobytes())
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
                Image.DecompressionBombWarning) as exc:
            raise ValueError("IMAGE_INVALID") from exc


def validate_taxonomy(labels: list[str], crop_classes: dict[str, list[int]]) -> None:
    if len(labels) != 387 or len(set(labels)) != 387 or len(crop_classes) != 59:
        raise ValueError("MODEL_TAXONOMY_MISMATCH")
    indices = []
    for crop, members in crop_classes.items():
        if not members:
            raise ValueError("MODEL_TAXONOMY_MISMATCH")
        for index in members:
            if (type(index) is not int or not 0 <= index < len(labels)
                    or not labels[index].startswith(crop + "::")):
                raise ValueError("MODEL_TAXONOMY_MISMATCH")
        indices.extend(members)
    if sorted(indices) != list(range(387)):
        raise ValueError("MODEL_TAXONOMY_MISMATCH")


class IndiaPredictor:
    """Instantiate once in a bounded inference worker. Never loads pickle fallback."""

    def __init__(self, weights: Path | None = None, device: str = "cpu"):
        checkpoint = weights or MODEL_DIR / "checkpoints" / "model.pt"
        self.sha256 = verify_checkpoint(checkpoint)
        import torch
        import timm

        self.torch = torch
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device not in {"cpu", "cuda"} or (device == "cuda" and not torch.cuda.is_available()):
            raise ValueError("DEVICE_UNAVAILABLE")
        self.device = device
        package = torch.load(checkpoint, map_location="cpu", weights_only=True)
        if (package.get("backbone") != "vit_base_patch14_dinov2.lvd142m"
                or package.get("img_size") != 224):
            raise ValueError("MODEL_ARCHITECTURE_MISMATCH")
        self.labels = package["labels"]
        self.crop_classes = package["crop_classes"]
        validate_taxonomy(self.labels, self.crop_classes)
        self.model = timm.create_model(package["backbone"], pretrained=False,
                                       num_classes=387, img_size=224)
        self.model.load_state_dict(package["state_dict"], strict=True)
        self.model.to(self.device).eval()
        self.transform = timm.data.create_transform(
            input_size=224, interpolation="bicubic", mean=package["mean"],
            std=package["std"], crop_pct=0.9, is_training=False)

    def predict(self, image_bytes: bytes, crop: str | None = None, top_k: int = 5) -> dict:
        if crop is not None and crop not in self.crop_classes:
            raise ValueError("CROP_UNSUPPORTED")
        return self.predict_image(decode_image(image_bytes), crop, top_k)

    def predict_image(self, image: Image.Image, crop: str | None = None, top_k: int = 5) -> dict:
        """Predict on an RGB image already produced by decode_image()."""
        if crop is not None and crop not in self.crop_classes:
            raise ValueError("CROP_UNSUPPORTED")
        if type(top_k) is not int or not 1 <= top_k <= 10:
            raise ValueError("TOP_K_INVALID")
        torch = self.torch
        tensor = self.transform(image).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            first = torch.softmax(self.model(tensor), dim=1)
            mirror = torch.softmax(self.model(torch.flip(tensor, dims=[3])), dim=1)
            raw = ((first + mirror) / 2)[0].float().cpu().tolist()
        if any(not 0 <= score <= 1 for score in raw) or abs(sum(raw) - 1) > 1e-4:
            raise ValueError("MODEL_SCORES_INVALID")
        crop_scores = {key: sum(raw[i] for i in values)
                       for key, values in self.crop_classes.items()}
        allowed = self.crop_classes[crop] if crop else list(range(len(self.labels)))
        mass = sum(raw[i] for i in allowed)
        if mass <= 0:
            raise ValueError("CROP_SCORE_EMPTY")
        ranked = sorted(allowed, key=lambda i: raw[i], reverse=True)[:top_k]
        predictions = [{"label": self.labels[i], "rawScore": raw[i],
                        "score": raw[i] / mass} for i in ranked]
        global_index = max(range(len(raw)), key=raw.__getitem__)
        return {"mode": "real", "selectedCrop": crop, "predictions": predictions,
                "globalTop": {"label": self.labels[global_index], "rawScore": raw[global_index]},
                "cropScores": crop_scores, "selectedCropMass": crop_scores.get(crop),
                "scoreType": "crop_conditioned_softmax" if crop else "global_softmax",
                "uncertainty": {"status": "REVIEW_REQUIRED",
                                "reasons": ["FIELD_POLICY_NOT_VALIDATED", "NO_OOD_DETECTOR"]},
                "isLaboratoryConfirmed": False,
                "model": {"version": MANIFEST["release"], "sha256": self.sha256,
                          "preprocessing": "timm-bicubic-crop0.9-224-tta-mirror-v1"}}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--crop")
    parser.add_argument("--top", type=int, default=5)
    args = parser.parse_args()
    if not 0 < args.image.stat().st_size <= MAX_BYTES:
        raise ValueError("IMAGE_SIZE_INVALID")
    print(json.dumps(IndiaPredictor().predict(args.image.read_bytes(), args.crop, args.top), indent=2))
