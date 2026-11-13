"""Install the pinned original model/training/report/sample files without overwrites."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

MODEL_DIR = Path(__file__).resolve().parents[1]
ROOT = MODEL_DIR.parents[2]


def install(source: Path):
    manifest = json.loads((MODEL_DIR / "UPSTREAM_INSTALLATION.json").read_text(encoding="utf-8"))
    revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"], text=True).strip()
    if revision != manifest["revision"]:
        raise ValueError("Upstream revision differs from the audited integration; refusing to import")
    for item in manifest["files"]:
        src = source / item["source_path"]
        content = src.read_bytes()
        if hashlib.sha256(content).hexdigest() not in {item["sha256"], item["sha256_git_blob"]}:
            raise ValueError(f"Upstream bytes changed: {item['source_path']}")
        dst = ROOT / item["installed_path"]
        if dst.exists():
            if dst.read_bytes() != content:
                raise ValueError(f"Preserving modified local file: {dst}")
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            with dst.open("xb") as stream:
                stream.write(content)
    checkpoint = MODEL_DIR / "checkpoints/model.pt"
    if checkpoint.exists():
        from download_weights import verify_checkpoint
        verify_checkpoint(checkpoint)
        linked = MODEL_DIR / "upstream/model/india/model.pt"
        if not linked.exists():
            os.link(checkpoint, linked)
        elif not os.path.samefile(checkpoint, linked):
            raise ValueError("Existing original-predictor checkpoint was preserved; inspect manually")
    print(f"Installed/verified {len(manifest['files'])} original AgriSmart files")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT.parent / "SIH_2026-upstream-reference")
    install(parser.parse_args().source.resolve())
