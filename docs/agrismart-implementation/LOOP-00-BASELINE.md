# Loop 0 — Baseline

Date: 2026-11-13. Status: **passed**.

## Working tree at start

```text
## main...origin/main
 M .gitignore                      (user change: ignores /crop-doctor-project-brain)
?? ai/models/  ai/services/  ai/prompts/system/crop-assistant.preparation.md
?? ai/voice/crop-assistant.*.json  backend/  docker/compose.crop.*.example.yaml
?? docs/project-brief/  docs/project-planning/  docs/upstream-integration/
?? scripts/render-crop-brief.py
```

All untracked items came from an earlier preparation session. Nothing was reset, cleaned or overwritten.

## What already existed (reused)

| Item | State found | Reused how |
|---|---|---|
| `C:\Development\SIH_2026-upstream-reference` | Full clone, clean, tags present | Kept unchanged as the upstream reference (Loop 1) |
| `ai/models/agrismart-india/checkpoints/model.pt` | 344,160,243 bytes, SHA-256 matches v1 manifest | Canonical checkpoint (hard-linked with `upstream/model/india/model.pt`, so one copy on disk) |
| `ai/models/agrismart-india/predict.py` | Strict adapter: safe `weights_only=True` load, size/SHA check, taxonomy validation, image decoding limits | Kept as the single model implementation; extended with device selection and `predict_image()` |
| `ai/models/agrismart-india/scripts/*`, `tests/` (10 unit tests) | Downloader, upstream installer, runtime verifier | Kept; `verify_runtime.py` updated to the new service |
| `ai/services/inference/app.py` | Single-file FastAPI prototype with token auth and body cap, **never run** (no torch) | Logic ported into the new `app/` package; file archived to `_archive/prototype-v0/` |
| `docs/upstream-integration/01–05`, `docs/project-planning/*` | Audits and plans | Referenced, not duplicated |
| `crop-doctor-project-brain/` | Ignored, user-owned | Only appended to (ADR + results) |

## Gaps found

1. `ai/models/agrismart-india/.venv` contained only `pip` — torch/timm/FastAPI were never installed, so **no real inference had ever run**.
2. `node_modules` absent → `typecheck`, `lint`, `test`, `build` could not run.
3. No Next.js integration, no API routes, no testing UI.
4. No Dockerfile; compose files were unactivated examples.
5. The template could not start at all without Clerk keys (proxy and `ClerkProvider` throw).

## Environment

Windows 11, Python 3.12.10, Node 24.20.0, npm 11.19.0, Docker 29.9.2, NVIDIA GTX 1650 (4 GB). Next.js 16.3.8, React 19.2.8.
