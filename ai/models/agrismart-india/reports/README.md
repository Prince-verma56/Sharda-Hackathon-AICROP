# Evaluation report references

Original reports, tables and sample photographs are now installed locally under `../upstream/report`, `../upstream/model/india` and `../upstream/samples` after the user requested real integration. The separate full upstream clone remains unchanged. `runtime-verification.json`, when present, records actual local model/API smoke execution and original-predictor parity, not independent accuracy.

Use upstream `model/india/metrics.json`, `report_per_class.csv`, `report_per_crop.csv`, `history.csv`, `test_predictions.csv`, and `report/results/india_v1_top_confusions.csv` / `india_v1_confusion_crops.csv`. Corresponding figures live under `report/figures`. `test_predictions_v2.csv` and India v2 matrices concern a different experiment; `report/model_report.md` concerns the core 28-class model, not India v1.

Published weak-crop/confusion patterns inform field sampling, not an assurance of local performance. Future local report must include dataset consent/rights, expert-labelled truth, split by field/location/time, per-crop/condition precision/recall, abstention/coverage, false reassurance, crop mismatch, preprocessing version, device/light strata, latency/RSS and confidence calibration. Never count four demonstration samples as a benchmark.
