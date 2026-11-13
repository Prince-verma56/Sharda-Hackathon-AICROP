# Application backend boundary

Status: application service layer planned inside the existing Next.js project; no second backend server created.

New farmer-domain services will live here and reuse existing `/server` infrastructure and `/modules` user/auth capabilities. Do not move/clone those implementations in preparation. Backend owns OTP/session lifecycle, capabilities/ownership, farmer profiles/farms, diagnosis orchestration/private storage, guidance approval, notifications, privacy/deletion, audit and restricted voice tools.

All AI models, Python inference, weather intelligence, GenAI graphs/providers/voice/context/RAG/memory abstractions stay in `/ai`. AI agents cannot import Prisma or access the database directly: authorized backend services supply narrow DTOs. Existing legacy direct-DB AI persistence requires refactoring before farmer activation.

See [backend architecture](../docs/project-planning/BACKEND_ARCHITECTURE.md), [database](../docs/project-planning/DATABASE_DESIGN.md), [API contracts](../docs/project-planning/API_CONTRACTS.md) and [security](../docs/project-planning/SECURITY_AND_PRIVACY.md). No farmer routes/migrations/provider credentials are enabled by this directory.
