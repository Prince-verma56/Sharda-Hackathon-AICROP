"""Upload validation. Uses the fake predictor so these run without the checkpoint."""
from io import BytesIO

from PIL import Image
import pytest

from conftest import AUTH, jpeg

MAX = 8 * 1024 * 1024


def post(client, files=None, data=None, headers=AUTH):
    return client.post("/v1/predict", headers=headers, files=files, data=data or {})


def leaf_jpeg(size=(256, 256)) -> bytes:
    return jpeg(Image.new("RGB", size, (60, 140, 60)))


def code(response) -> str:
    return response.json()["error"]["code"]


def test_valid_upload_reaches_model(fake_client, fake_predictor):
    response = post(fake_client, files={"image": ("leaf.jpg", leaf_jpeg(), "image/jpeg")}, data={"crop": "tomato"})
    assert response.status_code == 200, response.text
    assert fake_predictor.calls == 1


def test_auth_is_checked_before_parsing(fake_client, fake_predictor):
    response = post(fake_client, files={"image": ("leaf.jpg", leaf_jpeg(), "image/jpeg")}, headers={})
    assert response.status_code == 401 and code(response) == "UNAUTHORIZED"
    assert fake_predictor.calls == 0


@pytest.mark.parametrize("payload,expected_status,expected_code", [
    (b"this is not an image", 422, "IMAGE_INVALID"),
    (b"", 413, "IMAGE_SIZE_INVALID"),
])
def test_garbage_bytes(fake_client, fake_predictor, payload, expected_status, expected_code):
    response = post(fake_client, files={"image": ("x.jpg", payload, "image/jpeg")})
    assert response.status_code == expected_status and code(response) == expected_code
    assert fake_predictor.calls == 0


def test_gif_is_unsupported_even_if_labelled_jpeg(fake_client):
    buffer = BytesIO()
    Image.new("RGB", (128, 128), "green").save(buffer, format="GIF")
    response = post(fake_client, files={"image": ("x.jpg", buffer.getvalue(), "image/jpeg")})
    assert response.status_code == 415 and code(response) == "IMAGE_FORMAT_UNSUPPORTED"


def test_too_small_image(fake_client):
    response = post(fake_client, files={"image": ("x.jpg", leaf_jpeg((32, 32)), "image/jpeg")})
    assert response.status_code == 422 and code(response) == "IMAGE_DIMENSIONS_OR_ANIMATION_INVALID"


def test_animated_webp_rejected(fake_client):
    frames = [Image.new("RGB", (128, 128), c) for c in ("green", "red")]
    buffer = BytesIO()
    frames[0].save(buffer, format="WEBP", save_all=True, append_images=frames[1:])
    response = post(fake_client, files={"image": ("x.webp", buffer.getvalue(), "image/webp")})
    assert response.status_code == 422


def test_oversize_body_rejected_before_inference(fake_client, fake_predictor):
    response = post(fake_client, files={"image": ("big.jpg", b"\xff" * (MAX + 70_000), "image/jpeg")})
    assert response.status_code == 413 and code(response) == "IMAGE_SIZE_INVALID"
    assert fake_predictor.calls == 0


def test_unknown_crop_rejected(fake_client, fake_predictor):
    response = post(fake_client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")}, data={"crop": "durian"})
    assert response.status_code == 422 and code(response) == "CROP_UNSUPPORTED"
    assert fake_predictor.calls == 0


@pytest.mark.parametrize("top_k", ["0", "11", "abc", "-1"])
def test_top_k_validation(fake_client, top_k):
    response = post(fake_client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")}, data={"top_k": top_k})
    assert response.status_code == 422 and code(response) == "TOP_K_INVALID"


def test_missing_image_and_extra_fields(fake_client):
    assert code(post(fake_client, data={"crop": "tomato"})) == "IMAGE_REQUIRED"
    response = post(fake_client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")}, data={"user_id": "1"})
    assert response.status_code == 422 and code(response) == "INVALID_FIELDS"


def test_errors_never_include_tracebacks(fake_client):
    text = post(fake_client, files={"image": ("x.jpg", b"garbage", "image/jpeg")}).text
    assert "Traceback" not in text and ".py" not in text


def test_busy_service_returns_429(fake_predictor):
    """With max_in_flight=1 and a slow model, a concurrent second request is refused."""
    import threading
    import time

    from fastapi.testclient import TestClient

    from app.main import create_app
    from conftest import fake_loader_factory, make_settings, wait_until_settled

    original = fake_predictor.predict_image

    def slow(*args, **kwargs):
        time.sleep(1.5)
        return original(*args, **kwargs)

    fake_predictor.predict_image = slow
    app = create_app(make_settings(AI_INFERENCE_MAX_IN_FLIGHT=1), fake_loader_factory(fake_predictor))
    with TestClient(app) as client:
        wait_until_settled(client, 10)
        results = {}

        def first():
            results["first"] = post(client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")}).status_code

        thread = threading.Thread(target=first)
        thread.start()
        time.sleep(0.5)
        second = post(client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")})
        thread.join()
        assert results["first"] == 200
        assert second.status_code == 429 and code(second) == "INFERENCE_BUSY"


def test_timeout_returns_504(fake_predictor):
    import time

    from fastapi.testclient import TestClient

    from app.main import create_app
    from conftest import fake_loader_factory, make_settings, wait_until_settled

    fake_predictor.predict_image = lambda *a, **k: time.sleep(2.5)
    app = create_app(make_settings(AI_INFERENCE_TIMEOUT_SECONDS=1), fake_loader_factory(fake_predictor))
    with TestClient(app) as client:
        wait_until_settled(client, 10)
        response = post(client, files={"image": ("x.jpg", leaf_jpeg(), "image/jpeg")})
        assert response.status_code == 504 and code(response) == "INFERENCE_TIMEOUT"
