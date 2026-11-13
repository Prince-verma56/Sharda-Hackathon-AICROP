import importlib.util

import pytest

from conftest import AUTH, CHECKPOINT, MODEL_DIR, make_settings
from app.core.model_loader import load_model


def test_real_model_loaded_once_and_reused(real_client, sample_bytes):
    health = real_client.get("/health").json()
    assert health["model_loaded"] and health["mode"] == "real"
    assert health["model_sha256"] == "ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a"
    for _ in range(3):
        response = real_client.post("/v1/predict", headers=AUTH,
                                    files={"image": ("t.jpg", sample_bytes["tomato_healthy_1.jpg"], "image/jpeg")})
        assert response.status_code == 200
    assert real_client.load_calls["count"] == 1


def test_wrong_checkpoint_is_rejected_before_deserialisation(tmp_path):
    fake = tmp_path / "model.pt"
    fake.write_bytes(b"not a checkpoint")
    with pytest.raises(ValueError, match="CHECKPOINT_SIZE_MISMATCH"):
        load_model(make_settings(AGRISMART_MODEL_PATH=str(fake)))


def test_cuda_request_without_gpu_fails_cleanly():
    torch = pytest.importorskip("torch")
    if torch.cuda.is_available():
        pytest.skip("CUDA is available on this machine")
    if not CHECKPOINT.is_file():
        pytest.skip("checkpoint missing")
    with pytest.raises(ValueError, match="DEVICE_UNAVAILABLE"):
        load_model(make_settings(AI_INFERENCE_DEVICE="cuda"))


def test_parity_with_original_upstream_predictor(real_client, sample_bytes):
    """Our service must return exactly what the original upstream predict.py computes."""
    torch = pytest.importorskip("torch")
    original_path = MODEL_DIR / "upstream" / "model" / "india" / "predict.py"
    if not original_path.is_file():
        pytest.skip("upstream predictor not installed")
    spec = importlib.util.spec_from_file_location("upstream_india_predict", original_path)
    original = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(original)
    real_load = torch.load

    def safe_only(*args, **kwargs):  # forbid the upstream unsafe-pickle fallback
        if kwargs.get("weights_only") is not True:
            raise RuntimeError("unsafe torch.load attempted")
        return real_load(*args, **kwargs)

    torch.load = safe_only
    try:
        for name, crop in [("tomato_late_blight_1.jpg", "tomato"), ("potato_early_blight_1.jpg", "potato"),
                           ("corn_common_rust_1.jpg", "corn_maize"), ("tomato_healthy_1.jpg", "tomato")]:
            ours = real_client.post("/v1/predict", headers=AUTH, data={"crop": crop, "top_k": "5"},
                                    files={"image": (name, sample_bytes[name], "image/jpeg")}).json()
            theirs = original.predict_proba(str(MODEL_DIR / "upstream" / "samples" / name), crop=crop,
                                            weights=str(CHECKPOINT))
            expected = sorted(theirs.items(), key=lambda kv: -kv[1])[:5]
            assert [p["label"] for p in ours["top_predictions"]] == [label for label, _ in expected]
            for prediction, (_, score) in zip(ours["top_predictions"], expected):
                assert prediction["score"] == pytest.approx(score, abs=2e-4)
    finally:
        torch.load = real_load
