# Loop 9 — End-to-end testing

Status: **passed**. Path tested: photo → Next.js `/api/v1/diagnosis` → FastAPI → AgriSmart India v1 → JSON → Next.js → UI.

## Through Next.js (HTTP)

Evidence: [host-run FastAPI](evidence/e2e-next-to-hostrun-fastapi.json) · [Docker FastAPI](evidence/e2e-next-to-docker-fastapi.json) · [backend offline](evidence/e2e-backend-offline.json) · [model load failure](evidence/e2e-model-load-failure.json).

| # | Case | HTTP | Outcome |
|---|---|---|---|
| 1 | Healthy tomato | 200 | Healthy 0.961 |
| 2 | Diseased tomato | 200 | Late blight 0.715 |
| 3 | Potato | 200 | Early blight 0.990 |
| 4 | Corn (another crop) | 200 | Gray leaf spot 0.614 ✘ (truth: common rust, 2nd at 0.267) + `CROP_MISMATCH` |
| 5 | Wrong crop (tomato photo, potato selected) | 200 | stays within potato; `CROP_MISMATCH` |
| 6 | No crop selected | 200 | global: tomato Late blight 0.46 |
| 7 | Blurry | 200 | Late blight + `POSSIBLY_BLURRY` |
| 8 | Invalid file / GIF | 422 / 415 | `IMAGE_INVALID` / `IMAGE_FORMAT_UNSUPPORTED` |
| 9 | 9 MB upload | 413 | `IMAGE_SIZE_INVALID` (before calling FastAPI) |
| 10 | Non-plant (chart PNG), with/without crop | 200 | `LOW_GLOBAL_EVIDENCE` (+ `CROP_MISMATCH`) |
| 11 | Backend stopped | 503 | `INFERENCE_OFFLINE`; status `offline` |
| 12 | Corrupt checkpoint | 503 | `MODEL_UNAVAILABLE`; status `degraded`, `CHECKPOINT_SIZE_MISMATCH` |
| 13 | 5 repeated predictions | 200 | identical scores; 300–415 ms inference |
| 14 | Slow inference / burst | 504 / 429 | timeout covered by pytest; burst of 6 → 2 served, 4 × `INFERENCE_BUSY` |
| — | Unsupported crop id | 422 | `CROP_UNSUPPORTED` |

## In a real browser

Headless Edge via DevTools Protocol: page load → status badges → crop dropdown → file attach → click → result (desktop Tomato: Late blight in 1.35 s; mobile 390 px, auto crop: corn photo → model-inferred crop shown). Network log: `/api/v1/diagnosis/status` 200, `/api/v1/crops` 200, `/api/v1/diagnosis` 200. No horizontal overflow.

## Automated suites

| Command | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors (40 pre-existing warnings in template files) |
| `npm test` | 10 files, 40 tests pass (13 new in `tests/unit/diagnosis.test.ts`) |
| `npm run build` | pass; `/dev/model-lab` prerendered as 404 in production |
| `pytest ai/services/inference/tests` | 50 pass (real model, ~24 s) |
| `python -m unittest discover -s ai/models/agrismart-india/tests` | 10 pass |
| `scripts/verify_runtime.py` | PASSED, parity with original upstream predictor |

## Local field evaluation

Not performed: no labelled local field photos exist yet. The four upstream samples are smoke tests only (3/4 correct). Upstream metrics (clean test macro-F1 0.906; crop given 0.926; field photos 0.744 / 0.857 with crop) are the authors' numbers and are kept separate from anything measured here.
