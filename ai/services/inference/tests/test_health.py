from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from conftest import TOKEN, fake_loader_factory, make_settings, wait_until_settled


def test_health_reports_real_model_when_loaded(fake_client):
    body = fake_client.get("/health").json()
    assert body["status"] == "healthy"
    assert body["model_loaded"] is True
    assert body["mode"] == "real"
    assert body["device"] == "cpu"
    assert body["model_version"] == "india-model-v1"
    assert fake_client.get("/ready").status_code == 200


def test_health_reports_loading_then_ready():
    with TestClient(create_app(make_settings(), fake_loader_factory(delay=1.0))) as client:
        first = client.get("/health").json()
        assert first["status"] == "loading" and first["model_loaded"] is False
        assert first["mode"] == "unavailable"
        assert client.get("/ready").status_code == 503
        assert wait_until_settled(client)["status"] == "healthy"


def test_load_failure_is_degraded_never_mock():
    def broken(settings):
        raise ValueError("CHECKPOINT_SHA256_MISMATCH")

    with TestClient(create_app(make_settings(), broken)) as client:
        body = wait_until_settled(client)
        assert body["status"] == "degraded"
        assert body["model_loaded"] is False
        assert body["mode"] == "unavailable"
        assert body["error_code"] == "CHECKPOINT_SHA256_MISMATCH"
        assert client.get("/ready").status_code == 503
        auth = {"Authorization": f"Bearer {TOKEN}"}
        assert client.get("/v1/crops", headers=auth).status_code == 503
        response = client.post("/v1/predict", headers=auth, files={"image": ("a.jpg", b"x", "image/jpeg")})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_health_never_leaks_paths():
    def broken(settings):
        raise FileNotFoundError(r"C:\secret\checkpoints\model.pt")

    with TestClient(create_app(make_settings(), broken)) as client:
        text = str(wait_until_settled(client))
        assert "secret" not in text and "model.pt" not in text


def test_short_token_refuses_startup():
    with pytest.raises(RuntimeError, match="AI_SERVICE_TOKEN"):
        with TestClient(create_app(make_settings(AI_SERVICE_TOKEN="short"), fake_loader_factory())):
            pass


def test_openapi_docs_available(fake_client):
    schema = fake_client.get("/openapi.json").json()
    assert "/v1/predict" in schema["paths"] and "/v1/crops" in schema["paths"]
