# Existing project audit

Audit date: 2026-11-13 (Asia/Kolkata). Status: observed repository facts; future changes explicitly proposed.

## Baseline and preservation

Repository: `Prince-verma56/Fullstack-Hakcthon-Next-JS-Template`, branch `main`, baseline `06d9524`. Initial `git status --short --branch`: `## main...origin/main`, ` M .gitignore`. The existing edit excludes `/crop-doctor-project-brain`; preserve it byte-for-byte. The ignored brain contains 45 planning/index files and remains untouched. No installed `node_modules` was present. No application features are implied to be implemented by planning documents.

Read `AGENTS.md`, README, package manifest, both environment examples, the complete project-brain pack, schema, route handlers, provider interfaces, security, AI, Compose and CI configuration. `AGENTS.md` requires relevant installed Next.js guides before writing Next.js code. This preparation does not change Next.js routes or components.

## Application and UI

- Manifest declares Next.js 16.3.8, React 19.2.8, Prisma 7.10, Zod 4, LangGraph/core, Vapi web, AI SDK and Clerk. Dependencies are declarations, not verified installed packages.
- App Router: root starter page, `(auth)` login/register layout, `(marketing)` layout, `(dashboard)` sidebar layout. Existing generic dashboard is not a farmer UX.
- Existing APIs: health, jobs, files, notifications, realtime, provider webhooks, and `/api/ai/voice`. Exact inventory will be captured in `existing-files.txt` and the planning route document.
- shadcn `components.json`: `base-nova`, React Server Components, TSX, neutral CSS variables, Tailwind CSS 4, Lucide, Base UI primitives, `@/components/ui`. Reuse existing variants. Current `lg` button height is 36px; farmer actions need at least 48px through scoped classes/new variants, without a global redesign.

## Backend and data

There is no `/backend` directory yet. Application infrastructure is in `/server`; domain modules are in `/modules`. Proposed `/backend` owns new crop/farmer application services while delegating existing shared infrastructure to `/server`; do not clone/move both trees.

Prisma PostgreSQL schema includes User, notifications, audit, jobs/scheduling, device registrations, conversations/messages, memory, documents/chunks and pgvector. User currently requires unique Clerk ID and email: incompatible with phone-only signup without a reviewed additive migration. No farmer, farm, diagnosis, crop or guidance tables exist yet.

## Security findings requiring implementation gates

- Clerk middleware exists, but middleware alone does not enforce the proposed roles. `server/api/index.ts` assigns every signed-in user mock `user` permissions. `modules/auth/authorization.ts` has only `admin`/`user` roles.
- OTP has an interface, not the required complete SMS lifecycle. Cache is in-memory; rate limiting uses non-atomic read/modify/write and shares the fallback anonymous key. Redis configuration does not make it a Redis implementation.
- API catch paths expose raw error messages and logs need redaction. Idempotency needs actor/operation scoping and durable atomic completion.
- `/api/ai/voice` is demonstration scaffolding: lacks verified provider authentication and server-bound call ownership, accepts conversation references from payload, and has incomplete end-call idempotency. Do not activate it.
- AI persistence modules import the database directly; context-free RAG has an unscoped retrieval branch. Existing AI persistence cannot be used by farmer agents as-is. Route all personal context/memory through restricted backend services.
- `/api/v1/files/upload` does not invoke the imported authenticated API wrapper, buffers uploads before any documented limit, constructs a placeholder public-looking URL and returns raw error messages. Generic image processing fabricates 1024x768 dimensions; document extraction/RAG uses dummy text. None is a secure private upload or real image-quality implementation.
- `ai/context/builder.ts` gives a guest `user` permissions, loads a supplied conversation ID without an ownership predicate, and applies identity overrides after trusted fields. The generic registry allows all READ tools to guests. These must not be used for farmer data/tool access until hardened.

## AI modules and infrastructure

Existing `/ai`: agents, context, conversation, core, generation, guardrails, memory, observability, prompts, providers, rag, tools, voice, workflows, plus mcp. Preserve them. Vapi provider/config and LangGraph are existing scaffolds; observability is console logging, not a completed LangSmith integration. No model checkpoint or dedicated Python inference service exists.

`docker/compose.dev.yaml` has pgvector PostgreSQL 16, Mailpit, pgAdmin and Redis 7 behind the `redis` profile. `infra:up` does not enable that profile. Base and AI Compose files have empty services. No production Compose, application Dockerfile or Kubernetes manifests were found. Do not claim a cluster exists. Local default credentials and published database/cache/admin ports are development-only.

CI defines install, typecheck, lint, tests and build. No dependencies installed locally at audit start; record validation limitations rather than claiming these passed.

## Planning reconciliation

The brain confirms minimal farmer OTP entry, optional profile, separate admin, shadcn, Vapi, PostgreSQL/Redis, Docker first and Kubernetes later. Its earlier `ai-model/` placement is superseded by this request: all adopted ML belongs in `/ai`. Its model-only import assumption is refined to full upstream audit with selective lawful reuse. Open provider, language, target crop, licence and retention decisions remain open.

Next: clone full upstream to sibling, inventory and inspect all sections, then record reuse decisions before integration.
