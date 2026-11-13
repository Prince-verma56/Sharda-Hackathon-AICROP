# Loop 6 — Next.js integration

Status: **passed** — 13 vitest tests + live requests through Next.js to the real model.

## Pieces

| File | Role |
|---|---|
| `ai/diagnosis/schemas.ts` | Zod schemas for FastAPI responses (rejects anything but `inference_mode: "real"`) and camelCase app DTOs |
| `ai/diagnosis/client.ts` | `server-only` client: env validation, bearer token, timeouts, error mapping, 10-min crop catalogue cache |
| `ai/diagnosis/http.ts` | envelopes `{success, data, meta}`, per-IP rate limit, production access gate |
| `ai/diagnosis/index.ts` | entry point for route handlers and, later, LangGraph tools / Vapi handlers |
| `app/api/v1/diagnosis/route.ts` | `POST` multipart `image`, `crop?`, `topK?` |
| `app/api/v1/diagnosis/status/route.ts` | `GET` service reachability + model status |
| `app/api/v1/crops/route.ts` | `GET` crop catalogue |

The browser only talks to Next.js. The Python URL and token never leave the server (tested).

## Request handling (`POST /api/v1/diagnosis`)

1. Production: requires a signed-in Clerk user (fails closed). Development: open for the model lab.
2. Rate limit 20/min per client (template `rateLimiter`, in-memory cache).
3. Rejects `Content-Length` > 8 MiB + 64 KiB before parsing → 413; non-multipart → 400.
4. Validates image presence/size/declared type, crop id pattern `^[a-z][a-z0-9_]{1,40}$`, `topK` 1–10.
5. Forwards to FastAPI with `Authorization: Bearer …` and `X-Request-ID`.
6. Validates the upstream JSON with Zod; maps errors:

| Situation | Code | HTTP |
|---|---|---|
| FastAPI not running | `INFERENCE_OFFLINE` | 503 |
| Token / URL missing or invalid | `INFERENCE_NOT_CONFIGURED` | 503 |
| Model loading / failed | `MODEL_LOADING` / `MODEL_UNAVAILABLE` | 503 |
| Deadline (`AI_INFERENCE_TIMEOUT_MS`, default 65 s) | `INFERENCE_TIMEOUT` | 504 |
| Busy | `INFERENCE_BUSY` | 429 |
| Image / crop / topK errors | passed through (`IMAGE_INVALID`, `CROP_UNSUPPORTED`, …) | 413/415/422 |
| Unknown upstream error or malformed payload | `INFERENCE_FAILED` / `INFERENCE_BAD_RESPONSE` | 502 |

## Environment (server-only, never `NEXT_PUBLIC_`)

```dotenv
AI_INFERENCE_BASE_URL=http://127.0.0.1:8001
AI_SERVICE_TOKEN=<same 32+ char value as the FastAPI service>
# AI_INFERENCE_TIMEOUT_MS=65000
```

Added to `.env.example`. Local values live in git-ignored `.env.local` and `ai/services/inference/.env`.

## Template changes needed to run

- `proxy.ts` and `providers/auth-provider.tsx`: **development-only** Clerk bypass when Clerk keys are absent — the template previously crashed on every route without keys. With keys, or in production, behaviour is unchanged.
- `vitest.config.ts`: alias `server-only` to its empty module for tests.
- `eslint.config.mjs`: ignore `**/.venv/**` and local upstream copies.
- Use `http://localhost:3000` in dev: Next 16 blocks dev assets for other origins (`127.0.0.1`) unless `allowedDevOrigins` is set.
