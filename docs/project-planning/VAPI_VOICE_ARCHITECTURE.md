# Vapi voice architecture

Status: Vapi provider confirmed by user. Existing SDK scaffolding observed; assistant/account configuration proposed and untouched.

Reuse `ai/voice/providers/vapi.ts`, `interface.ts`, `factory.ts`, `config.ts` and existing voice components. Do not create a duplicate provider. Draft behavioural configuration and tool schemas live beside them as preparation-only JSON. They are not a deployment payload and contain no active assistant ID, endpoint or secret.

Lifecycle proposed: authenticated farmer explicitly starts voice -> backend records consent and creates opaque scoped session -> server-verifiable Vapi call binding -> browser handles microphone/transport -> provider-authenticated tool webhook -> per-call and per-owner authorization -> approved facts -> regional-language response -> explicit end/revoke -> backend saves minimum permitted metadata. A phone number, caller-ID, client `variableValues.userId`, role or arbitrary conversation ID never authorizes access.

Endpoints: `POST /api/v1/assistant/session`, `/assistant/webhook`, `/assistant/tools/[toolName]`. Session endpoint requires farmer login/CSRF, quotas and feature flags. Provider endpoints require configured server credentials, assistant/call binding, schema/expiry validation and atomic replay/duplicate handling; they do not rely on browser cookies arriving with server webhooks. The full design is [AI and voice architecture](../upstream-integration/04-ai-and-voice-architecture.md).

Current Vapi documentation supports Custom Credentials referenced by `credentialId` for server configuration, including bearer/OAuth/HMAC: https://docs.vapi.ai/server-url/server-authentication . Select and integration-test the mechanism before coding. Do not invent HMAC headers or assume every event has a signed timestamp. With static credentials, deduplicate provider event/tool-call IDs and use expiring server session state. Transport authentication does not authorize farmer records by itself.

Existing `/api/ai/voice` is an unsafe demo path for this product: provider auth/call ownership are missing, context is not securely bound, end-report deduplication is incomplete. Existing client adapter forwards identity metadata and arbitrary context text. Do not activate the assistant or FEATURE_VOICE until that path is replaced/hardened, direct-DB AI persistence is removed from the call path and cross-user/replay tests pass.

Reuse existing environment names: `VAPI_API_KEY` server-only, `NEXT_PUBLIC_VAPI_PUBLIC_KEY` public client key, `NEXT_PUBLIC_VAPI_ASSISTANT_ID` only if needed by client. Proposed new `VAPI_WEBHOOK_SECRET` represents the chosen dedicated server credential; confirm naming/account config before use. Never add parallel `VAPI_ASSISTANT_ID`/LLM key aliases without a reason.

UX: one question at a time, selected language, visible listening/speaking/reconnecting status, mute/end, captions, replay result, fallback text, retry without duplicate side effects. No default recording or transcript retention; explicit consent and provider retention verification required. Dialect/STT/TTS choices, supported languages, telephony vs web-first scope and budget are open. Offline pre-recorded MMS voices are an upstream reference with NC restrictions and no native review, not an approved substitute for Vapi.
