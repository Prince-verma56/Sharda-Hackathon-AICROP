# Source provenance

Status: genuine checkpoint verified; original model/training/report/sample materials installed locally after the user's follow-up request for real integration. Source/model redistribution-rights approval remains pending.

Audit: 2026-11-13. Author attribution: wpzvqrs8/SIH_2026 contributors; dataset authors retain their rights.

Reference revision: `9db1605a7c9fdc989f51320ae4970f6a1d8fd255`.

| Upstream path | SHA-256 of source bytes | Disposition |
|---|---|---|
| `model/india/weights.json` | `706f4821a680c08261f75e76599775cfccc27a990bcea862f1cca9c9d3e4218b` | Factual manifest re-expressed with source/restrictions |
| `model/india/metrics.json` | `96d6fd620a38d2d291586808fbb165c82bae9b848d846a4cc3bd75d43d321d67` | Factual JSON snapshot; upstream-reported |
| `model/india/crops.json` | `6d98a0ecdf73c249219a9a7f3cc56b880836699f453bfd3cc989092774a39061` | Factual JSON snapshot; upstream-reported |
| `model/india/predict.py` | `6d9ba5f7048af92fc4bf92fde83ce866adc4c51ca705bfdcf9b6626c1f5d42aa` | Original adapter authored independently, no source copy |
| `model/india/README.md` | `48ae130d939e50a900e442deded1774590fa1ae55a5b2fe3c94d809900402e69` | Reference only |

Upstream: https://github.com/wpzvqrs8/SIH_2026/tree/9db1605a7c9fdc989f51320ae4970f6a1d8fd255/model/india

Checkpoint: https://github.com/wpzvqrs8/SIH_2026/releases/tag/india-model-v1

Expected checkpoint SHA-256: `ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a`; 344,160,243 bytes. Verification receipt lives beside the ignored checkpoint; see validation report for actual outcome.

The release tag predates committed India inference metadata. Source revision and checkpoint identity are pinned independently. CRLF in this Windows checkout can change text hashes relative to Git blob bytes; hashes above identify actual audited local bytes.

No repository-wide LICENSE is tracked. The model README/release state non-commercial research and education with mixed source dataset licences. This is not a blanket licence for original software or commercial deployment. `UPSTREAM_INSTALLATION.json` records 62 actual original model/training/report/sample/document files installed under ignored `upstream/`; `UPSTREAM_NOTICE.md` preserves restrictions and sample attribution. No upstream application frontend/backend, Android/Gradle, translations, treatment text or audio was imported. Licence review remains necessary before public redistribution or farmer rollout.

Preprocessing and crop conditioning follow upstream documented mathematical behaviour. Our adapter removes unsafe pickle fallback, arbitrary image URL fetch, implicit weight lookup and silent unsupported-crop fallback. The runtime verification report records real-checkpoint execution and original-predictor parity when completed; this is distinct from independent field validation.
