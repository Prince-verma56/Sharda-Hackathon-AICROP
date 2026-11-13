# Backend architecture

Status: confirmed application/AI split; proposed service map. Existing `/server` and `/modules` remain in place.

`/backend` is an application service layer inside the Next.js project, not a second public HTTP server. Route handlers validate requests and call backend services; shared database/cache/storage/audit providers stay under `/server`. Domain services must not depend on browser state or accept a user ID supplied by the agent as authorization.

| Proposed backend module | Ownership / reused foundation |
|---|---|
| `auth` | Normalize phone, OTP provider challenge, expiry/attempts/resend, atomic consumption, secure sessions; adapt existing provider interface and `/modules/auth` |
| `authorization` | Typed capabilities, role grants, resource ownership and assigned-review scope; replace mock permissions in API wrapper before use |
| `farmers`, `farms` | Optional profiles, crop records, consent, approximate location and validated farm-size units |
| `diagnoses` | Private uploads, queued work, image ownership, private FastAPI client, provenance, status transitions and timeout/cancellation |
| `recommendations` | Versioned source records, agronomist/locale approval, effective dates and deterministic approved fragments |
| `voice-tools` | Authenticate provider, bind call to session, tool allowlist, per-user DTOs, replay protection, budget enforcement |
| `notifications`, `audit`, `privacy` | Reuse existing shared adapters; add callback consent, append-only redacted audit and verified deletion jobs |

OTP proposals: 300-second lifetime, 5 verification attempts, 30-second resend cooldown, limits by normalized phone lookup key and trusted client IP. These values match or extend existing examples but remain tunable proposals. Provider-managed verification is preferred where available; self-managed OTP uses cryptographic randomness and keyed verifier, not plaintext/unsalted low-entropy hashes. Consume challenge and attempts atomically; sending another challenge must not reset abuse counters. Bound parallel requests and prevent account enumeration.

Diagnosis state machine proposed: `PENDING -> PROCESSING -> COMPLETED | NEEDS_RETAKE | REVIEW_REQUIRED | FAILED`; timeout/cancel paths explicit. `COMPLETED` is computation status, not expert confirmation. Persist original global score evidence, selected crop and model/taxonomy/preprocess versions. Reject unsupported crop keys; do not silently fall back. Use actor+operation scoped idempotency keys and private storage references; no external image URL input. Existing database jobs/worker may be extended only after claim/locking/retry semantics are checked.

Tool gateway executes only validated server-known operations. A provider credential authenticates transport, then server-bound user/call context scopes every query. Generic READ access in the existing tool registry is insufficient. Agent context, memory and history persistence must call backend services; no direct AI Prisma imports in the activated path.

Testing gates: OTP race/expiry/abuse, two-user IDOR attempts, role escalation, duplicate diagnosis creation, cancellation, malformed image/oversized decode, classifier timeout, model unavailability, forged/replayed provider calls and unapproved guidance. No new database schema or backend endpoint is implemented during preparation.
