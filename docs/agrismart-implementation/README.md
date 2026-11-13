# AgriSmart AI subsystem — run it locally

Crop disease classifier (AgriSmart India v1: DINOv2 ViT-B/14, 59 crops, 387 diseases/conditions) served by a private FastAPI service and used by the Next.js app through server-side API routes.

```text
Browser ──► Next.js  /api/v1/diagnosis · /api/v1/crops · /api/v1/diagnosis/status
                │  (server-only, bearer token)
                ▼
          FastAPI  127.0.0.1:8001  /v1/predict · /v1/crops · /health · /ready
                │
                ▼
          ai/models/agrismart-india/predict.py  +  checkpoints/model.pt (344 MB, SHA-256 verified)
```

Commands are PowerShell from the repository root unless noted.

## 1. One-time setup

```powershell
# Node dependencies
npm ci

# Python 3.12 environment for the inference service
cd ai/services/inference
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python -m pip install -r requirements.txt     # exact tested set: requirements.lock
cd ../../..

# Model weights (skips download if a verified copy exists; never overwrites an invalid file)
.\ai\services\inference\.venv\Scripts\python ai/models/agrismart-india/scripts/download_weights.py
.\ai\services\inference\.venv\Scripts\python ai/models/agrismart-india/scripts/download_weights.py --verify-only

# Optional: local upstream copy (sample photos + original predictor for parity tests)
.\ai\services\inference\.venv\Scripts\python ai/models/agrismart-india/scripts/install_upstream.py
```

### Secrets (one shared token, never committed)

```powershell
$t = python -c "import secrets; print(secrets.token_urlsafe(36))"
"AI_INFERENCE_BASE_URL=http://127.0.0.1:8001`nAI_SERVICE_TOKEN=$t" | Set-Content .env.local
"AI_SERVICE_TOKEN=$t`nAI_INFERENCE_DEVICE=auto" | Set-Content ai/services/inference/.env
```

Both files are git-ignored. Never use a `NEXT_PUBLIC_` prefix for these values.

## 2. Start the inference service (pick one)

**Host Python**

```powershell
cd ai/services/inference
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 1
```

**Docker**

```powershell
docker compose --env-file .env.local -f docker/compose.ai.yaml up -d --build --wait ai-inference
docker compose --env-file .env.local -f docker/compose.ai.yaml logs -f ai-inference
docker compose --env-file .env.local -f docker/compose.ai.yaml down
```

Check: `curl http://127.0.0.1:8001/health` → `"model_loaded": true, "mode": "real"`. Swagger (host run): http://127.0.0.1:8001/docs — click *Authorize* and paste the token.

## 3. Start Next.js and open the model lab

```powershell
npm run dev
```

Open **http://localhost:3000/dev/model-lab** (use `localhost`, not `127.0.0.1`: Next 16 blocks dev assets for other origins). Pick a crop, drop a leaf photo or click a sample, press **Run diagnosis**.

The page exists only in development (or with `ENABLE_DEV_TOOLS=true`); production returns 404.

## 4. Tests

```powershell
npm run typecheck; npm run lint; npm test; npm run build
cd ai/services/inference; .\.venv\Scripts\python -m pytest tests -q; cd ../../..
.\ai\services\inference\.venv\Scripts\python -m unittest discover -s ai/models/agrismart-india/tests
.\ai\services\inference\.venv\Scripts\python ai/models/agrismart-india/scripts/verify_runtime.py
```

## 5. Using it from code

```ts
import { diagnose, getCropCatalogue, getInferenceStatus } from '@/ai/diagnosis'; // server only
const result = await diagnose({ image: file, filename: file.name, crop: 'tomato', topK: 5 });
```

This is the entry point for future LangGraph tools and Vapi function handlers.

## Things to know

- Scores are uncalibrated model outputs. Every result is `REVIEW_REQUIRED`; advisories explain why (crop mismatch, weak upstream class/crop, photo quality, low global evidence).
- There is no out-of-distribution detector. Non-plant photos still get a class (flagged by the provisional `LOW_GLOBAL_EVIDENCE` heuristic).
- Licence: **non-commercial research and education** (upstream statement; several training datasets are NC). Review before any commercial or public deployment.
- In production, `/api/v1/diagnosis` and `/api/v1/crops` require a signed-in Clerk user.

## Reports

[Execution status](EXECUTION_STATUS.md) · [L0 baseline](LOOP-00-BASELINE.md) · [L1 upstream clone & datasets](LOOP-01-UPSTREAM-CLONE.md) · [L2 reuse matrix](LOOP-02-UPSTREAM-AUDIT.md) · [L3 model verification](LOOP-03-MODEL-VERIFICATION.md) · [L4 inference tests](LOOP-04-INFERENCE-TESTS.md) · [L5 FastAPI](LOOP-05-FASTAPI-BACKEND.md) · [L6 Next.js](LOOP-06-NEXTJS-INTEGRATION.md) · [L7 model lab](LOOP-07-MODEL-LAB-UI.md) · [L8 Docker](LOOP-08-CONTAINERIZATION.md) · [L9 end-to-end](LOOP-09-END-TO-END-TESTING.md) · [API contract](../../ai/services/inference/CONTRACT.md)
