# Loop 8 — Docker

Status: **passed** — image built, container healthy, full Next.js E2E run against it.

## Image

`ai/services/inference/Dockerfile` (context: repo root), `ai/services/inference/Dockerfile.dockerignore` (BuildKit per-Dockerfile ignore; sends only the files the image copies).

- `python:3.12-slim`, CPU torch 2.15.0 / torchvision 0.29.2 from the PyTorch CPU index, other runtime deps from `requirements.txt` (ranges; tests excluded).
- Copies only `app/`, `predict.py`, `weights.json`, `scripts/download_weights.py`, `reports/upstream_evaluation.json`. **No weights, datasets, notebooks or samples.**
- Non-root user (uid 10001), `HEALTHCHECK` on `/ready`, Swagger off by default.
- Size: 1.69 GB (CPU torch dominates).

## Compose

Added to the template's existing `docker/compose.ai.yaml` (which was `services: {}` and documented as the place for AI services). The older `compose.crop.*.example.yaml` files are left as they were.

- Checkpoint bind-mounted read-only: `../ai/models/agrismart-india/checkpoints/model.pt:/models/model.pt:ro` (one copy on disk).
- Published on **loopback only** `127.0.0.1:8001` so host-run `next dev` can reach it.
- `read_only`, `tmpfs /tmp`, `no-new-privileges`, `cap_drop: ALL`, `mem_limit: 3g`.
- No Redis dependency: there is no concrete need yet. A future cache key would be `sha256(image) + crop + model_sha256`, storing results only (never raw images).

```powershell
docker compose --env-file .env.local -f docker/compose.ai.yaml up -d --build --wait ai-inference
```

`--build` is required after changing the Dockerfile, requirements or copied code.

## Results

| Check | Result |
|---|---|
| `docker compose … config --quiet` | ok |
| `up -d --wait` | healthy in 12 s; model loaded in 7.8 s |
| Next.js E2E against the container | identical predictions/scores to host run ([evidence](evidence/e2e-next-to-docker-fastapi.json)); inference 320–440 ms |
| Burst of 6 concurrent uploads | 2 × 200, 4 × `429 INFERENCE_BUSY`; memory flat at ~640 MiB |

GPU containers would need a CUDA base image and the NVIDIA container toolkit; CPU works everywhere. Kubernetes is deferred.
