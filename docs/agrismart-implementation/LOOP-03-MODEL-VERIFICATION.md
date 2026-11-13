# Loop 3 — Model verification and consolidation

Status: **passed**.

## Canonical checkpoint

| Field | Value |
|---|---|
| Release | `india-model-v1` — https://github.com/wpzvqrs8/SIH_2026/releases/tag/india-model-v1 |
| Path | `ai/models/agrismart-india/checkpoints/model.pt` (git-ignored) |
| Size | 344,160,243 bytes (matches manifest) |
| SHA-256 | `ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a` (matches manifest; verified on every load) |
| Architecture | `vit_base_patch14_dinov2.lvd142m`, 224 px, 387 outputs; 59 crops |
| Duplicates | `upstream/model/india/model.pt` is a **hard link** to the same file (link count 2) — no extra disk use |

The existing file was valid, so nothing was re-downloaded. The experimental v2 checkpoint was never used.

## Layout

```text
ai/models/agrismart-india/
├── checkpoints/model.pt            ignored, verified
├── predict.py                      single model implementation (CLI + library)
├── weights.json  crops.json  metrics.json
├── README.md  MODEL_CARD.md  SOURCE_PROVENANCE.md  TRAINING.md  UPSTREAM_NOTICE.md
├── reports/upstream_evaluation.json   new: upstream per-crop / per-class test metrics
├── reports/runtime-verification.json  measured by scripts/verify_runtime.py
├── scripts/  download_weights.py  verify_runtime.py  install_upstream.py  export_upstream_evaluation.py
├── tests/    10 unit tests
├── upstream/ ignored local copy of upstream model/, samples/, reports
└── .venv/    OLD, pip-only, ignored — superseded (see below)
```

## Python environment

New environment: `ai/services/inference/.venv` (Python 3.12.10). Exact versions in `ai/services/inference/requirements.lock`: torch 2.15.0+cpu, torchvision 0.29.2+cpu, timm 1.0.31, Pillow 11.3.0, numpy 2.5.4, fastapi 0.162.5, uvicorn 0.54.0, pydantic 2.14.3.

The old `ai/models/agrismart-india/.venv` only ever contained `pip`. It was **not deleted** (per the safety rules); it is git-ignored and can be removed by the owner.

CPU wheels were installed even though a GTX 1650 is present: the CUDA wheels are ~2.5 GB and CPU inference is ~300 ms. The code supports `AI_INFERENCE_DEVICE=cuda|auto` once a CUDA build of torch is installed.

## Ignore rules

`ai/models/.gitignore`: checkpoints, `.venv`, `__pycache__`, `*.pt/*.pth/*.onnx/*.safetensors`, partial downloads, `upstream/`.
`ai/services/.gitignore`: `.venv`, `__pycache__`, `*.pyc`, local test result dumps.
Root `.gitignore` already covers `.env` / `.env.local` at every level.
ESLint now ignores `**/.venv/**` and `ai/models/**/upstream/**` (torch ships JS files that broke `npm run lint`).

## Licence

Non-commercial research and education only (upstream statement; several training datasets are NC). No training photos are redistributed; sample photos are served locally and not committed. Commercial or public deployment requires a licence review first.
