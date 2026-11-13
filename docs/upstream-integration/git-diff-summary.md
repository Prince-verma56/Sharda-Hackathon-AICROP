# Git diff and modified-file summary

Status: new preparation files are untracked; no staging, commit or push. Existing user change preserved.

- Baseline commit: `06d9524` on `main`.
- Pre-existing tracked modification: `.gitignore` excludes the project-brain; not edited by this task.
- New preparation files: 56 (including this summary, manifest and review patch).
- Application routes/components, package.json/lock, Prisma schema, original Compose files and original project-brain unchanged.
- Upstream clone remains a separate clean read-only repository.
- Large checkpoint/receipts/partials and Python caches ignored; no model binary in the review patch.

## New files by area

| Area | Files |
|---|---:|
| `ai/models` | 13 |
| `ai/prompts` | 1 |
| `ai/services` | 4 |
| `ai/voice` | 2 |
| `backend/README.md` | 1 |
| `docker/compose.crop.dev.example.yaml` | 1 |
| `docker/compose.crop.production.example.yaml` | 1 |
| `docs/project-brief` | 2 |
| `docs/project-planning` | 17 |
| `docs/upstream-integration` | 13 |
| `scripts/render-crop-brief.py` | 1 |

## Review artifacts

`modified-files.json` lists every new file and identifies the original user change. `preparation-review.patch` contains the pre-existing tracked user diff plus all new-file diffs, including the small PDF as emitted by Git. The review patch excludes itself to avoid recursion. It is a snapshot for review, not applied or committed.

## Validation

Ten Python boundary/download tests, JSON/Python parsing, all required planning documents/relative links, development/production Compose syntax and final two-page PDF rendering/visual review passed. Existing Node typecheck/lint/test checks failed due to missing project dependencies. Model runtime/parity/field evaluation, rights approval and production services remain future gates. Checkpoint verification outcome is recorded in `05-validation-and-changes.md`.

## Complete new-file list

- `ai/models/.gitignore`
- `ai/models/agrismart-india/MODEL_CARD.md`
- `ai/models/agrismart-india/README.md`
- `ai/models/agrismart-india/SOURCE_PROVENANCE.md`
- `ai/models/agrismart-india/crops.json`
- `ai/models/agrismart-india/metrics.json`
- `ai/models/agrismart-india/predict.py`
- `ai/models/agrismart-india/reports/README.md`
- `ai/models/agrismart-india/requirements.txt`
- `ai/models/agrismart-india/scripts/download_weights.py`
- `ai/models/agrismart-india/tests/README.md`
- `ai/models/agrismart-india/tests/test_preparation.py`
- `ai/models/agrismart-india/weights.json`
- `ai/prompts/system/crop-assistant.preparation.md`
- `ai/services/.gitignore`
- `ai/services/inference/CONTRACT.md`
- `ai/services/recommendations/README.md`
- `ai/services/weather/README.md`
- `ai/voice/crop-assistant.preparation.json`
- `ai/voice/crop-assistant.tools.json`
- `backend/README.md`
- `docker/compose.crop.dev.example.yaml`
- `docker/compose.crop.production.example.yaml`
- `docs/project-brief/crop-project-explanation-hinglish.md`
- `docs/project-brief/crop-project-explanation-hinglish.pdf`
- `docs/project-planning/AI_MODEL_INTEGRATION.md`
- `docs/project-planning/API_CONTRACTS.md`
- `docs/project-planning/BACKEND_ARCHITECTURE.md`
- `docs/project-planning/DATABASE_DESIGN.md`
- `docs/project-planning/DEVOPS_PLAN.md`
- `docs/project-planning/FRONTEND_ROUTES.md`
- `docs/project-planning/GENAI_AGENT_ARCHITECTURE.md`
- `docs/project-planning/IMPLEMENTATION_PHASES.md`
- `docs/project-planning/OPEN_DECISIONS.md`
- `docs/project-planning/PRODUCT_REQUIREMENTS.md`
- `docs/project-planning/PROJECT_OVERVIEW.md`
- `docs/project-planning/README.md`
- `docs/project-planning/SECURITY_AND_PRIVACY.md`
- `docs/project-planning/SYSTEM_ARCHITECTURE.md`
- `docs/project-planning/UPSTREAM_REUSE_MAP.md`
- `docs/project-planning/VAPI_VOICE_ARCHITECTURE.md`
- `docs/project-planning/WEATHER_INTEGRATION.md`
- `docs/upstream-integration/01-existing-project-audit.md`
- `docs/upstream-integration/02-upstream-repository.md`
- `docs/upstream-integration/03-upstream-reuse-audit.md`
- `docs/upstream-integration/04-ai-and-voice-architecture.md`
- `docs/upstream-integration/05-validation-and-changes.md`
- `docs/upstream-integration/existing-files.txt`
- `docs/upstream-integration/git-diff-summary.md`
- `docs/upstream-integration/modified-files.json`
- `docs/upstream-integration/preparation-review.patch`
- `docs/upstream-integration/upstream-directories.txt`
- `docs/upstream-integration/upstream-files.txt`
- `docs/upstream-integration/upstream-inventory.json`
- `docs/upstream-integration/upstream-releases.json`
- `scripts/render-crop-brief.py`
