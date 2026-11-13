# Project overview

Status: confirmed product direction; implementation pending.

**AI-Based Crop Disease & Pest Early Detection System** helps Indian farmers obtain an initial assessment of crop photographs, understand it through simple regional-language text/voice, and seek verified advice or expert help. It supports timely decisions and aims to reduce avoidable pesticide use; those are goals, not measured outcomes.

Confirmed: retain the custom Next.js 16 template; mobile-number OTP; optional farmer profile; a visual, voice-friendly farmer flow without an analytics dashboard; separate protected expert/admin portal; AgriSmart India v1 candidate; private Python FastAPI inference inside `/ai`; PostgreSQL/Prisma, Redis, shadcn, Vapi and Docker first. Open-Meteo supplies weather context. Kubernetes belongs to a later deployment stage.

Proposed initial journey: choose language -> phone/OTP -> optional profile (skip) -> crop choice -> capture/upload one still image -> candidate assessment -> approved guidance/audio -> optional history/expert review. A farmer can begin without name, email, exact location or farm size. Admin reviews are separate, with stricter authentication.

Observed baseline: template scaffold, not a finished crop application. The full upstream clone remains external and unchanged; its model and application licences are not assumed permissive. No treatment text or translations have been approved for farmers. This preparation introduces model metadata, an original strict adapter, contracts and documentation; actual service/frontend/OTP/voice implementation is deferred.

Open: pilot region/crops/languages, expert review owner, SMS provider, model redistribution rights, deployment target, storage and retention. See OPEN_DECISIONS.md. Success measures proposed: completion of photo flow on representative phones, expert-reviewed assessment utility, uncertainty/retake handling, accessible language/audio, private per-user records and reliable fallbacks. Do not substitute upstream benchmark scores for these measures.
