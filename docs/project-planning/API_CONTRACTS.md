# API contracts

Status: proposed future contracts, not implemented endpoints. Extend the existing Next.js route wrapper only after its auth/error/rate-limit gaps are fixed. Preserve its `{success,data,meta}` envelope; standardize errors with `requestId`. Examples below are illustrative, not measured predictions.

Success: `{ "success": true, "data": { }, "meta": { "requestId": "opaque", "timestamp": "UTC ISO8601" } }`.
Error: `{ "success": false, "error": { "code": "IMAGE_INVALID", "message": "Please take another clear leaf photo." }, "meta": { "requestId": "opaque" } }`. No stack traces, internal URLs or raw provider details.

| Endpoint | Request / result | Authentication and scope |
|---|---|---|
| `POST /api/v1/auth/otp/request` | normalized phone -> challengeId, expiry/resend seconds; never real OTP | public, anti-abuse; generic account-neutral response |
| `POST /api/v1/auth/otp/verify` | challengeId+code -> minimal user DTO and HttpOnly session cookie | bounded attempts, atomic single consume; no client-controlled role |
| `POST /api/v1/auth/logout` | revoke session/voice bindings -> success | authenticated + CSRF |
| `GET /api/v1/me`, `PATCH /api/v1/me/profile` | optional profile fields; farm size includes value+unit | authenticated owner; no userId/role field |
| `GET/POST /api/v1/farms` | owned farms; optional consented coordinates/locality | owner, validate bounds/precision |
| `GET /api/v1/crops` | supported taxonomy + model version/reviewed display keys | public catalogue or authenticated; no private data |
| `POST /api/v1/diagnoses` | multipart `image`, selected `crop`, optional owned farmId; proposed limit 8 MiB + decoder cap | farmer session, CSRF, quota; actor+operation idempotency |
| `GET /api/v1/diagnoses`, `/diagnoses/[id]` | paged owned history / status+assessment | owner predicate, opaque IDs |
| `POST /api/v1/diagnoses/[id]/feedback` | bounded structured feedback | owning farmer; unverified feedback is not truth |
| `GET /api/v1/weather/farms/[farmId]` | normalized context/provider/times/units/cache age | owner; location consent |
| `POST /api/v1/assistant/session` | locale+consent -> opaque short-lived context ref/client-safe config | farmer+CSRF+quotas; no server key returned |
| `POST /api/v1/assistant/webhook` | validated lifecycle/end events -> minimal acknowledgement | provider auth + server-bound call, expiry/dedupe |
| `POST /api/v1/assistant/tools/[toolName]` | documented narrow args -> authorized DTO | provider auth, call/owner binding and allowlist |
| `GET /api/v1/admin/cases`, `/cases/[id]`; `POST /cases/[id]/review` | assigned review queue/decision | staff MFA+review capability+assignment |
| `GET/PATCH /api/v1/admin/guidelines`; `POST /guidelines/[id]/approve` | draft/review/immutable approved version | distinct content approval capability+audit |
| `/api/v1/admin/farmers`, `/crops`, `/alerts`, `/system/health`, `/audit` | management/aggregate outbreak review/monitoring | explicit per-action capabilities; data minimization |

Diagnosis creation returns HTTP 202 with `{id,status:"PROCESSING",pollUrl}` inside data. Result contains model/checkpoint/taxonomy/preprocess versions, selected crop, raw/conditional top-k scores, crop evidence, warnings, `isLaboratoryConfirmed:false`, `severity:null`, and approved guidance references only. `status` (job state) is distinct from assessment uncertainty. Unsupported/out-of-coverage/invalid inputs must not produce a fabricated disease. Image-quality warnings alone cannot identify non-leaves.

Private inference API (not browser-facing): `GET /health` liveness; `GET /ready` readiness (503 without verified loaded model); authenticated `GET /v1/model/metadata` and `POST /v1/predict` multipart image/crop/top_k. See `ai/services/inference/CONTRACT.md` for full schema/status codes. No `/predict/url`, farmer CRUD, OTP, database or public CORS in FastAPI.

HTTP semantics: 400 malformed request, 401 no trusted identity/service credential, 403 insufficient permission, 404 unavailable/non-owned resource, 413 encoded/pixel limit, 415 format, 422 invalid image/crop/top_k, 429 quota/queue capacity, 503 model/provider unavailable, 504 bounded inference timeout. Internal failures are logged redacted with request IDs. Use Retry-After for rate limits and safe polling, not unlimited retries. Only retry idempotent reads or explicit operation-scoped idempotent creation; bind key to payload hash.

Existing implemented endpoints remain generic template APIs: `/api/health`, `/api/v1/health`, files/jobs/notifications/realtime/provider-webhooks and demo `/api/ai/voice`. None of the crop endpoints above should be represented as live before their implementation/ownership tests pass.
