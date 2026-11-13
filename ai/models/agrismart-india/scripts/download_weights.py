"""Download the pinned release without accepting partial or unverified checkpoints."""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import urllib.request

MODEL_DIR = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((MODEL_DIR / "weights.json").read_text(encoding="utf-8"))


def verify_checkpoint(path: Path) -> str:
    if path.stat().st_size != MANIFEST["size_bytes"]:
        raise ValueError("CHECKPOINT_SIZE_MISMATCH")
    with path.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != MANIFEST["sha256"]:
        raise ValueError("CHECKPOINT_SHA256_MISMATCH")
    return digest


def download(destination: Path) -> dict:
    destination = destination.resolve()
    if destination.exists():
        digest = verify_checkpoint(destination)  # Never replace an existing invalid file.
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix="model-", suffix=".part", dir=destination.parent)
        partial = Path(temporary)
        try:
            # GitHub release storage supports byte ranges. Use bounded parallel ranges
            # for a slow connection; verify every range and the final original SHA.
            workers = 8
            span = (MANIFEST["size_bytes"] + workers - 1) // workers
            parts = [partial.with_name(partial.name + f"-{i}.part") for i in range(workers)]

            def fetch_range(index: int) -> Path:
                start = index * span
                end = min((index + 1) * span, MANIFEST["size_bytes"]) - 1
                req = urllib.request.Request(MANIFEST["url"], headers={
                    "User-Agent": "crop-model-preparation/1", "Range": f"bytes={start}-{end}"})
                with urllib.request.urlopen(req, timeout=60) as response, parts[index].open("xb") as output:
                    expected = f"bytes {start}-{end}/{MANIFEST['size_bytes']}"
                    if response.status != 206 or response.headers.get("Content-Range") != expected:
                        raise ValueError("CHECKPOINT_RANGE_MISMATCH")
                    received = 0
                    while chunk := response.read(1024 * 1024):
                        received += len(chunk)
                        if received > end - start + 1:
                            raise ValueError("CHECKPOINT_RANGE_SIZE_MISMATCH")
                        output.write(chunk)
                    if received != end - start + 1:
                        raise ValueError("CHECKPOINT_RANGE_SIZE_MISMATCH")
                print(f"Verified download range {index + 1}/{workers}", flush=True)
                return parts[index]

            try:
                with os.fdopen(fd, "wb") as output, ThreadPoolExecutor(max_workers=workers) as executor:
                    for part in executor.map(fetch_range, range(workers)):
                        with part.open("rb") as source:
                            while chunk := source.read(1024 * 1024):
                                output.write(chunk)
            finally:
                for part in parts:
                    part.unlink(missing_ok=True)
            digest = verify_checkpoint(partial)
            # Hard-link promotion is atomic and fails if another process created destination.
            os.link(partial, destination)
        finally:
            partial.unlink(missing_ok=True)
    record = {"release": MANIFEST["release"], "sha256": digest,
              "size_bytes": destination.stat().st_size, "verified": True,
              "verified_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
              "licence_approved": False, "prediction_tested": False}
    receipt = destination.with_suffix(".download.json")
    if not receipt.exists():
        receipt.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    return record


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    target = MODEL_DIR / "checkpoints" / "model.pt"
    if args.verify_only:
        print(json.dumps({"verified": True, "sha256": verify_checkpoint(target)}, indent=2))
    else:
        print(json.dumps(download(target), indent=2))
