# Loop 5 — FastAPI inference service

Status: **passed** — 50 pytest tests (incl. real-model tests) green.

## Layout

```text
ai/services/inference/
├── app/
│   ├── main.py                 app factory, PrivateBoundary middleware (request id, bearer auth, body cap), error handlers
│   ├── config.py               pydantic-settings; env vars + optional git-ignored .env
│   ├── dependencies.py
│   ├── api/routes/             health.py (/health, /ready) · crops.py (/v1/crops) · diagnosis.py (/v1/predict)
│   ├── core/                   model_loader.py (imports predict.py once) · exceptions.py (stable error codes)
│   ├── schemas/                diagnosis.py · health.py (OpenAPI models)
│   └── services/               inference_service.py (single model, worker thread, admission, advisories)
│                               image_validation.py (quality heuristics)
├── tests/                      conftest.py + test_health / test_crops / test_model_loading / test_diagnosis / test_invalid_images
├── requirements.txt  requirements.lock  Dockerfile  Dockerfile.dockerignore  README.md  CONTRACT.md
└── _archive/prototype-v0/      superseded single-file prototype (not imported; safe to delete)
```

There is no `preprocessing.py` / `predictor.py` / `utils/timing.py`: the preprocessing and prediction maths live in one place (`ai/models/agrismart-india/predict.py`) to avoid two diverging copies, and timing is inline. No empty placeholder files were created.

## Behaviour

- Model loads **in the background at startup**; `/health` reports `loading → healthy` or `degraded` (with `error_code`), and `mode` is only `real` when the verified checkpoint is loaded. There is no mock path.
- One worker thread runs inference; `AI_INFERENCE_MAX_IN_FLIGHT` (default 2) caps running + queued requests → `429 INFERENCE_BUSY`. Timeouts (`AI_INFERENCE_TIMEOUT_SECONDS`, default 60) → `504`; the slot is released only when computation actually ends.
- Bearer token (`AI_SERVICE_TOKEN`, ≥ 32 chars, constant-time compare) is checked **before** multipart parsing; `/health`, `/ready`, `/docs`, `/openapi.json` are open. Startup refuses to run without a token.
- Body capped while streaming (8 MiB + 64 KiB), images decoded and validated from bytes (declared MIME ignored).
- Errors: `{"success": false, "error": {"code", "message", "request_id"}}`; no tracebacks, paths or exception text.
- Logs: request id, crop, top label, score, latency, quality status. No image bytes, no PII.
- Swagger UI at `/docs` (disable with `AI_INFERENCE_ENABLE_DOCS=false`; the Docker image disables it by default).

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | no | status `healthy/loading/degraded`, `model_loaded`, `model_version`, `model_sha256`, `device`, `mode`, `error_code`, `load_ms`, `uptime_s`, `requests_served` |
| GET | `/ready` | no | same body; 200 only when the model is loaded, else 503 (container healthcheck) |
| GET | `/v1/crops` | yes | 59 crops → classes from the checkpoint, with upstream metrics |
| POST | `/v1/predict` | yes | multipart `image`, optional `crop`, optional `top_k` (1–10, default 5) |

Full response contract: [`ai/services/inference/CONTRACT.md`](../../ai/services/inference/CONTRACT.md).

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `AI_SERVICE_TOKEN` | — (required) | ≥ 32 chars; same value as Next.js |
| `AGRISMART_MODEL_DIR` | `ai/models/agrismart-india` | folder with `predict.py`, `weights.json`, `reports/` |
| `AGRISMART_MODEL_PATH` | `<model_dir>/checkpoints/model.pt` | must still match the manifest SHA-256 |
| `AI_INFERENCE_DEVICE` | `auto` | `auto`/`cpu`/`cuda`; `cuda` without a GPU build fails with `DEVICE_UNAVAILABLE` |
| `AI_INFERENCE_THREADS` | 4 | torch intra-op threads (1–16) |
| `AI_INFERENCE_TIMEOUT_SECONDS` | 60 | |
| `AI_INFERENCE_MAX_IN_FLIGHT` | 2 | |
| `AI_INFERENCE_ENABLE_DOCS` | true | |

## Separation of concerns

The service owns inference only — no farmers, auth users, history, database or Redis. It is ready to be called by LangGraph tools / Vapi function handlers through the server-side client in `ai/diagnosis/`.
