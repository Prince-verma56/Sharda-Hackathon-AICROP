"""Loads the AgriSmart India v1 model package exactly once.

The model mathematics (architecture, safe weights-only load, preprocessing, mirror TTA,
crop conditioning) live in ai/models/agrismart-india/predict.py so there is a single
implementation shared by the CLI, the verification script and this service.
"""
from __future__ import annotations

import importlib
import json
import logging
from pathlib import Path
import sys
import time

from app.config import Settings

log = logging.getLogger("agrismart.loader")


def import_model_package(model_dir: Path):
    """Import predict.py from the model package directory."""
    model_dir = model_dir.resolve()
    if not (model_dir / "predict.py").is_file():
        raise ImportError("MODEL_PACKAGE_MISSING")
    if str(model_dir) not in sys.path:
        sys.path.insert(0, str(model_dir))
    return importlib.import_module("predict")


def load_reliability(model_dir: Path) -> dict:
    """Upstream held-out evaluation (per crop / per class). Optional evidence, never invented."""
    path = model_dir / "reports" / "upstream_evaluation.json"
    if not path.is_file():
        log.warning("Upstream evaluation report missing; reliability context disabled")
        return {"per_crop": {}, "per_class": {}}
    return json.loads(path.read_text(encoding="utf-8"))


class LoadedModel:
    def __init__(self, predictor, module, reliability: dict, load_ms: int):
        self.predictor = predictor
        self.module = module
        self.reliability = reliability
        self.load_ms = load_ms

    @property
    def version(self) -> str:
        return self.module.MANIFEST["release"]

    @property
    def device(self) -> str:
        return self.predictor.device


def load_model(settings: Settings) -> LoadedModel:
    started = time.perf_counter()
    module = import_model_package(settings.model_dir)
    import torch

    torch.set_num_threads(settings.threads)
    predictor = module.IndiaPredictor(settings.checkpoint_path, device=settings.device)
    # Warm-up so the first real request does not pay one-time allocation costs.
    from PIL import Image

    predictor.predict_image(Image.new("RGB", (224, 224), (90, 140, 60)), top_k=1)
    load_ms = round((time.perf_counter() - started) * 1000)
    log.info("Model %s loaded on %s in %d ms (sha256 %s...)",
             module.MANIFEST["release"], predictor.device, load_ms, predictor.sha256[:12])
    return LoadedModel(predictor, module, load_reliability(settings.model_dir), load_ms)
