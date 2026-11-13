# DevOps and environment plan

Status: Docker first / Kubernetes later confirmed. Definitions are reviewable examples, not deployed services.

Observed existing development Compose: pgvector PostgreSQL 16, Mailpit, pgAdmin, Redis 7 under `redis` profile. Base/AI files have no services. No Kubernetes manifests, web Dockerfile or production stack exists. Preserve all existing files. `npm run infra:up` does not activate Redis; future local command must explicitly enable the profile, e.g. `docker compose --env-file .env -f docker/compose.dev.yaml --profile redis up -d` after environment setup. Do not run reset/down-volume commands as setup.

Prepared examples: `docker/compose.crop.dev.example.yaml` adds an opt-in private inference service to existing dev infrastructure; `docker/compose.crop.production.example.yaml` outlines web/inference/postgres/redis boundaries without host DB/cache exposure. Both require reviewed image builds/credentials and the future FastAPI application. They are not ready-to-run product deployments. Model mounted read-only, never baked into public images. Set resource limits after measuring CPU/RSS/TTA latency; a 344 MB checkpoint does not imply a 344 MB process footprint.

Future development: separate Node and Python virtual environments/locks, checked CPU torch/torchvision pairing, private image store, synthetic data, SMS mock visibly labelled, explicit live model/voice flags. No npm dependency changes in preparation. Existing CI typecheck/lint/tests/build remain the baseline; new Python boundary tests run without torch. Model load/parity/field tests require dedicated artifacts/runtime and are not part of every ordinary Node build.

Production proposal: reviewed immutable image digests; non-root app processes, read-only filesystem/tmpfs where compatible, private service network, ingress TLS, no exposed Postgres/Redis/pgAdmin, rotated service credentials, readiness/liveness, bounded inference queue and one model per worker, backups/restore drills, centralized redacted logs. Production must refuse OTP mock/AI mock/demo mode. Redis auth/network policy and durable PostgreSQL backup required. Object-store credentials scoped to private diagnosis objects.

Kubernetes remains a later ADR: only after reproducible Compose and measured capacity. Preserve any future existing manifests; plan separate web/inference Deployments and Services, probes, resource requests/limits, Secrets, ConfigMaps, network policies/TLS, storage and backup strategy. No new cluster/cloud services are introduced now.

## Environment reconciliation

| Existing name | Use / decision |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | Reuse; Redis URL currently does not wire a real client |
| `AUTH_SECRET` (commented), `AUTH_PROVIDER` | Reuse if selected auth design supports it; do not duplicate with SESSION_SECRET yet |
| `OTP_MODE`, `OTP_EXPIRY_SECONDS`, `OTP_MAX_ATTEMPTS` | Reuse spelling; production `OTP_MODE=real`; add provider config only after choice |
| `STORAGE_*`, `NEXT_PUBLIC_APP_URL` | Reuse; private provider/retention still open |
| `AI_PROVIDER`, `AI_MODEL`, `AI_MAX_STEPS`, provider keys | Existing LLM configuration; no parallel generic LLM_API_KEY introduced |
| `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` | Existing placeholders; proposed `LANGSMITH_TRACING` must be validated/redacted before use |
| `VAPI_API_KEY`, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_ASSISTANT_ID`, `NEXT_PUBLIC_VOICE_MODE` | Preserve existing naming; server key never public; voice stays mock/off |
| `FEATURE_OTP`, `FEATURE_AI`, `FEATURE_VOICE`, `FEATURE_REDIS`, `FEATURE_RAG`, `FEATURE_AGENTS`, `FEATURE_DEMO_MODE` | Reuse existing flags; reject mock/demo in production rather than invent FEATURE_AI_REAL |

Proposed additions, documented only: `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `AGRISMART_MODEL_PATH` (container path), `VAPI_WEBHOOK_SECRET` (mechanism to confirm), `OTP_RESEND_COOLDOWN_SECONDS`; SMS-provider keys once selected; `FEATURE_WEATHER`/`FEATURE_ADMIN` only when implemented in centralized flag validation. Model version/checksum come from pinned weights.json instead of editable env overrides. Open-Meteo fixed HTTPS host initially needs no duplicate WEATHER_API_BASE_URL. Existing `.env.production.example` duplicates development defaults; treat it as unsafe production scaffolding until validation/defaults are hardened.

Checks not performed by setup: no Docker services started, database migrations applied, assistant activated, credentials inspected, commit/push/deploy. Exact verification results are in `05-validation-and-changes.md`.
