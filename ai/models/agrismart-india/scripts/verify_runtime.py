"""Exercise actual India v1 weights, original predictor parity and private API."""
from __future__ import annotations

import gc
import importlib.util
import json
import os
from pathlib import Path
import platform
import secrets
import sys
import time
from unittest.mock import patch

MODEL_DIR = Path(__file__).resolve().parents[1]
ROOT = MODEL_DIR.parents[2]
sys.path.insert(0, str(MODEL_DIR))
from predict import IndiaPredictor


def verify():
    import torch
    import timm
    from fastapi.testclient import TestClient
    torch.set_num_threads(4)
    started = time.perf_counter()
    predictor = IndiaPredictor()
    load_ms = round((time.perf_counter() - started) * 1000)
    original_path = MODEL_DIR / "upstream/model/india/predict.py"
    spec = importlib.util.spec_from_file_location("installed_agrismart_original", original_path)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    safe_torch_load = torch.load

    def require_safe_load(*args, **kwargs):
        if kwargs.get("weights_only") is not True:
            raise RuntimeError("Unsafe pickle fallback is prohibited during parity verification")
        return safe_torch_load(*args, **kwargs)

    rows = []
    for name, crop in [("tomato_late_blight_1.jpg", "tomato"),
                       ("potato_early_blight_1.jpg", "potato"),
                       ("corn_common_rust_1.jpg", "corn_maize"),
                       ("tomato_healthy_1.jpg", "tomato")]:
        image = MODEL_DIR / "upstream/samples" / name
        started = time.perf_counter()
        result = predictor.predict(image.read_bytes(), crop=crop, top_k=5)
        elapsed = round((time.perf_counter() - started) * 1000)
        with patch.object(torch, "load", side_effect=require_safe_load):
            expected = original.predict_proba(str(image), crop=crop,
                                              weights=str(MODEL_DIR / "checkpoints/model.pt"))
        for item in result["predictions"]:
            if abs(item["score"] - expected[item["label"]]) > 1e-5:
                raise AssertionError(f"Prediction parity failed: {name}")
        original_top = max(expected, key=expected.get)
        if result["predictions"][0]["label"] != original_top:
            raise AssertionError(f"Top class differs: {name}")
        rows.append({"sample": name, "selectedCrop": crop, "topPrediction": original_top,
                     "score": result["predictions"][0]["score"], "processingMs": elapsed,
                     "mode": result["mode"], "originalParity": True})
    original.load.cache_clear()
    del original
    gc.collect()

    service_dir = ROOT / "ai/services/inference"
    sys.path.insert(0, str(service_dir))
    from app.config import Settings
    from app.main import create_app
    from app.core.model_loader import load_model

    auth_checks = {}
    token = secrets.token_urlsafe(32)
    settings = Settings(AI_SERVICE_TOKEN=token, AI_INFERENCE_DEVICE="cpu")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(create_app(settings, load_model)) as client:
        deadline = time.time() + 180
        while client.get("/health").json()["model_state"] == "loading" and time.time() < deadline:
            time.sleep(0.25)
        auth_checks["ready"] = client.get("/ready").status_code
        auth_checks["unauthenticated_rejected"] = client.get("/v1/crops").status_code
        crops = client.get("/v1/crops", headers=headers).json()
        assert crops["class_count"] == 387 and crops["crop_count"] == 59
        sample = MODEL_DIR / "upstream/samples/tomato_late_blight_1.jpg"
        response = client.post("/v1/predict", headers=headers,
                               files={"image": (sample.name, sample.read_bytes(), "image/jpeg")},
                               data={"crop": "tomato", "top_k": "3"})
        assert response.status_code == 200, response.text
        assert response.json()["inference_mode"] == "real"
        auth_checks["real_prediction"] = response.status_code
        invalid = client.post("/v1/predict", headers=headers,
                              files={"image": ("fake.jpg", b"not an image", "image/jpeg")})
        auth_checks["invalid_image_rejected"] = invalid.status_code
        unsupported = client.post("/v1/predict", headers=headers,
                                  files={"image": (sample.name, sample.read_bytes(), "image/jpeg")},
                                  data={"crop": "unsupported-crop"})
        auth_checks["unsupported_crop_rejected"] = unsupported.status_code
        assert auth_checks == {"ready": 200, "unauthenticated_rejected": 401,
                               "real_prediction": 200, "invalid_image_rejected": 422,
                               "unsupported_crop_rejected": 422}, auth_checks
    report = {"status": "PASSED", "checkpointSha256": predictor.sha256,
              "python": platform.python_version(), "torch": torch.__version__,
              "timm": timm.__version__, "device": "cpu", "threads": 4,
              "cropCount": 59, "classCount": 387, "loadMs": load_ms,
              "samples": rows, "privateApiChecks": auth_checks,
              "limitations": "Four upstream smoke fixtures, not independent accuracy/field/OOD validation"}
    destination = MODEL_DIR / "reports/runtime-verification.json"
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    verify()
