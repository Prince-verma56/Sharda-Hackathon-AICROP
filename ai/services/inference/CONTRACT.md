# Inference service contract (v1, implemented)

Private network only. Next.js calls it with `Authorization: Bearer <AI_SERVICE_TOKEN>`; optional `X-Request-ID` (8–64 ASCII chars) is echoed as `request_id`.

## `POST /v1/predict`

Multipart form: `image` (JPEG/PNG/WebP, ≤ 8 MiB, ≤ 20 MP, ≥ 64 px each side, single frame; validated from bytes), optional `crop` (an id from `/v1/crops`), optional `top_k` 1–10 (default 5). Other fields are rejected.

```json
{
  "success": true,
  "request_id": "…",
  "model": "agrismart-india-v1",
  "model_version": "india-model-v1",
  "model_sha256": "ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a",
  "inference_mode": "real",
  "device": "cpu",
  "crop": "tomato",
  "crop_source": "user",
  "predicted_crop": "tomato",
  "predicted_class": "Late blight",
  "predicted_label": "tomato::Late blight",
  "is_healthy": false,
  "confidence": 0.7153,
  "margin": 0.4975,
  "global_top": {"label": "tomato::Late blight", "raw_score": 0.4600},
  "score_type": "crop_conditioned_softmax",
  "top_predictions": [
    {"label": "tomato::Late blight", "crop": "tomato", "class": "Late blight", "score": 0.7153, "raw_score": 0.4600,
     "is_healthy": false, "upstream_metrics": {"precision": 0.9532, "recall": 0.9132, "f1": 0.9328, "support": 357}}
  ],
  "crop_scores": [{"crop": "tomato", "score": 0.643}, {"crop": "potato", "score": 0.201}],
  "selected_crop_mass": 0.643,
  "image_quality": {"status": "ok", "method": "heuristic", "width": 750, "height": 499,
                    "brightness": 121.6, "contrast": 52.1, "sharpness": 511.4, "warnings": []},
  "assessment": {"status": "REVIEW_REQUIRED", "reasons": ["FIELD_POLICY_NOT_VALIDATED", "NO_OOD_DETECTOR"],
                 "advisories": []},
  "is_laboratory_confirmed": false,
  "preprocessing": "timm-bicubic-crop0.9-224-tta-mirror-v1",
  "latency_ms": 284,
  "inference_ms": 275,
  "disclaimer": "Scores are outputs of an image classifier, not calibrated probabilities…"
}
```

- `score`: softmax renormalised over the selected crop's classes (or global when no crop). `raw_score`: global softmax over 387 classes. Neither is calibrated diagnostic certainty.
- `upstream_metrics`: the upstream authors' held-out test metrics for that class (not our validation).
- Advisory codes: `CROP_MISMATCH` (model_global_distribution), `WEAK_CROP_UPSTREAM`, `WEAK_CLASS_UPSTREAM` (upstream_evaluation, < 0.80), `IMAGE_QUALITY`, `LOW_GLOBAL_EVIDENCE` (heuristic, global top < 0.10). Quality warnings: `LOW_RESOLUTION`, `TOO_DARK`, `OVEREXPOSED`, `LOW_CONTRAST`, `POSSIBLY_BLURRY`.

## `GET /v1/crops`

`{success, model_version, crop_count: 59, class_count: 387, crops: [{id, name, class_count, classes: [{label, name, is_healthy, upstream_metrics}], upstream_metrics: {test_images, macro_f1, accuracy}}]}`

## `GET /health`, `GET /ready`

`{status: healthy|loading|degraded, model_loaded, model_state: loading|ready|failed, model_version, model_sha256, device, mode: real|unavailable, error_code, load_ms, uptime_s, requests_served}`. `/ready` returns 503 unless loaded.

## Errors

`{"success": false, "error": {"code": "…", "message": "…", "request_id": "…"}}`

| Code | HTTP |
|---|---|
| `UNAUTHORIZED` | 401 |
| `INVALID_MULTIPART` | 400 |
| `IMAGE_SIZE_INVALID`, `IMAGE_PIXEL_LIMIT` | 413 |
| `IMAGE_FORMAT_UNSUPPORTED` | 415 |
| `IMAGE_INVALID`, `IMAGE_DIMENSIONS_OR_ANIMATION_INVALID`, `IMAGE_REQUIRED`, `INVALID_FIELDS`, `CROP_UNSUPPORTED`, `TOP_K_INVALID` | 422 |
| `INFERENCE_BUSY` | 429 |
| `MODEL_LOADING`, `MODEL_UNAVAILABLE` | 503 |
| `INFERENCE_TIMEOUT` | 504 |
| `INFERENCE_FAILED` | 500 |

The Next.js API (`/api/v1/diagnosis`) returns a camelCase version inside `{success, data, meta}`; see `ai/diagnosis/schemas.ts`.
