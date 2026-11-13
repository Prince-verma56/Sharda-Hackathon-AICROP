# Loop 1 — Upstream clone

Status: **passed** (clone already existed; verified, not re-cloned).

## Location and state

| Field | Value |
|---|---|
| Path | `C:\Development\SIH_2026-upstream-reference` (sibling of the app, not nested) |
| Remote | `https://github.com/wpzvqrs8/SIH_2026.git` |
| HEAD | `9db1605a7c9fdc989f51320ae4970f6a1d8fd255` (2026-09-15), branch `main`, 51 commits, not shallow |
| Tags | `india-model-v1`, `model-v2`, `offline-app-v1` |
| Working tree | clean — never modified |
| Top level | `app/ backend/ docs/ gradle/ model/ offline/ report/ samples/ server/ webapp/` + `DECISIONS.md Procfile README.md main.py render.yaml requirements.txt …` |

Full file/blob inventory: [`docs/upstream-integration/upstream-files.txt`](../upstream-integration/upstream-files.txt) and [02-upstream-repository.md](../upstream-integration/02-upstream-repository.md).

## Datasets (India model)

From `model/training/india/01_data_prep/` (`india_data_prep.py`, `kernel-metadata.json`) and `model/india/README.md`:

| Source group | Count | Access | Needed for inference? |
|---|---|---|---|
| Kaggle datasets (PlantVillage, Paddy Doctor, wheat, cotton ×2, sugarcane, mango, banana, okra YVMV, finger millet, onion, pumpkin, TeaLeafNet, Tomato-Village) | 14 | Kaggle account + API token | No |
| PlantWild v1 + v2 (`uqtwei2/PlantWild`, field photos) | 2 zips | Hugging Face (`huggingface_hub`) | No |
| `Project-AgML` research-dataset mirrors | 64 | Hugging Face | No |
| Built dataset | 351,802 loaded → 266,356 kept (238,028 train / 28,328 test), stored at 384 px | **6.7 GB**; built on a Kaggle T4 in ~65 min | No |

**Inference needs only `model.pt` (344 MB).** Datasets are needed only to retrain/fine-tune or to re-run the upstream evaluation. None were downloaded; they stay out of Git and out of this machine unless a training phase is approved.

**Licences are mixed.** Most sources are CC BY 4.0 or CC0; PlantVillage, PlantWild, the Ripon cotton set, one tea set, MoringaLeafNet and the mango set are **non-commercial**. Upstream states the model is for non-commercial research and education; photos are not redistributed. The repository itself has no LICENSE file (GitHub licence `null`).

Included in the repo: only 4 PlantDoc sample photos (`samples/`, CC BY 4.0) and evaluation CSVs/figures.
