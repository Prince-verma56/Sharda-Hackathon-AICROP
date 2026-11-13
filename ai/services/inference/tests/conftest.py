"""Shared fixtures.

Two kinds of client:
- `fake_client`: a stub predictor with the real image decoder, for fast boundary tests.
- `real_client`: the actual India v1 checkpoint, loaded ONCE per test session.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
import time

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageFilter

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

from app.config import Settings  # noqa: E402
from app.core.model_loader import LoadedModel, import_model_package, load_model, load_reliability  # noqa: E402
from app.main import create_app  # noqa: E402

TOKEN = "t" * 48
AUTH = {"Authorization": f"Bearer {TOKEN}"}
MODEL_DIR = SERVICE_DIR.parents[1] / "models" / "agrismart-india"
SAMPLES = MODEL_DIR / "upstream" / "samples"
CHECKPOINT = MODEL_DIR / "checkpoints" / "model.pt"


def make_settings(**overrides) -> Settings:
    values = {"AI_SERVICE_TOKEN": TOKEN, "AI_INFERENCE_DEVICE": "cpu", "AI_INFERENCE_THREADS": 4}
    values.update(overrides)
    return Settings(**values)


def jpeg(image: Image.Image, quality: int = 90) -> bytes:
    buffer = BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=quality)
    return buffer.getvalue()


def png(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def wait_until_settled(client: TestClient, timeout: float = 180) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get("/health").json()
        if body["model_state"] != "loading":
            return body
        time.sleep(0.2)
    raise TimeoutError("model did not finish loading")


# ---- fake model --------------------------------------------------------------------------

class FakePredictor:
    """Deterministic stand-in with the same interface as IndiaPredictor."""
    device = "cpu"
    sha256 = "f" * 64
    labels = ["tomato::Healthy", "tomato::Late blight", "potato::Early blight", "potato::Healthy"]
    crop_classes = {"tomato": [0, 1], "potato": [2, 3]}

    def __init__(self):
        self.calls = 0

    def predict_image(self, image, crop=None, top_k=5):
        self.calls += 1
        raw = [0.1, 0.6, 0.2, 0.1]
        allowed = self.crop_classes[crop] if crop else list(range(4))
        mass = sum(raw[i] for i in allowed)
        ranked = sorted(allowed, key=lambda i: raw[i], reverse=True)[:top_k]
        return {"predictions": [{"label": self.labels[i], "rawScore": raw[i], "score": raw[i] / mass}
                                for i in ranked],
                "globalTop": {"label": self.labels[1], "rawScore": raw[1]},
                "cropScores": {"tomato": 0.7, "potato": 0.3},
                "selectedCropMass": {"tomato": 0.7, "potato": 0.3}.get(crop),
                "scoreType": "crop_conditioned_softmax" if crop else "global_softmax",
                "uncertainty": {"status": "REVIEW_REQUIRED", "reasons": ["NO_OOD_DETECTOR"]},
                "model": {"preprocessing": "fake"}}


def fake_loader_factory(predictor: FakePredictor | None = None, delay: float = 0.0):
    module = import_model_package(MODEL_DIR)  # real decode_image + MANIFEST, no torch needed

    def loader(settings):
        if delay:
            time.sleep(delay)
        return LoadedModel(predictor or FakePredictor(), module, load_reliability(MODEL_DIR), 1)
    return loader


@pytest.fixture
def fake_predictor():
    return FakePredictor()


@pytest.fixture
def fake_client(fake_predictor):
    with TestClient(create_app(make_settings(), fake_loader_factory(fake_predictor))) as client:
        wait_until_settled(client, timeout=10)
        yield client


# ---- real model --------------------------------------------------------------------------

@pytest.fixture(scope="session")
def real_client():
    if not CHECKPOINT.is_file():
        pytest.skip("India v1 checkpoint not downloaded (run scripts/download_weights.py)")
    calls = {"count": 0}

    def counting_loader(settings):
        calls["count"] += 1
        return load_model(settings)

    with TestClient(create_app(make_settings(), counting_loader)) as client:
        health = wait_until_settled(client)
        assert health["model_loaded"], health
        client.load_calls = calls
        yield client


@pytest.fixture(scope="session")
def sample_bytes():
    if not SAMPLES.is_dir():
        pytest.skip("Upstream samples not installed (run scripts/install_upstream.py)")
    return {path.name: path.read_bytes() for path in SAMPLES.glob("*.jpg")}


@pytest.fixture(scope="session")
def derived_images(sample_bytes):
    """Degraded and non-plant images generated locally from the samples."""
    tomato = Image.open(BytesIO(sample_bytes["tomato_late_blight_1.jpg"])).convert("RGB")
    width, height = tomato.size
    gradient = Image.linear_gradient("L").resize((640, 480)).convert("RGB")
    checker = Image.new("RGB", (640, 480), "white")
    for x in range(0, 640, 40):
        for y in range(0, 480, 40):
            if (x // 40 + y // 40) % 2:
                checker.paste((20, 20, 160), (x, y, x + 40, y + 40))
    return {
        "blurry": jpeg(tomato.filter(ImageFilter.GaussianBlur(12))),
        "dark": jpeg(tomato.point(lambda v: v * 0.12)),
        "tiny_upscale_needed": jpeg(tomato.resize((96, round(96 * height / width)))),
        "non_plant_gradient": jpeg(gradient),
        "non_plant_checkerboard": png(checker),
    }
