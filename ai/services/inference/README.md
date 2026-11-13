# AgriSmart inference service (FastAPI)

Private service that loads the SHA-256-verified **AgriSmart India v1** checkpoint once and serves real predictions. Called only by the Next.js server (`@/ai/diagnosis`), never directly by browsers.

```powershell
# from ai/services/inference, after creating .venv (see docs/agrismart-implementation/README.md)
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1
.\.venv\Scripts\python -m pytest tests -q
```

Configuration comes from environment variables or the git-ignored `ai/services/inference/.env`. `AI_SERVICE_TOKEN` (≥ 32 chars) is required.

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /health` | — | service + model status (`healthy`/`loading`/`degraded`, `mode: real|unavailable`) |
| `GET /ready` | — | 200 only when the real model is loaded |
| `GET /v1/crops` | Bearer | crops and classes from the checkpoint, with upstream test metrics |
| `POST /v1/predict` | Bearer | multipart `image`, optional `crop`, optional `top_k` |
| `GET /docs` | — | Swagger UI (disable with `AI_INFERENCE_ENABLE_DOCS=false`) |

Model maths live in `ai/models/agrismart-india/predict.py` (single implementation). Contract: [CONTRACT.md](CONTRACT.md). Design and test results: [docs/agrismart-implementation](../../../docs/agrismart-implementation/README.md). Docker: `Dockerfile` + `docker/compose.ai.yaml`.

No farmer data, database, public CORS, URL fetching, treatment advice or mock fallback exists in this service.
