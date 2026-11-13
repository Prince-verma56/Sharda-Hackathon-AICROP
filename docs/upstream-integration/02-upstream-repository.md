# Full upstream reference

Status: verified clone, 2026-11-13. Source: https://github.com/wpzvqrs8/SIH_2026.git

- Location: `C:\Development\SIH_2026-upstream-reference` (sibling of the application).
- Command: `git clone https://github.com/wpzvqrs8/SIH_2026.git ..\SIH_2026-upstream-reference`.
- Origin fetch/push: the source above. Branch `main`, clean working tree.
- HEAD: `9db1605a7c9fdc989f51320ae4970f6a1d8fd255`; 51 reachable HEAD commits. `--is-shallow-repository`: false. No sparse checkout requested.
- Tags: `india-model-v1` (`de4270e8dd46f4f69db753256aba87795ce9887b`), `model-v2` (`2acd47278c6e481596b1a36c267181d00845d510`), `offline-app-v1` (`8b06c616b5ac00d72c9a9e4a21f02ef6bbedc405`).
- GitHub releases API lists India v1 (2026-09-12), core model v2 (2026-09-11) and offline app v1 (2026-09-13). See `upstream-releases.json` for exact metadata and assets.
- Selected asset: India v1 `model.pt`, 344,160,243 bytes, SHA-256 `ffaffb1e3ca0a81831454e8268b11cf2d16b418838042b023ad188f79e61a08a`. Both release asset digest and HEAD `model/india/weights.json` agree.

## Important provenance discrepancy

The `india-model-v1` Git tag predates the committed India predictor/manifest: `git diff india-model-v1 HEAD -- model/india/predict.py model/india/weights.json` shows both added later. Pin the **release asset by checksum** and **reference source by HEAD SHA**, not by assuming the tag contains all metadata. Root README links mix a different fork (`Vatsal2008/AgriSmart-AI`), non-existent `models/` and `confusion_matrix/` folders and v2 claims. Our selected repository/releases, tracked inventory and India v1 metrics are authoritative for this preparation.

## Complete inventory

`upstream-files.txt` lists every tracked file; `upstream-directories.txt` lists every tracked directory; `upstream-inventory.json` records path, Git blob identity and size. Generated from the full local clone, excluding only Git internals. Binary files were inventoried without execution; sample photos and reports remain in the reference tree.

| Section | Contents and assessed purpose |
|---|---|
| `app/` | Kotlin Compose/CameraX client, repositories, fake API fixtures, model downloader, WebView assets and Android resources. `MainActivity.kt` also hosts offline web flow; not proof all historical native screens are wired. |
| `backend/` | FastAPI + ONNX service, generic treatment matcher, duplicate vanilla webapp, Render/Procfile/Docker configuration. Not our application backend. |
| `docs/` | Android UX specification and training/dataset guide. Reference requirements, not verified shipped functionality. |
| `gradle/` | Android version catalogue and Gradle 8.10.2 wrapper. Root build/settings/properties target Android, not Next.js. |
| `model/` | Core 28-class ViT-S classifier; separate India 59-crop/387-class ViT-B classifier; Kaggle training/evaluation notebooks/scripts, reports and manifests. No checkpoint tracked. |
| `offline/` | Browser ONNX Runtime WASM app, Java Android wrapper, Windows server, export/quantization/audio/data/release tools. Reference future offline work. |
| `report/` | Core dataset card, experiment history, evaluation tables/figures and India v1/v2 confusion reports. Never mix core and India metrics. |
| `samples/` | Four attributed PlantDoc CC BY 4.0 field photos plus label CSV. Smoke tests only, not a performance benchmark. |
| `server/` | Python standard-library live scan servers and HTML clients, crop ambiguity logic, draft multilingual advice/translations. |
| `webapp/` | Vanilla JS/HTML/CSS UI with camera, upload, local history and speech; duplicated under backend. Reference UX, not a replacement application. |
| root | Python forwarding `main.py`, loose ONNX requirements, Render deployment, Android Gradle setup, README/decisions/env/gitignore. No universal source licence file found. |

Clone remains read-only after checkout. Do not install, build, download weights into, or modify it. Full history is available locally; release binaries are separate downloads and are not part of a normal Git clone.
