# AgriSmart India v1 local integration

The genuine India v1 checkpoint is installed and SHA-256 verified. The original `model/india`, full `model/training`, reports, samples and model documentation are installed inside this project under `upstream/`. A private FastAPI service lives in `ai/services/inference`; farmer-facing features remain separate future work. Check [validation](../../../docs/upstream-integration/05-validation-and-changes.md) and `reports/runtime-verification.json` for actual runtime outcomes.

59 crops, 387 disease/condition classes, DINOv2 ViT-B/14, 224px. The model is an initial screening candidate, not laboratory diagnosis, severity measurement or an open-set plant detector. All current adapter results require review; confidence thresholds are unvalidated.

Source and licence: [SOURCE_PROVENANCE.md](SOURCE_PROVENANCE.md), [MODEL_CARD.md](MODEL_CARD.md), [UPSTREAM_NOTICE.md](UPSTREAM_NOTICE.md). The model authors state non-commercial research/education use; underlying dataset/source redistribution restrictions need review. Original source and attributed sample photos are installed locally and excluded from Git redistribution; no upstream frontend/backend, translations, treatment text or audio was copied. Our strict adapter loads the real original checkpoint, preserving the documented mathematics while enforcing secure input/loading boundaries.

Download from project root:

```powershell
python ai/models/agrismart-india/scripts/download_weights.py
python ai/models/agrismart-india/scripts/download_weights.py --verify-only
python -m unittest discover -s ai/models/agrismart-india/tests -v
```

The exact pinned release goes into ignored `checkpoints/model.pt`. Partial files are never accepted; an existing invalid file is not overwritten. Keep model weights, personal images, Python environments and datasets outside version control. A receipt beside the checkpoint records hash/size but does not mark licence or prediction tests as passed.

The runtime Python environment is `ai/services/inference/.venv` (exact versions in `ai/services/inference/requirements.lock`). The older `.venv` in this folder only ever contained pip and is superseded. Keep training dependencies separate. For a real prediction from project root:

```powershell
.\ai\services\inference\.venv\Scripts\python.exe ai/models/agrismart-india/predict.py --image ai/models/agrismart-india/upstream/samples/tomato_late_blight_1.jpg --crop tomato --top 5
.\ai\services\inference\.venv\Scripts\python.exe ai/models/agrismart-india/scripts/verify_runtime.py
```

The verification script runs all four installed original samples, compares outputs against the installed original India predictor with unsafe pickle fallback prohibited, and exercises authenticated private API calls. It writes measured outcomes only after successful checks. Model is instantiated once per bounded worker, not per HTTP request. Missing/invalid checkpoint is a hard error, no mock/other-model fallback. CLI accepts a local path; private service accepts validated bytes, never arbitrary URLs.

`crops.json` is a catalogue, not the head's index order; use checkpoint labels/crop_classes. Scores include both raw global and selected-crop conditional evidence. Preprocessing uses checkpoint mean/std, timm bicubic crop0.9, 224px and average original/mirror softmax. Orientation is normalized and EXIF dropped at our new input boundary; record this difference in parity evaluations.

Image constraints: JPEG/PNG/WebP, <=8 MiB encoded, <=20 million pixels, single frame, minimum side 64px. These are engineering safeguards, not agronomic quality validation. No leaf/OOD or calibrated uncertainty detector exists here. FastAPI: [README.md](../../services/inference/README.md), [CONTRACT.md](../../services/inference/CONTRACT.md). Restore/check the original source install with `python ai/models/agrismart-india/scripts/install_upstream.py`; source clone stays unchanged.


## Status (2026-11-13)

Real inference verified: parity with the original upstream predictor, served by `ai/services/inference` and used by Next.js `/api/v1/diagnosis`. Results, limits and run instructions: [docs/agrismart-implementation](../../../docs/agrismart-implementation/README.md). `predict.py` now supports `device="cpu"|"cuda"|"auto"`, `predict_image()` for pre-decoded images and returns `globalTop`. `reports/upstream_evaluation.json` holds the upstream per-crop/per-class test metrics (regenerate with `scripts/export_upstream_evaluation.py`).
