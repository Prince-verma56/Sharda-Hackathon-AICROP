# AI model integration

Status: India v1 selected for preparation; readiness/rights/field validation unresolved. No independent accuracy results claimed.

Candidate: 59 crops, 387 disease/condition classes, DINOv2 ViT-B/14, input 224px. Release `india-model-v1`, checkpoint 344,160,243 bytes, SHA-256 `ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a`. See pinned manifest and SOURCE_PROVENANCE.md. The release tag lacks later committed inference metadata, so reference source is separately pinned at `9db1605a7c9fdc989f51320ae4970f6a1d8fd255`.

```text
ai/
  models/agrismart-india/
    README.md  MODEL_CARD.md  SOURCE_PROVENANCE.md
    predict.py  weights.json  metrics.json  crops.json  requirements.txt
    checkpoints/model.pt                  # ignored, verified local artifact
    scripts/download_weights.py
    reports/README.md  tests/test_preparation.py  tests/README.md
  services/
    inference/CONTRACT.md                 # FastAPI implementation later
    weather/README.md
    recommendations/README.md
  agents/  context/  conversation/  core/  generation/
  guardrails/  memory/  observability/  prompts/  providers/
  rag/  tools/  voice/  workflows/  mcp/   # existing; extend, do not duplicate
```

Original strict adapter preserves documented timm bicubic/crop0.9/checkpoint mean/std preprocessing and horizontal-mirror softmax averaging. It verifies checkpoint hash before loading, requires 224px/ViT-B/387/59 metadata and validates label-index partition. It uses `torch.load(weights_only=True)` without unsafe fallback, requires exact local bytes rather than arbitrary URLs, rejects unsupported crop keys, and retains global scores before crop conditioning. New image boundary limits encoded bytes/pixels/formats, rejects animation/small inputs, handles orientation and removes metadata.

`crops.json` is a menu/taxonomy snapshot, not the ordered model-head label list. The checkpoint's labels/crop index mapping is authoritative. No retraining, checkpoint conversion, original-source vendoring or ONNX model is introduced. Python requirements are isolated proposed ranges, not an experimentally verified lock. Upstream root/backend requirements target ONNX and omit torch/timm; do not copy them into this PyTorch adapter blindly.

Download/verify command: `python ai/models/agrismart-india/scripts/download_weights.py`. It refuses to replace any existing invalid checkpoint, writes a unique partial file, validates size/hash, then atomically promotes it; checkpoints and receipts are ignored. Hash verification proves artifact identity, not licence clearance or model suitability. Actual download and validation outcome is recorded in the validation document.

Preparation checks: `python -m unittest discover -s ai/models/agrismart-india/tests -v`. Future runtime: isolated Python env, compatible CPU torch/torchvision + timm/Pillow lock, load once in a single bounded worker, private FastAPI `/health`, `/ready`, `/v1/model/metadata`, `/v1/predict`. Do not add ML packages to package.json or expose the service token to the browser.

Upstream field results are materially below lab results; see MODEL_CARD.md and full metrics. Current adapter always returns `REVIEW_REQUIRED` because no local confidence/OOD policy is validated. Blur/darkness warnings do not establish a leaf or a supported disease. No severity inference; closed-set high confidence can still be wrong. Compare upstream and adapter outputs on the same inputs/dependencies, then evaluate held-out expert-labelled field photos by crop/condition and phone/light context. Only then approve uncertainty thresholds and farmer wording.

Open gates: code/model/dataset rights review, isolated runtime dependency resolution, strict checkpoint load, inference parity and latency/memory measurement, local field evaluation, unsupported-image/OOD approach, chosen pilot crops and expert signoff. No Vapi or application inference endpoint is enabled by this file.
