# Validation scope

Ten lightweight tests cover image-size/type/decode rejection, EXIF metadata removal, invalid checkpoint preservation, taxonomy index corruption, complete ranged-download promotion, same-size hash corruption, refusal of ignored HTTP ranges, and no-network re-verification of an existing valid artifact. They require Pillow but not torch. Network checks use controlled byte fixtures and do not prove model loading, classifier parity, performance or leaf/OOD recognition.

Run from project root: `python -m unittest discover -s ai/models/agrismart-india/tests -v`.

Future integration matrix: exact checksum and strict torch load; 59/387 checkpoint metadata; identical upstream-vs-adapter preprocessing/TTA output on same inputs; selected crop vs global mass; unknown crop; low/competing scores; non-leaf/unsupported crop; dark/blurred/damaged/corrupt/animated/large-pixel images; missing service credential; request cancellation/queue overflow; cold/warm latency and memory; no mock readiness.

Four upstream sample photos remain in sibling `SIH_2026-upstream-reference/samples/`: tomato late blight, potato early blight, corn common rust and tomato healthy. Upstream README/CSV attributes PlantDoc, Singh et al. 2020, DOI https://doi.org/10.1145/3371158.3371196 via Kaggle `nirmalsankalana/plantdoc-dataset`, CC BY 4.0. If later copying photos, retain per-photo source/label/attribution/licence. They are smoke fixtures, already part of upstream evaluation, not an independent test set. Core labels must be explicitly mapped to India labels (`corn_maize` etc.) before comparing.
