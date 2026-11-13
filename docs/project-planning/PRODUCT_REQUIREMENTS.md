# Product requirements

Status: confirmed scope below; acceptance targets are proposed until tested.

| Requirement | Acceptance evidence |
|---|---|
| Phone + OTP entry, minimal registration | Verify expiry, resend cooldown, attempts, one-time consume, generic errors and secure session; no required email/name |
| Skippable profile | Preferred name/language/state/district/village/main crops/farm size/location/voice preferences individually optional and editable later |
| Simple farmer home | One large primary camera/check action, crop photographs/icons with text/audio, secondary history/voice; no analytics dashboard |
| Crop/photo assessment | Supported crop picker, camera/gallery fallback, preview/retake, upload progress, meaningful invalid/unsupported/uncertain states |
| Honest result | Candidate condition/top alternatives, model version, score meaning, review warning, no inferred severity/lab confirmation |
| Approved guidance | Source/date/reviewer/locale/version; empty/unavailable response when unapproved; no generic pesticide fallback |
| Weather context | Consented approximate locality, provider/time/cache age, units, forecast vs current distinction; no invented disease probability |
| Voice | Explicit start/end/mute, chosen language, scoped diagnosis/weather/history tools, fallback text/audio, consent before retention |
| Expert/admin portal | MFA/strong auth, explicit review/content/security permissions, minimum necessary farmer data, audited reviews/approvals |
| Privacy | Private photographs, ownership checks, deletion workflow, minimized third-party context, no real farmer fixtures in Git |

Proposed non-functional targets: useful operation at 320px viewport and 200% text zoom, at least 48px primary touch targets, keyboard and screen-reader access, visibly distinct processing/error states, cancellation and bounded retries. Latency/concurrency/SLO and offline guarantees remain open until measured on real devices and the chosen host.

Out of initial implementation: new model training, validated outbreak forecasting, automatic spraying/purchases, complete offline inference, all 13 unreviewed locales, Android application copying, production Kubernetes cluster, bulk notifications and a conventional farmer dashboard. Expert escalation must be available when the model cannot support a safe assessment.
