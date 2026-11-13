# Security and privacy

Status: safeguards confirmed; numeric policies and provider choices proposed/open. This is engineering design, not a legal compliance conclusion.

| Boundary / threat | Required control before activation |
|---|---|
| OTP theft, brute force, SMS abuse | Cryptographic codes/provider verifier, 300s proposed expiry, 5 attempts, 30s resend, atomic consume/attempts, per-phone/IP/device quotas, uniform errors; no logging codes or resetting counters on resend |
| Session theft/CSRF | Secure HttpOnly SameSite cookies, rotation/revocation, origin/CSRF checks, bounded lifetime, TLS; no long-lived token in localStorage |
| Farmer to farmer IDOR | Derive principal from trusted session/call binding; predicate every farm/image/diagnosis/history/memory query on owner; reject cross-owner references |
| Admin compromise | Separate auth flow, MFA, least privilege, explicit capabilities/assignment, short sensitive sessions, no farmer-role escalation via request payload |
| Malicious image | Stream/body limit, format sniff/decode, pixel/frame/dimension limits, EXIF/GPS stripping, private object keys, quota/rate limits, temporary-file cleanup; no SVG or arbitrary URL inference |
| Model supply chain | Fixed HTTPS release+size+SHA, no pickle fallback, strict metadata/state dict, no runtime auto-download, dependency lock/SBOM before deployment |
| Voice forgery/replay | Provider Custom Credential, server-created farmer/call binding, expiry, atomic event dedupe, tool allowlist and per-resource checks; caller-ID is insufficient |
| Prompt injection/data exfiltration | No DB/network general tools, no admin registry, typed DTOs and scoped backend tools, untrusted retrieved text, step/output/cost budgets |
| Unsafe advice | Approved source+crop+region+locale+effective version; chemical fragments deterministic, no invented dose, no generic fallback, uncertain/expert route |
| Secret leakage | Validate environment at startup, server-only keys, no sensitive NEXT_PUBLIC variables, redacted logs/errors, credential rotation |
| Cross-tenant cache/idempotency | Actor+operation scope, payload hash, atomic first-write/complete, owner-scoped invalidation and short expiries |

Known baseline gaps: demo voice route, mock role resolution, global/guest READ tool permissions, client-overridable context identity, context-free RAG, direct AI DB persistence, in-memory non-atomic cache/rate limiter, API raw error exposure, and no completed OTP lifecycle. These are implementation blockers for activation, not silently fixed during this audit.

Privacy requirements: mandatory phone only for login; optional locality/GPS/profile/voice preferences. Store encrypted phone + keyed lookup identity if selected; protect key access separately from database. Photograph storage private; signed URLs short-lived, owner-authorized and not logged. Avoid public social sharing and external image transfers by default. Collect consent versions for location, voice processing and any retention/training reuse separately. Training consent is not implied by asking for a diagnosis.

Proposed defaults pending approval: no recording, no retained raw voice transcript, no training on uploads, no exact GPS requirement, no full personal prompt/trace payloads. Retention durations for images/history/audit/backup and provider copies remain open. Build a deletion ledger with owner-request verification, provider/storage/database/cache/trace propagation and backup expiry tracking. Do not promise immediate deletion of copies outside the implemented workflow.

Observability: request IDs, OTP outcome counts without identifiers, inference load/readiness/latency, model SHA, cache age, tool/voice lifecycle failures, expert-review delays. Redact phone, OTP, tokens, exact GPS, images and transcript contents before logs/tracing. Restrict audit-log access and record privileged reads; user deletion vs required audit retention needs policy review.

Before pilot: adversarial two-account tests, OTP race/abuse, expired/replayed voice requests, privilege escalation, prompt injection, decompression bombs, SSRF attempts, stale unapproved guidance, consent withdrawal/deletion, backup restore, production mock-mode refusal and dependency scans. Legal/regulatory/chemical-label requirements need current jurisdiction-specific expert review at implementation; no compliance claim is made here.
