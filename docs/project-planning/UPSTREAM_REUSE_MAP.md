# Selected upstream integration map

Status: metadata/original adapter prepared; external source/assets not vendored. Full path-by-path reasoning, dependencies, licence gates and targets are in [03-upstream-reuse-audit.md](../upstream-integration/03-upstream-reuse-audit.md).

| Source | Selected destination / disposition | Status |
|---|---|---|
| India v1 release `model.pt` | `ai/models/agrismart-india/checkpoints/model.pt`, ignored | Download + SHA verification tracked in validation report; not evidence of successful inference |
| `model/india/weights.json` | `ai/models/agrismart-india/weights.json` factual manifest | Re-expressed with source revision/restrictions |
| `model/india/metrics.json`, `crops.json` | Same names under model directory | Attributed factual snapshots; 59/387 taxonomy verified |
| `model/india/predict.py` | Own `ai/models/agrismart-india/predict.py` | Independent strict implementation from documented math; original code licence unresolved |
| India crop ambiguity/result semantics | Inference contract and future field policy | Design adaptation; global vs conditional evidence preserved |
| Quality/camera/upload UX | Frontend route/component/state plans | Reference only; own implementation later |
| Draft translations/advice/treatments | Recommendations review register | No text imported/exposed; native/agronomic/rights review pending |
| Samples and India reports | `tests/README.md`, `reports/README.md` links | Remain in sibling; no photo/report asset copied |
| Offline ONNX/WASM/audio | Future offline/voice ADR references | No binaries, Android/Gradle or dependencies imported |
| Existing backend/frontend | API/DevOps lessons only | No competing backend or web application copied |

All adopted AI implementation is inside existing `/ai`. `/backend/README.md` establishes application-domain ownership; generic `/server` and `/modules` remain. Source provenance hashes are recorded in `ai/models/agrismart-india/SOURCE_PROVENANCE.md`; complete upstream files/directories/blob inventory and release metadata are under `docs/upstream-integration`.

No repository-wide source licence exists in the audited tree; public code is not treated as freely redistributable. Model is explicitly NC research/education, datasets have mixed additional conditions; intended demo/distribution needs review. Independently written integration code does not remove model/data restrictions. User changes and the ignored original project-brain remain preserved.
