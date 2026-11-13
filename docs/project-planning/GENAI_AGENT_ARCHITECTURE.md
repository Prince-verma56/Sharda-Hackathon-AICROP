# Generative AI agent architecture

Status: controlled LangGraph/LangChain preparation confirmed; graph/runtime provider details proposed. No workflow is activated.

Extend `ai/agents/langgraph.ts` and `ai/workflows` for a bounded intent/tool/evidence/safety graph. Reuse `ai/core`, `ai/providers` and `ai/generation` abstractions; the existing `@langchain/core`/`@langchain/langgraph` dependencies avoid a second agent backend. Exact SDK APIs must be validated against installed versions before implementation.

State: request/call/session references, server-bound farmer scope, locale, intent, optional diagnosis reference, typed tool facts with source/version/time, permitted memory summary, output and safety/handoff status. Server-created state is authoritative; utterances, retrieved documents and model-generated IDs cannot change identity or permissions.

Graph: authenticate -> permitted context -> intent -> narrow read tool -> validate facts -> approved knowledge -> short explanation -> output safety -> voice/text -> consented summary save through backend. Diagnosis intent fetches an owned existing result or asks for a photo. Weather intent fetches authorized farm weather and reports its timestamp. Unknown intent asks one question. Tool failure leads to explicit unavailable/handoff, never invented facts.

Initial read allowlist and draft JSON schemas are in `ai/voice/crop-assistant.tools.json`. No direct DB or arbitrary URL fetch is available. Future feedback/callback/profile writes need narrow schemas, separate permissions and confirmed user action. Existing direct-DB AI memory/RAG modules are quarantined from the farmer execution path until adapted to backend services.

Prompts: reuse `ai/prompts` with versioned system and response templates. Explain only classifier/approved-tool evidence in short localized sentences. Treat model scores as uncalibrated, no severity/laboratory claims. Do not generate chemical instructions; approved chemical fragments are rendered verbatim outside creative generation. If unapproved/stale/wrong locale, withhold and offer expert support. Draft system text: `ai/prompts/system/crop-assistant.preparation.md`.

Proposed limits: 10 graph steps, 6 tools/turn, one retry for idempotent reads, strict deadlines/cancellation and output length. Keep state/checkpoints scoped to user+voice session; no shared conversation thread. Memory records require consent, source, expiry, correction and deletion; no inferred names, guessed crops/locations or unverified feedback as fact.

LangSmith: proposed integration under existing observability module, disabled until privacy review. Log node/tool names, latency, version and redacted failures; never raw prompt/tool payloads, phone, OTP, exact GPS, images, credentials or default transcripts. Official references: https://docs.langchain.com/oss/javascript/langgraph/overview and https://docs.langchain.com/langsmith/home . Evaluation gates: tool scoping, injection, ambiguous diagnosis, unsafe treatment request, stale/contradictory sources, dialect comprehension, output safety, cost/latency and human escalation. LLM model/vendor, recording policy and exact pilot languages remain open.
