"""Real-model diagnosis tests on the upstream PlantDoc sample photos (CC BY 4.0).

These four photos verify the pipeline end to end. They are NOT an accuracy measurement.
"""
import json
import time

import pytest

from conftest import AUTH

CASES = [
    ("tomato_late_blight_1.jpg", "tomato", "Late blight", False),
    ("potato_early_blight_1.jpg", "potato", "Early blight", False),
    ("corn_common_rust_1.jpg", "corn_maize", "Common rust", False),
    ("tomato_healthy_1.jpg", "tomato", "Healthy", True),
]


def predict(client, image: bytes, crop: str | None = None, top_k: int | None = None, name="leaf.jpg"):
    data = {}
    if crop:
        data["crop"] = crop
    if top_k is not None:
        data["top_k"] = str(top_k)
    return client.post("/v1/predict", headers=AUTH, data=data, files={"image": (name, image, "image/jpeg")})


def assert_valid_scores(body: dict, top_k: int):
    assert body["success"] is True and body["inference_mode"] == "real"
    assert body["is_laboratory_confirmed"] is False
    assert body["assessment"]["status"] == "REVIEW_REQUIRED"
    assert len(body["top_predictions"]) == top_k
    scores = [p["score"] for p in body["top_predictions"]]
    assert scores == sorted(scores, reverse=True)
    assert all(0 <= s <= 1 for s in scores) and sum(scores) <= 1 + 1e-6
    assert body["confidence"] == scores[0]
    assert body["latency_ms"] >= body["inference_ms"] > 0


@pytest.mark.parametrize("name,crop,expected,healthy", CASES)
def test_real_prediction_with_crop_hint(real_client, sample_bytes, name, crop, expected, healthy, record):
    response = predict(real_client, sample_bytes[name], crop=crop, top_k=5)
    assert response.status_code == 200, response.text
    body = response.json()
    assert_valid_scores(body, 5)
    assert body["crop"] == crop and body["crop_source"] == "user"
    assert body["score_type"] == "crop_conditioned_softmax"
    # crop-conditioned inference must stay inside the selected crop
    assert all(p["crop"] == crop for p in body["top_predictions"])
    assert abs(sum(p["score"] for p in body["top_predictions"]) - 1) < 0.05 or len(body["top_predictions"]) < 5
    record(name, crop, body, expected)
    # Recorded, not asserted: a single photo is not an accuracy claim.


@pytest.mark.parametrize("name,crop,expected,healthy", CASES)
def test_real_prediction_without_crop_hint(real_client, sample_bytes, name, crop, expected, healthy, record):
    body = predict(real_client, sample_bytes[name], top_k=3).json()
    assert_valid_scores(body, 3)
    assert body["crop"] is None and body["crop_source"] == "model"
    assert body["score_type"] == "global_softmax"
    assert body["selected_crop_mass"] is None
    record(name, None, body, expected)


def test_wrong_crop_selection_raises_mismatch_advisory(real_client, sample_bytes):
    # A tomato photo with "rice" selected: output stays within rice, but the advisory flags it.
    body = predict(real_client, sample_bytes["tomato_late_blight_1.jpg"], crop="rice").json()
    assert all(p["crop"] == "rice" for p in body["top_predictions"])
    codes = [a["code"] for a in body["assessment"]["advisories"]]
    assert "CROP_MISMATCH" in codes
    assert body["selected_crop_mass"] < body["crop_scores"][0]["score"]


def test_repeated_predictions_are_deterministic(real_client, sample_bytes):
    image = sample_bytes["potato_early_blight_1.jpg"]
    first = predict(real_client, image, crop="potato").json()
    timings = []
    for _ in range(5):
        started = time.perf_counter()
        again = predict(real_client, image, crop="potato").json()
        timings.append((time.perf_counter() - started) * 1000)
        assert [p["label"] for p in again["top_predictions"]] == [p["label"] for p in first["top_predictions"]]
        assert again["confidence"] == pytest.approx(first["confidence"], abs=1e-6)
    print(f"\nrepeated potato latency ms: {[round(t) for t in timings]}")


def test_top_k_bounds(real_client, sample_bytes):
    image = sample_bytes["tomato_healthy_1.jpg"]
    assert len(predict(real_client, image, top_k=1).json()["top_predictions"]) == 1
    assert len(predict(real_client, image, top_k=10).json()["top_predictions"]) == 10
    assert len(predict(real_client, image).json()["top_predictions"]) == 5  # default


@pytest.mark.parametrize("kind", ["blurry", "dark", "tiny_upscale_needed"])
def test_degraded_photos_get_quality_warnings(real_client, derived_images, kind, record):
    body = predict(real_client, derived_images[kind], crop="tomato").json()
    assert body["success"] is True
    assert body["image_quality"]["status"] == "warning", body["image_quality"]
    assert any(a["code"] == "IMAGE_QUALITY" for a in body["assessment"]["advisories"])
    record(kind, "tomato", body, None)


@pytest.mark.parametrize("kind", ["non_plant_gradient", "non_plant_checkerboard"])
def test_non_plant_images_still_return_a_class_but_require_review(real_client, derived_images, kind, record):
    """Known limitation: no OOD detector. The model always picks some class."""
    body = predict(real_client, derived_images[kind], name=f"{kind}.png").json()
    assert body["success"] is True
    assert body["assessment"]["status"] == "REVIEW_REQUIRED"
    assert "NO_OOD_DETECTOR" in body["assessment"]["reasons"]
    assert "LOW_GLOBAL_EVIDENCE" in [a["code"] for a in body["assessment"]["advisories"]]
    record(kind, None, body, None)


@pytest.mark.parametrize("name,crop,expected,healthy", CASES)
def test_real_leaf_photos_do_not_trigger_low_evidence_or_blur(real_client, sample_bytes, name, crop, expected, healthy):
    body = predict(real_client, sample_bytes[name], crop=crop).json()
    codes = [a["code"] for a in body["assessment"]["advisories"]]
    assert "LOW_GLOBAL_EVIDENCE" not in codes
    assert "POSSIBLY_BLURRY" not in [w["code"] for w in body["image_quality"]["warnings"]]


# ---- result recording for LOOP-04 / LOOP-09 reports -----------------------------------------

RESULTS: list[dict] = []


@pytest.fixture
def record():
    def _record(name, crop, body, expected):
        RESULTS.append({
            "image": name, "crop_hint": crop, "expected": expected,
            "predicted_label": body["predicted_label"], "confidence": round(body["confidence"], 4),
            "raw_top_score": round(body["top_predictions"][0]["raw_score"], 4),
            "top3": [(p["label"], round(p["score"], 4)) for p in body["top_predictions"][:3]],
            "advisories": [a["code"] for a in body["assessment"]["advisories"]],
            "quality": body["image_quality"]["status"], "sharpness": body["image_quality"]["sharpness"],
            "brightness": body["image_quality"]["brightness"],
            "inference_ms": body["inference_ms"], "latency_ms": body["latency_ms"], "device": body["device"],
        })
    return _record


def teardown_module(module):
    if RESULTS:
        from conftest import SERVICE_DIR
        out = SERVICE_DIR / "tests" / ".last_run_results.json"
        out.write_text(json.dumps(RESULTS, indent=1), encoding="utf-8")
