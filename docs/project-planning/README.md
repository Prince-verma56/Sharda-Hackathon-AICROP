# Engineering preparation index

Working title: **AI-Based Crop Disease & Pest Early Detection System**. Prepared 2026-11-13. No final brand selected.

**Confirmed** means a user requirement or explicit accepted project-brain decision. **Proposed** means a reviewable engineering choice. **Open** means unresolved; it must not be presented as user-approved. **Observed** means inspected code/metadata, not evidence that a product feature works.

This shared pack complements the untouched, ignored `crop-doctor-project-brain` (45 files). The latest task supersedes its `ai-model/` placement and model-only audit scope: all adopted AI is under `/ai`, and the complete upstream is a sibling reference. No application pages, migrations, production services or Vapi assistant were activated.

Read in this order:

1. [Existing audit](../upstream-integration/01-existing-project-audit.md), [clone and inventory](../upstream-integration/02-upstream-repository.md), [reuse audit](../upstream-integration/03-upstream-reuse-audit.md).
2. [Project overview](PROJECT_OVERVIEW.md), [requirements](PRODUCT_REQUIREMENTS.md), [system architecture](SYSTEM_ARCHITECTURE.md).
3. [Frontend routes](FRONTEND_ROUTES.md), [backend](BACKEND_ARCHITECTURE.md), [database](DATABASE_DESIGN.md), [API contracts](API_CONTRACTS.md).
4. [Model](AI_MODEL_INTEGRATION.md), [GenAI](GENAI_AGENT_ARCHITECTURE.md), [Vapi](VAPI_VOICE_ARCHITECTURE.md), [weather](WEATHER_INTEGRATION.md).
5. [Security/privacy](SECURITY_AND_PRIVACY.md), [DevOps](DEVOPS_PLAN.md), [reuse map](UPSTREAM_REUSE_MAP.md).
6. [Implementation phases](IMPLEMENTATION_PHASES.md), [open decisions](OPEN_DECISIONS.md), [validation](../upstream-integration/05-validation-and-changes.md).

The [Hinglish brief](../project-brief/crop-project-explanation-hinglish.md) describes the planned product. The selected integration is technical preparation, not a completed diagnosis product or independent model-performance claim.

## Implementation status (2026-11-13)

The crop-image recognition foundation is implemented and tested end to end: [docs/agrismart-implementation](../agrismart-implementation/README.md) (FastAPI inference service, Next.js API routes, `/dev/model-lab`, Docker). Earlier plans above remain valid; this supersedes the "HTTP service is a contract, not implemented" note in the validation record.
