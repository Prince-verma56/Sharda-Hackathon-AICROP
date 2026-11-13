from conftest import AUTH


def test_crops_requires_service_token(fake_client):
    assert fake_client.get("/v1/crops").status_code == 401
    assert fake_client.get("/v1/crops", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_fake_crops_shape(fake_client):
    body = fake_client.get("/v1/crops", headers=AUTH).json()
    assert body["crop_count"] == 2 and body["class_count"] == 4
    tomato = next(c for c in body["crops"] if c["id"] == "tomato")
    assert tomato["classes"][0]["is_healthy"] is True  # healthy sorted first


def test_real_catalogue_matches_checkpoint(real_client):
    body = real_client.get("/v1/crops", headers=AUTH).json()
    assert body["model_version"] == "india-model-v1"
    assert body["crop_count"] == 59
    assert body["class_count"] == 387
    ids = {crop["id"] for crop in body["crops"]}
    assert {"tomato", "potato", "corn_maize", "rice", "wheat"} <= ids
    for crop in body["crops"]:
        assert all(cls["label"].startswith(crop["id"] + "::") for cls in crop["classes"])
        assert crop["upstream_metrics"] is not None  # evaluation report present for every crop
