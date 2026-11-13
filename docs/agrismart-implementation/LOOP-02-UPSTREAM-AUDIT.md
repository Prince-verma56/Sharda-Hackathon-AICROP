# Loop 2 — Upstream audit and reuse matrix

Status: **passed**. Detailed earlier audit: [03-upstream-reuse-audit.md](../upstream-integration/03-upstream-reuse-audit.md). This file records what was actually adopted in the implementation.

| Upstream (path) | Decision | Destination | Reason / licence note |
|---|---|---|---|
| India v1 weights (release `india-model-v1`, `model.pt`) | **Reuse** | `ai/models/agrismart-india/checkpoints/model.pt` (ignored) | The selected model; non-commercial research/education |
| `model/india/weights.json` | Reuse (facts) | `ai/models/agrismart-india/weights.json` | URL, size, SHA-256 |
| `model/india/predict.py` | **Audit → adapt** (not vendored) | `ai/models/agrismart-india/predict.py` | Same maths (timm bicubic, crop_pct 0.9, 224 px, checkpoint mean/std, mirror TTA, crop renormalisation). Parity verified to 1e-5. Removed: unsafe pickle fallback, URL fetching, silent path search |
| Checkpoint `labels` / `crop_classes` | Reuse (authoritative taxonomy) | read at load time | 59 crops / 387 classes; validated on load |
| `model/india/crops.json`, `metrics.json` | Reuse (snapshot) | `ai/models/agrismart-india/` | Catalogue + headline metrics |
| `model/india/report_per_crop.csv`, `report_per_class.csv` | **Reuse as evidence** | `ai/models/agrismart-india/reports/upstream_evaluation.json` via `scripts/export_upstream_evaluation.py` | Verbatim upstream test metrics with source SHA-256; drives reliability advisories |
| `samples/*.jpg` (PlantDoc) | Reuse with attribution, **not committed** | served dev-only from local `upstream/samples/` | CC BY 4.0 (Singh et al. 2020); attribution in model-lab tooltip |
| `model/training/**`, Kaggle kernel metadata | Retain as reproducibility reference | sibling clone only | Needs Kaggle/HF/GPU; mixed licences |
| India v2 experiment | **Not adopted** | — | Upstream: no gain (clean F1 0.902 vs 0.906; field 0.741 vs 0.744); v1 remains the release |
| Release `model-v2` (core ViT-S/14, 28 PlantVillage classes, field F1 0.714) | **Not adopted** | — | Different, narrower model (28 classes vs 387; no Indian crops such as rice, wheat, cotton, chilli). India v1 field F1 is 0.744 (0.857 with crop chosen) |
| `server/live_camera_india/india_translations.json` | Review later | — | 13-language draft; needs native-speaker + agronomist review |
| Disease guidance text in live-camera app | Not adopted | — | Unverified agronomic advice |
| Image validation in upstream server | Not adopted | own `decode_image` + quality heuristics | Upstream has no size/format/pixel limits |
| Android `app/`, `offline/`, `webapp/` | Reference only | — | Different product surfaces |
| `backend/`, `server/`, `main.py`, Render config | Reference only | — | Competing backend; we built our own FastAPI service |

No upstream source file was copied into the application. Facts and metrics are recorded with provenance; code is original integration code.
