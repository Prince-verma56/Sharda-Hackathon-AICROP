# Open decisions and blockers

Status: unresolved unless explicitly marked confirmed. No owner/provider/language choices are invented.

| Decision / blocker | Evidence and consequence | Suggested next owner / gate |
|---|---|---|
| Model/software/dataset permissions | Model NC research/education; no global code licence; source datasets mixed NC/ND/SA. Sponsor/demo/redistribution scope needs review | Project owner + rights reviewer before sharing/activation |
| Model runtime and field validation | Strict adapter boundary-tested; torch/timm load/parity and local performance not demonstrated | ML engineer + agronomist before confidence policy |
| Unsupported-image detection | Closed-set classifier always chooses known classes; quality != leaf/OOD | ML/expert team before confident farmer wording |
| Pilot crops/region/languages | 59 crops does not mean suitable field coverage everywhere; 13 translations are drafts | Product owner + native/agronomic reviewers |
| Guidance authority | Upstream chemical advice unreviewed; generic matcher unsafe | Agricultural expert before seeding any approved content |
| Farmer SMS/auth provider | Clerk/email current schema incompatible with phone-only assumption; provider/DLT/delivery requirements need verification | Backend owner + project owner before migration |
| Admin identity and grants | Stronger auth/MFA required; no staff accounts/role assignments selected | Security/product owner before portal |
| Private image store + retention | Provider, quotas and deletion/backup policy unspecified | Backend/privacy owner before uploads |
| Voice provider lifecycle | Vapi confirmed; assistant ID/config, STT/TTS/languages, secure call binding, credential mechanism and retention not selected | Voice/security owner before activation |
| LLM vendor/model/budget | Existing provider scaffold only; safety/latency/cost need evaluation | AI/product owner before rollout |
| Agent boundary refactor | Current AI memory/context/RAG directly access DB; guest READ tools and insecure voice demo exist | Backend/AI owners before farmer tools |
| Redis implementation | Compose service exists; runtime cache is in-memory/non-atomic | Backend owner before OTP/rate-limit activation |
| Production environment | No web/inference Dockerfiles or runnable production images/secret setup; examples are drafts | DevOps owner after local vertical slice |
| Dependency checks | Node modules absent; typecheck reports missing modules/types, lint cannot resolve local ESLint, Vitest unavailable; installed Next.js docs unavailable; ML requirements not a tested lock | Engineering owner before version-sensitive code/runtime |
| Offline capability | Quantized models/audio/device constraints/rights need independent validation | Later research ADR; no MVP offline promise |
| Outbreak research data | No linked historical verified disease/weather corpus | Future data/expert project; no disease probability feature now |
| Brand | Working title only; final brand deliberately not selected | Project owner later |

Confirmed decisions remain: preserve Next.js template/user changes, `/backend` app services and `/ai` intelligence, private FastAPI, phone OTP/optional profile, separate admin, shadcn, PostgreSQL/Redis, Vapi, Open-Meteo context, Docker first/Kubernetes later, no deployment/commit/push in this task. Documents provide proposed values and gate criteria rather than changing these choices silently.
