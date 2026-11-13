# Model card: AgriSmart India v1

Status: upstream-reported model facts; local suitability and rights review pending.

Repository: https://github.com/wpzvqrs8/SIH_2026 ; release [india-model-v1](https://github.com/wpzvqrs8/SIH_2026/releases/tag/india-model-v1). Model authors: upstream contributors; acknowledge dataset authors separately. Backbone `vit_base_patch14_dinov2.lvd142m`, input 224px, 59 crops and 387 disease/condition classes. A condition can represent healthy, pest or deficiency as well as disease; the model is not a general pest species detector.

Upstream training: 238,028 images; nominal test 28,328; 80 dataset sources; 85/15 near-copy-grouped split; 428 test images with a near twin at cosine >=0.95 removed from headline clean set. PlantVillage lab, PlantWild field, AgML mirrors and Kaggle research sources have mixed licence/provenance/label quality. Training photographs are not redistributed by this preparation.

| Evaluation (upstream only) | Images | Macro-F1 | Accuracy |
|---|---:|---:|---:|
| Clean test | 27,900 | 0.905811 | 0.928746 |
| Clean, crop given | 27,900 | 0.925824 | 0.941470 |
| Field (PlantWild) | 2,983 | 0.744203 | 0.746899 |
| Field, crop given | 2,983 | 0.856850 | 0.850486 |
| Lab (full subset) | 4,853 | 0.996719 | 0.996085 |

These are factual values from `metrics.json`, not independently reproduced by us. Upstream target clean macro-F1 0.95 was not met. Core model v2 and offline quantized agreement scores do not describe India v1 performance. Do not quote latency/RAM claims from the ONNX/core backend for this PyTorch ViT-B service.

Intended candidate use: non-commercial research/education assessment experiments with human review, subject to dataset/usage review. Not approved here for commercial redistribution, unattended spraying, definitive disease diagnosis, severity or outbreak forecasting. Closed-set softmax can be confident on non-leaf/unsupported inputs. Similar crops/conditions, uneven class support, field/lab shift, lighting and device variation limit usefulness. Crop conditioning can inflate confidence when the crop is wrong; retain global crop evidence and support correction.

Preprocessing contract: RGB, checkpoint normalization, timm bicubic transform at 224px, crop fraction 0.9, original/mirror softmax averaging; no logit averaging. Loader requires verified SHA and `weights_only=True`, validates architecture/taxonomy and strict state dict. Local orientation/metadata sanitation differs from upstream's raw decoder and requires parity review.

Licence: authors state non-commercial research and education. Some source datasets have non-commercial, no-derivatives or share-alike conditions; no root code licence is declared. This card does not grant rights or resolve derivative-weight questions. No advice/translation is verified by model accuracy. Local labelled field validation, approved guidance and reviewed language are mandatory before a pilot.
