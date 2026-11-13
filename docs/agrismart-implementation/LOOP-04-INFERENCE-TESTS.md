# Loop 4 — Real model inference

Status: **passed**. CPU, 4 threads, torch 2.15.0+cpu, timm 1.0.31. Raw data: [`evidence/pytest-real-model-results.json`](evidence/pytest-real-model-results.json), [`ai/models/agrismart-india/reports/runtime-verification.json`](../../ai/models/agrismart-india/reports/runtime-verification.json).

## Upstream predictor audit

| Aspect | Upstream `model/india/predict.py` | Ours |
|---|---|---|
| Checkpoint load | `weights_only=True`, **falls back to `weights_only=False` (arbitrary pickle) on any error** | `weights_only=True` only, after size + SHA-256 check. No fallback |
| Weight lookup | searches 4 relative paths | one explicit path (`AGRISMART_MODEL_PATH` or default) |
| Image input | file path, PIL image or **any http(s) URL** | validated bytes only (JPEG/PNG/WebP, ≤ 8 MiB, ≤ 20 MP, ≥ 64 px, single frame), EXIF orientation applied, metadata dropped |
| Preprocessing | timm bicubic, crop_pct 0.9, 224, checkpoint mean/std | identical |
| TTA | mean of original + horizontal flip softmax | identical |
| Crop conditioning | zero other crops, renormalise | identical, plus raw global scores and per-crop mass |
| Model caching | `lru_cache` | loaded once per process in a single worker thread |
| Device | CPU | `cpu` / `cuda` / `auto` |

**Parity:** on all 4 samples our scores equal the original upstream `predict_proba` within 1e-5 (run with the unsafe fallback patched out). Automated in `tests/test_model_loading.py::test_parity_with_original_upstream_predictor`.

## Results on real photos (crop hint given)

| Photo (PlantDoc, CC BY 4.0) | Ground truth | Top prediction | Score | 2nd | Inference |
|---|---|---|---|---|---|
| tomato_late_blight_1.jpg | Tomato late blight | **Late blight** ✔ | 0.715 | Early blight 0.218 | 292 ms |
| potato_early_blight_1.jpg | Potato early blight | **Early blight** ✔ | 0.990 | Late blight 0.008 | 406 ms |
| tomato_healthy_1.jpg | Tomato healthy | **Healthy** ✔ | 0.961 | Mosaic virus 0.021 | 303 ms |
| corn_common_rust_1.jpg | Corn common rust | **Gray leaf spot** ✘ | 0.614 | Common rust 0.267 | 291 ms |

Without a crop hint: tomato late blight 0.46 (global), potato early blight 0.756, tomato healthy 0.866, corn → `banana::Insect pest damage` 0.20 (corn classes 2nd/3rd). The corn miss is the model's behaviour (the original upstream code gives the same answer) and the `CROP_MISMATCH` advisory fired. **4 photos are a smoke test, not an accuracy measurement.**

## Degraded and invalid inputs

| Input | Outcome |
|---|---|
| Gaussian-blurred tomato | still predicts Late blight; `POSSIBLY_BLURRY` warning (sharpness 10.2 vs 59.8–595.6 for real photos) |
| Darkened tomato (×0.12) | `TOO_DARK`; scores degrade (0.51 vs 0.72) |
| 96 px thumbnail | `LOW_RESOLUTION` |
| Synthetic gradient / checkerboard | returns *some* class with top global score 0.03–0.04 → `LOW_GLOBAL_EVIDENCE` |
| Real non-plant photo (training-curve chart) | top global score 0.0996 → `LOW_GLOBAL_EVIDENCE` (borderline!) |
| Text file named .jpg | 422 `IMAGE_INVALID` |
| GIF | 415 `IMAGE_FORMAT_UNSUPPORTED` |
| 32 px image, animated WebP | 422 `IMAGE_DIMENSIONS_OR_ANIMATION_INVALID` |

## Load and latency

- Model loads once: 5.6 s (host), 7.8 s (Docker), incl. SHA-256 and warm-up; asserted by `test_real_model_loaded_once_and_reused`.
- Inference 275–440 ms per photo on CPU (two forward passes due to mirror TTA). Five repeated runs return identical scores.
- Container RSS ≈ 640 MiB while serving.

## Uncertainty policy (honest limits)

- Every result has `assessment.status = REVIEW_REQUIRED`. Scores are softmax outputs, not calibrated probabilities.
- Upstream `test_predictions.csv` contains labels but **no probabilities**, so a confidence threshold could not be calibrated from upstream data.
- Evidence-based advisories: `WEAK_CROP_UPSTREAM` / `WEAK_CLASS_UPSTREAM` when the upstream per-crop macro-F1 or per-class precision is < 0.80 (from `report_per_crop.csv` / `report_per_class.csv`).
- Model-derived: `CROP_MISMATCH` when the global crop argmax differs from the user's crop.
- Heuristic (labelled `basis: heuristic`): image-quality warnings and `LOW_GLOBAL_EVIDENCE` (< 0.10). These only **add** warnings and never change outputs. The 0.10 line is provisional — the real chart scored 0.0996 — and needs a labelled out-of-distribution set.
