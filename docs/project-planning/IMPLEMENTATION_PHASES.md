# Implementation phases and exit gates

Status: preparation performed here; all product implementation phases below are proposed future work. Do not equate planned routes/contracts with implemented features.

## Preparation (this task)

- [x] Audit current template, user changes and 45-file brain; preserve baseline.
- [x] Full sibling clone, history/tags/releases, complete directory/file inventory.
- [x] Audit model/backend/frontend/Android/offline/translations/advice/licences.
- [x] Record selection map before preparation code; isolate model metadata and original adapter.
- [x] Define frontend/admin/backend/data/AI/voice/weather/security/DevOps contracts.
- [x] Add meaningful Python boundary checks and ignored checkpoint download/verification tooling.
- [ ] Checkpoint verified: see final validation report for actual outcome.
- [x] Two-page PDF generated, rendered and visually inspected; editable Markdown supplied.
- [ ] Model runtime/dependency/field validation (not claimed by this task).

## 1. Review and baseline readiness

- [ ] Resolve intended-use model/source/dataset rights and distribution restrictions.
- [ ] Select initial crops/locales/region, expert and language reviewers.
- [ ] Resolve Node dependencies with existing lock; run existing typecheck/lint/tests/build and fix reviewed baseline issues.
- [ ] Resolve isolated CPU torch/torchvision/timm lock, verify strict load and parity, record memory/latency.

Exit: reviewable decisions, reproducible baseline, model artifact identity and honest runtime capability. No live voice before security work.

## 2. Identity and data foundation

- [ ] Choose SMS/admin identity providers; design additive Prisma migration from required Clerk/email.
- [ ] Implement phone OTP, single-consume challenge, expiry/attempts/resend, atomic Redis quotas and secure sessions.
- [ ] Add optional profiles/consent/farms, capabilities and per-owner queries.
- [ ] Fix API redaction/idempotency, private upload/storage validation and audit.

Exit: farmer can log in without email, skip profile and access only their own resources; admin uses stronger auth. Race/IDOR/abuse tests pass.

## 3. Farmer flow and private inference

- [ ] Extend documented farmer/auth/admin route groups without root conflicts; reuse shadcn variants.
- [ ] Build crop/camera/gallery/preview/retake/result/history with accessible localized states.
- [ ] Implement private FastAPI lifecycle/health/readiness/bounded work and secure Next.js client.
- [ ] Persist diagnosis/provenance, raw+conditional scores, uncertainty and cancellation.
- [ ] Expert-labelled field/unsupported-image evaluation, threshold policy and display-language signoff.

Exit: authenticated end-to-end real photo assessment, no silent mocks, measured latency/limits, explicit uncertainty/expert path.

## 4. Weather and approved knowledge

- [ ] Open-Meteo typed adapter, consented locality, timestamp/unit-aware cache and failure fallback.
- [ ] Source/rights/locale/effective-version approval workflow; no draft chemical guidance seeded as approved.
- [ ] Expert-reviewed qualitative weather advisories with provenance, no fabricated probabilities.

Exit: guidance retrieval returns only applicable approved content; weather outage does not fabricate readings.

## 5. Protected expert/admin portal

- [ ] Review queue/assignment/case review, crop/condition management and separate knowledge approval.
- [ ] Restricted farmer support, outbreak-report review, aggregate monitoring and audit access.
- [ ] MFA and permission tests, audited reads/writes; no farmer portal access.

Exit: authorized expert can review uncertain cases and approve a versioned source; privilege/ownership tests pass.

## 6. GenAI and Vapi

- [ ] Replace insecure demo webhook/client identity overrides and direct-DB agent persistence.
- [ ] Implement server-created call binding, provider authentication, expiry/replay protection and narrow tools.
- [ ] Add bounded graph, minimal context/memory, approved-fact prompts and deterministic chemical fragments.
- [ ] Redacted LangSmith evaluation and consented provider retention settings.
- [ ] Voice language/latency tests, cross-user/injection/replay/hallucination/failure tests.

Exit: farmer voice follows up on their own result with sourced safe answers, explicit mute/end and text fallback. Assistant activation is a later authorized step, not this task.

## 7. Reliability and deployment review

- [ ] Pilot-device/bandwidth/accessibility tests, backup restore/deletion and privacy/security reviews.
- [ ] Build immutable web/inference images and complete dev/production Compose, private storage and secrets.
- [ ] Demo limitations and evidence; deployment approval only after concrete reviewable artifacts.
- [ ] Kubernetes only if chosen deployment warrants it; offline research a separate evaluated phase.

Exit: reproducible pilot and measured limits; no accuracy/outbreak/translation/compliance claims beyond evidence. No auto commit, push or deploy.
