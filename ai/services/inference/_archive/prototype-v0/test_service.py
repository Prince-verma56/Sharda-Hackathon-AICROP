"""Boundary tests for the private API; actual checkpoint smoke tests are separate."""
import importlib.util
import os
from pathlib import Path
import secrets
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location("private_inference_tests", Path(__file__).with_name("app.py"))
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


class ModelUnavailableTests(unittest.TestCase):
    def setUp(self):
        self.token = secrets.token_urlsafe(32)
        self.env = patch.dict(os.environ, {"AI_SERVICE_TOKEN": self.token})
        self.env.start()

    def tearDown(self):
        self.env.stop()

    @staticmethod
    def unavailable():
        raise RuntimeError("Test model unavailable")

    def test_health_is_not_model_readiness(self):
        with TestClient(service.create_app(self.unavailable)) as client:
            self.assertEqual(client.get("/health").status_code, 200)
            self.assertEqual(client.get("/ready").status_code, 503)

    def test_private_routes_require_credential_even_when_unavailable(self):
        with TestClient(service.create_app(self.unavailable)) as client:
            self.assertEqual(client.get("/v1/model/metadata").status_code, 401)
            self.assertEqual(client.post("/v1/predict").status_code, 401)
            allowed = client.get("/v1/model/metadata", headers={"Authorization": f"Bearer {self.token}"})
            self.assertEqual(allowed.status_code, 503)

    def test_missing_token_refuses_startup(self):
        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": ""}):
            with self.assertRaisesRegex(RuntimeError, "AI_SERVICE_TOKEN"):
                with TestClient(service.create_app(self.unavailable)):
                    pass

    def test_stream_limit_runs_before_inference(self):
        class FakeModel:
            def predict(self, *args):
                raise AssertionError("Oversize image must never reach inference")
        with TestClient(service.create_app(FakeModel)) as client:
            response = client.post("/v1/predict", headers={"Authorization": f"Bearer {self.token}"},
                                   files={"image": ("large.jpg", b"x" * (service.MAX_BYTES + 65537), "image/jpeg")})
            self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
