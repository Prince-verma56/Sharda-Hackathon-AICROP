"""Owns the single model instance, its worker thread and request admission."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import threading
import time

from app.config import Settings
from app.core.exceptions import InferenceError
from app.core.model_loader import LoadedModel, load_model
from app.services.image_validation import assess_quality

log = logging.getLogger("agrismart.inference")

DISCLAIMER = ("Scores are outputs of an image classifier, not calibrated probabilities or a "
              "laboratory diagnosis. Confirm with a local agriculture officer before treatment.")
# Evidence threshold applied to the upstream held-out evaluation (report_per_crop.csv /
# report_per_class.csv). Below this, the class or crop was weak in the upstream test set.
UPSTREAM_WEAK_F1 = 0.80
# PROVISIONAL heuristic (not validated): the top *global* softmax score over 387 classes.
# Local smoke tests: real leaf photos 0.13-0.87, synthetic non-plant images 0.03-0.04.
# Only adds a warning; never changes or hides model output. Needs a labelled OOD set.
LOW_GLOBAL_EVIDENCE = 0.10


def split_label(label: str) -> tuple[str, str]:
    crop, _, condition = label.partition("::")
    return crop, condition


def is_healthy(label: str) -> bool:
    return split_label(label)[1].strip().lower() == "healthy"


def crop_display_name(crop: str) -> str:
    return crop.replace("_", " ").strip().capitalize()


class InferenceService:
    def __init__(self, settings: Settings, loader=load_model):
        self.settings = settings
        self._loader = loader
        self.state = "loading"  # loading | ready | failed
        self.error_code: str | None = None
        self.model: LoadedModel | None = None
        self.started_at = time.time()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="agrismart-model")
        self.capacity = threading.BoundedSemaphore(settings.max_in_flight)
        self.requests_served = 0

    # ---- lifecycle -------------------------------------------------------------------
    async def start(self) -> None:
        loop = asyncio.get_running_loop()
        try:
            self.model = await loop.run_in_executor(self.executor, self._loader, self.settings)
            self.state = "ready"
        except Exception as exc:  # report a code, never the path or traceback
            code = str(exc) if str(exc).isupper() and " " not in str(exc) else type(exc).__name__
            log.error("Model failed to load: %s", code, exc_info=True)
            self.state, self.error_code, self.model = "failed", code, None

    def shutdown(self) -> None:
        self.executor.shutdown(wait=False, cancel_futures=True)
        self.model = None

    def require_model(self) -> LoadedModel:
        if self.state == "loading":
            raise InferenceError("MODEL_LOADING")
        if self.model is None:
            raise InferenceError("MODEL_UNAVAILABLE")
        return self.model

    # ---- catalogue -------------------------------------------------------------------
    def crops(self) -> list[dict]:
        model = self.require_model()
        predictor, per_crop = model.predictor, model.reliability.get("per_crop", {})
        per_class = model.reliability.get("per_class", {})
        result = []
        for crop, indices in predictor.crop_classes.items():
            classes = []
            for index in indices:
                label = predictor.labels[index]
                classes.append({"label": label, "name": split_label(label)[1],
                                "is_healthy": is_healthy(label),
                                "upstream_metrics": per_class.get(label)})
            classes.sort(key=lambda item: (not item["is_healthy"], item["name"].lower()))
            result.append({"id": crop, "name": crop_display_name(crop), "class_count": len(classes),
                           "classes": classes, "upstream_metrics": per_crop.get(crop)})
        result.sort(key=lambda item: item["name"])
        return result

    # ---- prediction ------------------------------------------------------------------
    async def predict(self, payload: bytes, crop: str | None, top_k: int, request_id: str) -> dict:
        model = self.require_model()
        if crop is not None and crop not in model.predictor.crop_classes:
            raise InferenceError("CROP_UNSUPPORTED")
        if not 1 <= top_k <= 10:
            raise InferenceError("TOP_K_INVALID")
        if not self.capacity.acquire(blocking=False):
            raise InferenceError("INFERENCE_BUSY")
        started = time.perf_counter()
        future = self.executor.submit(self._run, model, payload, crop, top_k)
        # The slot is released when computation actually ends, even after a timeout.
        future.add_done_callback(lambda _: self.capacity.release())
        try:
            raw, quality, inference_ms = await asyncio.wait_for(
                asyncio.shield(asyncio.wrap_future(future)), timeout=self.settings.timeout_seconds)
        except asyncio.TimeoutError:
            raise InferenceError("INFERENCE_TIMEOUT") from None
        except ValueError as exc:
            raise InferenceError(str(exc)) from None
        latency_ms = round((time.perf_counter() - started) * 1000)
        self.requests_served += 1
        response = self._build_response(model, raw, quality, crop, request_id, latency_ms, inference_ms)
        log.info("request=%s crop=%s top=%s score=%.3f latency_ms=%d quality=%s",
                 request_id, crop or "-", response["predicted_label"], response["confidence"],
                 latency_ms, quality["status"])
        return response

    @staticmethod
    def _run(model: LoadedModel, payload: bytes, crop: str | None, top_k: int):
        image = model.module.decode_image(payload)  # raises ValueError codes
        quality = assess_quality(image).as_dict()
        started = time.perf_counter()
        raw = model.predictor.predict_image(image, crop, top_k)
        return raw, quality, round((time.perf_counter() - started) * 1000)

    def _build_response(self, model: LoadedModel, raw: dict, quality: dict, crop: str | None,
                        request_id: str, latency_ms: int, inference_ms: int) -> dict:
        per_crop = model.reliability.get("per_crop", {})
        per_class = model.reliability.get("per_class", {})
        top = []
        for item in raw["predictions"]:
            item_crop, condition = split_label(item["label"])
            top.append({"label": item["label"], "crop": item_crop, "class": condition,
                        "score": item["score"], "raw_score": item["rawScore"],
                        "is_healthy": is_healthy(item["label"]),
                        "upstream_metrics": per_class.get(item["label"])})
        best = top[0]
        crop_ranking = sorted(raw["cropScores"].items(), key=lambda kv: kv[1], reverse=True)
        model_crop = crop_ranking[0][0]

        advisories = []
        global_top = raw["globalTop"]["rawScore"]
        if global_top < LOW_GLOBAL_EVIDENCE:
            advisories.append({
                "code": "LOW_GLOBAL_EVIDENCE",
                "message": (f"No class has strong evidence (top global score {global_top:.0%}). The photo may "
                            "not show a supported crop leaf. Retake a close-up of one affected leaf."),
                "basis": "heuristic"})
        if crop is not None and model_crop != crop:
            advisories.append({
                "code": "CROP_MISMATCH",
                "message": (f"You selected {crop_display_name(crop)}, but without a crop hint the model "
                            f"sees this photo as most like {crop_display_name(model_crop)} "
                            f"({crop_ranking[0][1]:.0%} vs {raw['selectedCropMass']:.0%}). "
                            "Check the crop selection or retake the photo."),
                "basis": "model_global_distribution"})
        crop_metrics = per_crop.get(best["crop"])
        if crop_metrics and crop_metrics["macro_f1"] < UPSTREAM_WEAK_F1:
            advisories.append({
                "code": "WEAK_CROP_UPSTREAM",
                "message": (f"{crop_display_name(best['crop'])} was one of the weaker crops in the upstream "
                            f"test set (macro-F1 {crop_metrics['macro_f1']:.2f})."),
                "basis": "upstream_evaluation"})
        class_metrics = best["upstream_metrics"]
        if class_metrics and class_metrics["precision"] < UPSTREAM_WEAK_F1:
            advisories.append({
                "code": "WEAK_CLASS_UPSTREAM",
                "message": (f"When the model predicted '{best['class']}' in the upstream test set it was "
                            f"right {class_metrics['precision']:.0%} of the time."),
                "basis": "upstream_evaluation"})
        if quality["warnings"]:
            advisories.append({"code": "IMAGE_QUALITY", "message": "Photo quality warnings were raised; "
                               "consider retaking the photo.", "basis": "heuristic"})

        second = top[1]["score"] if len(top) > 1 else 0.0
        return {
            "success": True,
            "request_id": request_id,
            "model": "agrismart-india-v1",
            "model_version": model.version,
            "model_sha256": model.predictor.sha256,
            "inference_mode": "real",
            "device": model.device,
            "crop": crop,
            "crop_source": "user" if crop else "model",
            "predicted_crop": best["crop"],
            "predicted_class": best["class"],
            "predicted_label": best["label"],
            "is_healthy": best["is_healthy"],
            "confidence": best["score"],
            "margin": best["score"] - second,
            "global_top": {"label": raw["globalTop"]["label"], "raw_score": global_top},
            "score_type": raw["scoreType"],
            "top_predictions": top,
            "crop_scores": [{"crop": key, "score": value} for key, value in crop_ranking[:5]],
            "selected_crop_mass": raw["selectedCropMass"],
            "image_quality": quality,
            "assessment": {
                "status": "REVIEW_REQUIRED",
                "reasons": raw["uncertainty"]["reasons"],
                "advisories": advisories,
            },
            "is_laboratory_confirmed": False,
            "preprocessing": raw["model"]["preprocessing"],
            "latency_ms": latency_ms,
            "inference_ms": inference_ms,
            "disclaimer": DISCLAIMER,
        }
