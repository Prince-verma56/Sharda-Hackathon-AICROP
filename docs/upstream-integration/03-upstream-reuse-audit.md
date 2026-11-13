# Upstream reuse and integration decisions

Status: audit complete; preparation-only decisions below. Reference revision: `9db1605a7c9fdc989f51320ae4970f6a1d8fd255`. Path links use https://github.com/wpzvqrs8/SIH_2026/tree/9db1605a7c9fdc989f51320ae4970f6a1d8fd255 . All imported factual metadata has SHA-256 provenance in `ai/models/agrismart-india/SOURCE_PROVENANCE.md`.

## Findings that change the integration

India v1 uses `vit_base_patch14_dinov2.lvd142m`, 224px, checkpoint-provided mean/std, timm bicubic transform with crop fraction 0.9, averaging original and horizontally flipped **softmax distributions**. Crop conditioning masks and renormalizes the distribution. The model is closed-set; confidence cannot establish that a photo contains a supported plant. Unknown crop input is silently ignored upstream; our boundary must reject it.

Keep global scores before conditioning. Otherwise a wrong crop choice produces falsely reassuring confidence. Live server aggregates global scores by crop, uses share/margin heuristics (0.50/0.35), and mismatch mass 0.15. Offline disease uncertainty threshold 0.28 and grayscale darkness/sharpness warnings are heuristics, not validated acceptance thresholds. Our preparation conservatively marks predictions `REVIEW_REQUIRED` until field evaluation calibrates the policy.

The upstream ONNX backend is not an equivalent drop-in implementation: `backend/app/predictor.py` stretches the full image to 224x224 with hardcoded normalization, whereas the India PyTorch/export pipeline uses shorter-side resize/centre crop and checkpoint normalization. Its formatted `raw_label` also inserts a literal `$` before the condition. Runtime download extracts an ONNX file from the offline zip without verifying the published archive hash. Do not assume its memory claims, labels or predictions reproduce the selected checkpoint. The original India predictor itself has an unsafe `weights_only=False` fallback and arbitrary URL decoding; both are excluded from our adapter.

Android decisions/specifications describe older flows and downloads; actual `app/build.gradle.kts` synchronizes offline web assets and MainActivity hosts WebView behaviour alongside native screens. Statements about on-device inference in DECISIONS.md are not sufficient evidence that every native CameraX workflow executes the downloaded PyTorch checkpoint. We did not build or run Android, and do not copy its deployment/debug signing.

Upstream India metrics: clean test 27,900, macro-F1 0.905811 and accuracy 0.928746; field 2,983, macro-F1 0.744203 and accuracy 0.746899; field with crop macro-F1 0.856850 and accuracy 0.850486. Target clean macro-F1 0.95 was not met. These are **upstream-reported**, not our evaluation. Core model reports and quantized agreement percentages measure different things.

## A: directly reusable factual metadata and candidate model asset

| Source | Purpose / value | Decision and target | Dependencies / modifications | Licence / release gate |
|---|---|---|---|---|
| `model/india/weights.json` | Release locator, size and original SHA-256 | Record factual manifest at `ai/models/agrismart-india/weights.json`; download exact asset into ignored `checkpoints/` | Standard-library downloader; verify size/hash before promotion; never auto-fetch at request time | Upstream says non-commercial research/education; underlying datasets have mixed restrictions; no blanket commercial grant |
| `model/india/metrics.json` | Version-specific evaluation facts | Preserve machine-readable metrics at `ai/models/agrismart-india/metrics.json` | No runtime dependency; mark as upstream-only; do not advertise as own results | Factual report retained with attribution; redistribution/use review still required |
| `model/india/crops.json` | 59-crop disease catalogue | Factual taxonomy snapshot at `ai/models/agrismart-india/crops.json` | Validate 59/387, stable crop keys; **not class-index order**; loaded checkpoint is authoritative for indices | Attribution; not a verified disease guidance database |

## B: independent adaptations into existing architecture

| Source | Function / value | Decision and target | Dependencies / required changes | Licence restriction |
|---|---|---|---|---|
| `model/india/predict.py` | Checkpoint inference, timm preprocessing, TTA, crop mapping | Reference algorithm; author own strict `ai/models/agrismart-india/predict.py` | Separate torch/timm/Pillow env; checksum first; `weights_only=True` only; exact path; no network image URLs; no fallback to other model; expose raw + conditioned scores | No repository-wide source licence found; **do not vendor original source** pending permission |
| `server/live_camera_india/live_camera_india.py` | Crop scores and mismatch/ambiguity handling | Document semantics in `ai/services/inference/CONTRACT.md`; original result policy | Preserve global mass and selected-crop distribution, top-k, warnings; calibrate thresholds on field images | Reference only; independent implementation, no source copy |
| `offline/web/app.js` quality/capture flow | Darkness/blur warnings, still capture, pause and replay | Camera/quality specification in planning; future own shadcn components and Python decoding | Browser camera permissions, rear-camera preference, retake; bounded decode; no leaf/OOD claims from blur checks | No JS source imported |
| `server/live_camera_india/india_translations.json` | 13-language crop/UI/disease draft | Review register in `ai/services/recommendations/README.md`; future approved locale bundles | Native speaker + agronomist review by key/version; six languages contain phonetic disease renderings; RTL for Urdu | No source licence declared; no translated text imported/published |
| `server/live_camera_india/build_advice.py`, `india_advice.json` | Disease-group advice generation | Quarantined reference; future original expert-approved knowledge records | Must verify crop, region, source, effective date, product label and expert approval; no default drug/dose fallback | Explicitly draft and not agronomist-reviewed; **not safe to expose** |

## C: reference only

| Source | What / why useful | Target plan | Dependencies and required work | Licence / caution |
|---|---|---|---|---|
| `samples/README.md`, `samples.csv`, four JPEGs | Attributed examples for smoke evaluation | `ai/models/agrismart-india/tests/README.md` references sibling photos without copying | Map core labels to India crop keys; record prediction and reviewer truth | PlantDoc CC BY 4.0 per source notice; retain author/DOI/path if later redistributed |
| `model/india/report_per_class.csv`, `report_per_crop.csv`, `test_predictions*.csv`, `report/results/india_v1_*`, figures | Weak crops and confusions, evaluation reproducibility | `ai/models/agrismart-india/reports/README.md` links | Do not copy bulky prediction tables or v2 matrices into v1 results; field/time-separated local evaluation needed | Source attribution; images/tables not copied |
| `model/training/india/**`, core training scripts | Dataset construction/leakage guards | Future evaluation/training phase | Kaggle, datasets, GPU; check every dataset's terms; no runtime training | Mixed CC BY/NC/ND/SA sources; no training data redistribution |
| `offline/tools/export_onnx.py`, `offline/web/models/models.json`, `offline/web/ort/README.md` | Quantization/export and label metadata | Future offline ADR | ONNX, ONNX Runtime/Web, WASM; benchmark parity, memory/latency on devices; tools have hardcoded author paths | ORT MIT notice; model restrictions remain; agreement is not accuracy |
| `offline/tools/build_audio.py`, `build_offline_data.py`, `offline/README.md` | Pre-rendered multilingual TTS | Voice/offline reference section | MMS voices, cached audio, native review, explicit download consent | MMS CC BY-NC 4.0; recordings unreviewed; do not import audio |
| `app/src/main/java/com/agrismart/app/feature/scan/**`, repositories, assets/mock | Camera permission, crop confirmation, busy/error states | Farmer component/route state inventory | Rebuild in React/shadcn; distinguish mock fixtures from real predictions | No Kotlin/assets copied |
| `docs/android_app_prompt.md`, `docs/guide.md`, `DECISIONS.md` | UX/training choices | Product/open-decision references | Verify against actual code; decisions may be stale | No wholesale documentation copy |
| `backend/app/main.py`, `predictor.py`, Docker/Render files, `main.py`, `server/live_camera/**` | API/hosting patterns and pitfalls | Inference contract and DevOps plan | Private FastAPI only; not a replacement Node backend | No backend copied; missing auth, wildcard credentialed CORS, URL-fetch SSRF risk, raw traceback disclosure, unverified runtime zip extraction |
| `webapp/**`, `backend/webapp/**`, `app/src/main/assets/web/**` | Camera/upload/result/audio layout | Frontend route/design plan | Use existing shadcn library and private history; avoid unconsented sharing | No frontend/branding copied; stale class counts and duplicate assets |

## D: do not integrate

Android/Gradle build system, APK/debug signing, duplicate vanilla web frontends, core ViT-S checkpoint, India v2 checkpoint, automatic mock fallback, generic treatment string matching (`backend/app/treatments.py`), public image-URL prediction, Wikipedia/Google Lens as treatment authority, bundled WASM/audio/model blobs, upstream Render application and unrelated training dependencies. They conflict with the selected scope or add unverified behaviour. Keep them intact in the sibling reference.

## Licence disposition

GitHub metadata reports licence `null`; no root LICENSE/COPYING file is tracked. Public visibility is not a source-code reuse grant. Record small factual metadata with provenance and author original integration code; leave source/assets unvendored. Model authors explicitly state non-commercial research/education use, with several non-commercial datasets including PlantWild restrictions. Technical checkpoint verification is separate from licence approval. Hackathon redistribution, sponsored use, production use and downstream derivative rights require review before activation. This task does not resolve those permissions or independently verify agricultural advice.
