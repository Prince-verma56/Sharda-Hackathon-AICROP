"""Meaningful boundary tests; do not claim classifier accuracy or model execution."""
from io import BytesIO
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image
from predict import decode_image, MAX_BYTES, validate_taxonomy
from scripts.download_weights import verify_checkpoint
from scripts import download_weights


class PreparationTests(unittest.TestCase):
    def test_reject_non_image(self):
        with self.assertRaisesRegex(ValueError, "IMAGE_INVALID"):
            decode_image(b"not an image")

    def test_reject_oversized_upload(self):
        with self.assertRaisesRegex(ValueError, "IMAGE_SIZE_INVALID"):
            decode_image(b"x" * (MAX_BYTES + 1))

    def test_reject_unapproved_format(self):
        output = BytesIO()
        Image.new("RGB", (64, 64)).save(output, format="BMP")
        with self.assertRaisesRegex(ValueError, "IMAGE_FORMAT_UNSUPPORTED"):
            decode_image(output.getvalue())

    def test_exif_is_not_retained(self):
        output = BytesIO()
        exif = Image.Exif()
        exif[270] = "private metadata"
        Image.new("RGB", (64, 64)).save(output, format="JPEG", exif=exif)
        result = decode_image(output.getvalue())
        self.assertEqual(result.mode, "RGB")
        self.assertFalse(result.getexif())
        self.assertFalse(result.info)

    def test_reject_wrong_checkpoint(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.pt"
            path.write_bytes(b"wrong checkpoint")
            with self.assertRaisesRegex(ValueError, "CHECKPOINT_SIZE_MISMATCH"):
                verify_checkpoint(path)
            self.assertEqual(path.read_bytes(), b"wrong checkpoint")

    def test_taxonomy_rejects_wrong_crop_indices(self):
        crops = {f"crop{i}": [] for i in range(59)}
        labels = []
        for i in range(387):
            crop = f"crop{i % 59}"
            labels.append(f"{crop}::condition{i}")
            crops[crop].append(i)
        validate_taxonomy(labels, crops)
        crops["crop0"][0] = crops["crop1"][0]
        with self.assertRaisesRegex(ValueError, "MODEL_TAXONOMY_MISMATCH"):
            validate_taxonomy(labels, crops)

    def _download_fixture(self, corrupt=False, status=206):
        data = b"0123456789ABCDEF"
        manifest = {**download_weights.MANIFEST, "size_bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest()}

        class Response(BytesIO):
            pass

        def open_range(request, timeout):
            start, end = map(int, request.get_header("Range").removeprefix("bytes=").split("-"))
            payload = data[start:end + 1]
            response = Response(b"x" * len(payload) if corrupt else payload)
            response.status = status
            response.headers = {"Content-Range": f"bytes {start}-{end}/{len(data)}"}
            return response

        return data, manifest, open_range

    def test_download_accepts_only_complete_hash_verified_ranges(self):
        data, manifest, opener = self._download_fixture()
        with tempfile.TemporaryDirectory() as directory, patch.dict(download_weights.MANIFEST, manifest):
            destination = Path(directory) / "model.pt"
            with patch("urllib.request.urlopen", side_effect=opener):
                record = download_weights.download(destination)
            self.assertEqual(destination.read_bytes(), data)
            self.assertTrue(record["verified"])
            self.assertFalse(record["prediction_tested"])
            self.assertEqual(list(Path(directory).glob("*.part")), [])
            with patch("urllib.request.urlopen", side_effect=AssertionError("No redownload")):
                download_weights.download(destination)

    def test_download_rejects_same_size_corrupt_data(self):
        _, manifest, opener = self._download_fixture(corrupt=True)
        with tempfile.TemporaryDirectory() as directory, patch.dict(download_weights.MANIFEST, manifest):
            destination = Path(directory) / "model.pt"
            with patch("urllib.request.urlopen", side_effect=opener):
                with self.assertRaisesRegex(ValueError, "CHECKPOINT_SHA256_MISMATCH"):
                    download_weights.download(destination)
            self.assertFalse(destination.exists())
            self.assertFalse(any(Path(directory).iterdir()))

    def test_download_rejects_server_ignoring_range(self):
        _, manifest, opener = self._download_fixture(status=200)
        with tempfile.TemporaryDirectory() as directory, patch.dict(download_weights.MANIFEST, manifest):
            destination = Path(directory) / "model.pt"
            with patch("urllib.request.urlopen", side_effect=opener):
                with self.assertRaisesRegex(ValueError, "CHECKPOINT_RANGE_MISMATCH"):
                    download_weights.download(destination)
            self.assertFalse(destination.exists())

    def test_existing_invalid_checkpoint_never_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "model.pt"
            destination.write_bytes(b"local file to preserve")
            with patch("urllib.request.urlopen", side_effect=AssertionError("No download")):
                with self.assertRaisesRegex(ValueError, "CHECKPOINT_SIZE_MISMATCH"):
                    download_weights.download(destination)
            self.assertEqual(destination.read_bytes(), b"local file to preserve")


if __name__ == "__main__":
    unittest.main()
