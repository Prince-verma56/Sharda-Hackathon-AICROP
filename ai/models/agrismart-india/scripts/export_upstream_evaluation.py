"""Export the upstream India v1 held-out evaluation into reports/upstream_evaluation.json.

Source: SIH_2026 model/india/report_per_crop.csv and report_per_class.csv (upstream
authors' test split, 28,328 photos). Numbers are copied verbatim, not recomputed.
The inference service uses them only as reliability context for predictions.

    python ai/models/agrismart-india/scripts/export_upstream_evaluation.py [--source DIR]
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = MODEL_DIR / "upstream" / "model" / "india"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    crop_csv, class_csv = args.source / "report_per_crop.csv", args.source / "report_per_class.csv"

    per_crop = {}
    with crop_csv.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            per_crop[row["crop"]] = {"test_images": int(row["test_images"]),
                                     "macro_f1": round(float(row["macro_f1"]), 4),
                                     "accuracy": round(float(row["accuracy"]), 4)}
    per_class = {}
    with class_csv.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            label = row[""]
            if "::" not in label:  # skip accuracy / macro avg / weighted avg rows
                continue
            per_class[label] = {"precision": round(float(row["precision"]), 4),
                                "recall": round(float(row["recall"]), 4),
                                "f1": round(float(row["f1-score"]), 4),
                                "support": int(float(row["support"]))}
    if len(per_crop) != 59 or len(per_class) != 387:
        raise SystemExit(f"Unexpected report shape: {len(per_crop)} crops, {len(per_class)} classes")

    output = {
        "source": {
            "repository": "https://github.com/wpzvqrs8/SIH_2026",
            "revision": json.loads((MODEL_DIR / "weights.json").read_text())["source_revision"],
            "files": {"model/india/report_per_crop.csv": sha256(crop_csv),
                      "model/india/report_per_class.csv": sha256(class_csv)},
            "test_split": "upstream held-out test, 28,328 photos (lab + field + research datasets)",
            "note": "Upstream authors' numbers, copied verbatim. Not our own validation.",
        },
        "per_crop": per_crop,
        "per_class": per_class,
    }
    target = MODEL_DIR / "reports" / "upstream_evaluation.json"
    target.write_text(json.dumps(output, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {target} ({len(per_crop)} crops, {len(per_class)} classes)")


if __name__ == "__main__":
    main()
