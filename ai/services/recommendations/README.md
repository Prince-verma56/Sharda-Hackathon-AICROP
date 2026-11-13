# Approved guidance and translation boundary

Status: source review register only. **No agricultural treatment, pesticide dose or regional translation has been approved or imported.**

| Upstream reference | Review status / disposition |
|---|---|
| `server/live_camera_india/india_advice.json`, `build_advice.py` | Explicit unreviewed agronomic draft; disease-group templates/doses not accepted as verified guidance |
| `backend/app/treatments.py` | Generic substring matching/default chemical/organic advice; excluded |
| `server/live_camera_india/india_translations.json` | Native-speaker review absent; six language disease names are phonetic renderings; reference only |
| `offline/tools/build_offline_data.py`, `offline/web/data/app.json` | Derived multilingual knowledge bundles; not a verified source |
| `offline/tools/build_audio.py` | MMS CC BY-NC voices, audio not native-reviewed; not imported |

Future approved record requires source title/URL/date/rights, crop/condition/region/stage applicability, locale/native review, agronomist identity/approval, immutable version, effective/review dates and contraindications/product-label verification when relevant. `/backend` owns records and approval; AI retrieves only an authorized approved DTO. An empty/stale/unapproved match means no treatment output and an expert path.

GenAI may simplify approved non-chemical explanation. Chemical instructions, if ever permitted, are exact approved locale fragments with no invented names/doses/timing and no creative numeric paraphrase. Machine translation never silently approves treatment. Do not assume generic neem/fungicide recommendations are safe defaults. Verify external source content and usage rights before exposing any of it to farmers.
