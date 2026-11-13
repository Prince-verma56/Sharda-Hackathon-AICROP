# Validation and change record

Status: preparation validation, 2026-11-13. This record distinguishes artifact/code checks from unperformed product/runtime evaluation. Final checkpoint result will be recorded after the in-progress verified download.

## Passed

- Full normal sibling clone: origin/branch/history/tags verified, 51 reachable HEAD commits, shallow=false; `git fsck --connectivity-only` passed. Upstream working tree remains clean.
- Complete source inventory: 195 files, 81 tracked directories with Git blob IDs/sizes. Three GitHub releases captured. India manifest SHA/size agree with release asset digest.
- JSON parsing of added manifests/catalogues/specifications; Python AST parsing of the four added Python files.
- All 16 required planning documents are present; relative Markdown links resolve. Imported crop/metric snapshots match audited upstream bytes exactly.
- Ten Python boundary/download tests: invalid/oversize/disallowed image, metadata stripping, wrong checkpoint preservation, wrong taxonomy, complete ranged promotion, corrupt same-size bytes, ignored ranges and existing-valid no-redownload behaviour. `python -m unittest discover -s ai/models/agrismart-india/tests -v` passed.
- Factual crop catalogue: 59 crops / 387 conditions. Source provenance SHA-256 recorded.
- Development Compose overlay syntax: `docker compose --env-file .env.example -f docker/compose.dev.yaml -f docker/compose.crop.dev.example.yaml --profile redis --profile crop-inference config --quiet` passed with a process-local dummy inference credential.
- Production Compose example syntax passed using process-local dummy image/credential interpolation and `config --no-env-resolution --quiet`; no real production env file was read. This is syntax/model validation, not proof images/env/private storage/TLS/deployment exist.
- Hinglish PDF: two A4 pages generated locally with ReportLab; 183-word spoken script (estimated 60-90 seconds, rehearse); separate internal technical overview; both final pages rendered to PNG and visually inspected for clipping/font/spacing issues, with no text outside either page boundary. Markdown source and reproducible renderer supplied. PDF is 77,348 bytes; SHA-256 `b4b1831a95a2aa3ff2059dee03c68fd75ead578b428df4cedee98a913674b35d`. No fabricated performance claim.
- Checkpoint/partial/cache ignores are scoped under new AI folders; original root `.gitignore` was not edited. Original 45-file ignored project-brain remains untouched. No existing tracked application/config/schema/route source changed by this preparation.

## Baseline checks that did not pass

No project-local `node_modules` is installed. `npm run typecheck` exits 1 with missing Next/React/Zod/LangGraph/Prisma/Node-type dependencies and resulting diagnostics; `npm run lint` exits 1 because local `eslint` cannot be resolved; `npm test` exits 1 because `vitest` is unavailable. Global executables do not make the declared project toolchain installed. These runs cannot establish the template's build/test health. No package manifest/lockfile changes or dependency installs were made in the Node project. Next.js build is not claimed to pass.

## Not tested or activated

Torch/timm are absent; requirements are proposed ranges, not a resolved lock. Real checkpoint deserialization, inference/preprocessing parity, sample predictions, local field accuracy/calibration/OOD, CPU memory/latency, concurrency and FastAPI HTTP behaviour are not demonstrated. The HTTP service is a contract, not implemented. Node feature integration, browser/mobile accessibility/camera, PostgreSQL/Redis application wiring, SMS, private storage and deletion are later phases.

No Vapi assistant created/activated, provider API secrets read, database migrations applied, Docker services started, Kubernetes/cloud deployment, commit, staging or push. Provider documentation was consulted read-only for architecture. Model licence and agronomic/native-language approval remain unresolved.

## Deliverable map

- `docs/upstream-integration/01..04`: existing/upstream/reuse/AI-voice audits, with full file/directory/blob inventory and release snapshot alongside.
- `docs/project-planning`: all 16 requested planning files plus index; route/layout/component/access matrix, backend/data/security/weather/voice/DevOps phases and open decisions.
- `ai/models/agrismart-india`: original strict adapter, factual taxonomy/metrics/manifest, source/model cards, download/verify tool, tests and report/sample references. Large checkpoint is local/ignored.
- `ai/services`: private inference contract, weather and approved-guidance boundaries; `ai/voice` draft disabled configuration/tool catalogue and versioned prompt under existing prompts directory.
- `backend/README.md`: application-domain ownership without moving/duplicating existing infrastructure.
- `docker/compose.crop.*.example.yaml`: development overlay and production service shape, reviewed examples only.
- `docs/project-brief`: final two-page Hinglish PDF and editable Markdown; `scripts/render-crop-brief.py` reproduces/render-checks them.

## Git preservation and review

Initial and final existing tracked change: only the user's `.gitignore` exclusion of `/crop-doctor-project-brain`. All preparation deliverables are new/untracked until the owner reviews/stages them. `modified-files.json` and `git-diff-summary.md` enumerate the complete new-file change set; a review patch will include text changes and identify the PDF separately. No model binary, private data or upstream clone is included.
