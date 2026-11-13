# Database design

Status: PostgreSQL/Prisma confirmed; conceptual additive schema proposed, not migrated.

Observed: current User requires `clerkUserId` and `email`; role is a string. Existing Conversation/Message/Memory/Document/DocumentChunk, Notification, AuditLog, IdempotencyKey, Job/ScheduledJob and DeviceRegistration should be reused where compatible. Do not replace the schema or seed actual farmer data.

Proposed identity migration: preserve current IDs/relations, introduce provider identities or nullable provider-specific Clerk/email fields only after compatibility review. Add verified phone identity with encrypted canonical phone and keyed deterministic lookup fingerprint (key rotation version included). Reconcile duplicate accounts explicitly; do not fabricate email addresses. Roles/capabilities need a reviewed assignment model, not client-set role strings. Admin identity and MFA remain distinct from farmer OTP.

| Proposed entity / extension | Core fields and constraints |
|---|---|
| PhoneIdentity / OtpChallenge | userId?, lookup fingerprint, providerRef or keyed verifier, purpose, expiresAt, attempts, consumedAt; unique provider reference, expiry index; no raw OTP |
| FarmerProfile | unique userId, all optional name/locale/state/district/village/voice prefs; profile version/timestamps; no profile-complete gate |
| ConsentRecord | owner, purpose, notice version, granted/withdrawnAt, retention choice; auditable changes |
| Farm | ownerId index, display name?, approximate lat/lon?, precision/consent; range validation |
| Crop / DiseaseCondition / CropCondition | stable model crop keys, taxonomy version, display-key references; class label unique within model version |
| CropRecord | owner/farm, crop key, variety/growth/planting?, farm size? + unit; never infer numeric unit |
| ImageAsset | owner, private object key, bytes/MIME/dimensions/SHA, EXIF-sanitized state, expiresAt/deletion status |
| ModelVersion | immutable release/checkpoint SHA, taxonomy/preprocess version, dependency lock hash, provenance, allowed use status |
| Diagnosis | owner, imageId, cropRecord?, selected crop, status, modelVersionId, uncertainty reasons, timestamps, requestId; index owner+createdAt |
| DiagnosisPrediction | diagnosisId, class label, rank, raw score, conditional score; unique diagnosis+rank, score range [0,1] |
| WeatherSnapshot | farm/owner scope, provider, grid locality precision, values+units, observed/fetched/forecast times, cache age |
| GuidanceVersion | crop/condition/region/locale, source URL/title/date/rights, revision hash, reviewer/approval/effective/reviewDue dates, status; immutable approved version |
| Recommendation | owner/diagnosis, guidanceVersionId, rule version, weatherSnapshot?, generatedAt; no unsupported free-text treatments |
| Feedback / AdminReview | diagnosis/owner or assigned reviewer, structured response, correction? and verification state; feedback is not ground truth |
| VoiceSession | owner, opaque context reference hash, unique provider call ID, locale, consent, scopes, expiry/end/status; no default recording |
| Existing Conversation/Memory | enforce owner non-null on farmer path; optional permitted summary and expiry; existing rows need migration analysis |
| Existing AuditLog / IdempotencyKey | append-only redacted event/request actor; idempotency actor+operation scope, payload hash, expiry and atomic state |

Relationships: User -> Profile (0..1), Farms, Images, Diagnoses, VoiceSessions, Consents; Farm -> CropRecords/WeatherSnapshots; Diagnosis -> Predictions/Reviews/Feedback/Recommendations; Recommendation -> immutable approved GuidanceVersion; ModelVersion -> Diagnoses. Expert assignment authorizes a scoped case view, not unrestricted farmer access.

Transactions: OTP challenge consumption + session establishment; diagnosis creation + job enqueue/outbox; guideline approval + immutable version + audit; idempotency state/result. Redis contains short-lived counters/cache only. PostgreSQL is the durable record; use UTC `timestamptz`, expose local time in the UI. JSON payloads need explicit schema versioning.

Deletion: private images, summaries, transcripts (if ever retained), provider records and backups require tracked policies. Proposed retention durations must be approved; legal hold/audit requirements need review before hard-delete rules. Protect model provenance from mutation while removing links to deleted people where allowed. Use synthetic fixtures only. Database row-level security is optional defence in depth; explicit backend ownership checks remain mandatory.
