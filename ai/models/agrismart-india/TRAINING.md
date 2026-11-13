# Original training and evaluation materials

The complete original `upstream/model/training/` is installed, including:

- `00_smoke_test`: original core GPU smoke experiment.
- `01_data_prep` / `02_train`: original core-model dataset preparation and training.
- `india/01_data_prep`: India dataset collection/deduplication/split notebooks and scripts.
- `india/02_train`: India classifier training/package notebooks and scripts.
- `india/03_eval`: India confusion-matrix evaluation script.

Original India package files and per-class/per-crop/history/test-prediction reports are in `upstream/model/india`; original sample photos/labels/notices are in `upstream/samples`; full evaluation tables/figures in `upstream/report`. `UPSTREAM_INSTALLATION.json` pins the exact source revision and file hashes. Nothing was copied from the application frontend/backend or Android stack.

Running the pretrained India v1 checkpoint does **not** require retraining, Kaggle credentials, the core-model checkpoint or downloading training datasets. The normal `.venv` installs inference/service dependencies only. Training is a separate research workflow: original scripts expect Kaggle paths/account resources, GPU and separately licensed datasets; several source paths are author-specific and must be adapted deliberately. The source and notebooks are present; training and large dataset downloads are not executed by this installation.

Optional research dependencies are listed in `requirements.training.txt`; this is an import-derived starting set, not a validated training lock. Use a separate research environment, review every dataset's source/rights and configure paths/credentials before any training. No API credentials or datasets are bundled. Field evaluation and calibration still require independent, expert-labelled data; the installed four samples only prove the pipeline runs.
