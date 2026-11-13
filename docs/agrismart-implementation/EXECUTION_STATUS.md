# Execution status

Last updated: 2026-11-13.

| Loop | Status | Key evidence |
|---|---|---|
| 0 Baseline | passed | [LOOP-00](LOOP-00-BASELINE.md) |
| 1 Upstream clone | passed (existing clone verified) | `C:\Development\SIH_2026-upstream-reference` @ `9db1605`, clean |
| 2 Upstream audit | passed | [reuse matrix](LOOP-02-UPSTREAM-AUDIT.md) |
| 3 Model verification | passed | SHA-256 `ffaffb1e…a08a`, 344,160,243 B |
| 4 Real inference | passed | 3/4 samples correct; parity with upstream ≤ 1e-5; 275–440 ms CPU |
| 5 FastAPI | passed | 50 pytest tests |
| 6 Next.js integration | passed | 13 vitest tests; live requests |
| 7 Model lab UI | passed | real-browser click-through, desktop + mobile |
| 8 Docker | passed | healthy in 12 s; identical results; load shedding verified |
| 9 End-to-end | passed | 18 HTTP cases + offline + load failure + browser |
| 10 Documentation | passed | this folder; project-brain ADR-001 + test matrix results appended |

## Files changed

**Modified (tracked):** `proxy.ts`, `providers/auth-provider.tsx` (dev-only Clerk bypass), `vitest.config.ts` (`server-only` alias), `eslint.config.mjs` (ignore `.venv`/upstream), `docker/compose.ai.yaml` (ai-inference service), `.env.example` (inference vars). The user's `.gitignore` change was left as is.

**Added:** `ai/diagnosis/*`, `app/api/v1/diagnosis/**`, `app/api/v1/crops/route.ts`, `app/dev/**`, `tests/unit/diagnosis.test.ts`, `ai/services/inference/{app/**, tests/**, Dockerfile, Dockerfile.dockerignore, requirements.lock}`, `ai/models/agrismart-india/scripts/export_upstream_evaluation.py`, `ai/models/agrismart-india/reports/upstream_evaluation.json`, `docs/agrismart-implementation/**`.

**Updated (untracked, from the preparation phase):** `ai/models/agrismart-india/predict.py` (device selection, `predict_image`, `globalTop`), `scripts/verify_runtime.py`, `ai/services/inference/{README.md, CONTRACT.md, requirements.txt}`, `ai/services/.gitignore`.

**Archived (not deleted):** `ai/services/inference/app.py`, `test_service.py` → `ai/services/inference/_archive/prototype-v0/`.

**Local only (git-ignored):** `.env.local`, `ai/services/inference/.env`, `ai/services/inference/.venv`, checkpoint.

## Commands executed (main)

`npm ci` · venv + CPU torch install · `pytest` · `unittest` · `verify_runtime.py` · `export_upstream_evaluation.py` · `uvicorn` · `next dev` · `next build` · `tsc` · `eslint` · `vitest` · `docker compose build/up --wait` · E2E scripts (HTTP + CDP browser).

No commits, pushes, migrations, deployments or Vapi changes were made.

## Remaining work / limitations

1. **Field validation:** collect labelled phone photos from Indian farms; measure accuracy per crop; calibrate a confidence/abstain threshold.
2. **OOD detection:** `LOW_GLOBAL_EVIDENCE` (0.10) is a provisional heuristic; a real chart scored 0.0996. Add a leaf/plant gate or embedding-distance check validated on a labelled set.
3. **Corn common rust** sample misclassified as gray leaf spot; corn field performance should be checked.
4. **GPU:** code supports CUDA; CUDA torch wheels not installed (GTX 1650 present).
5. **Persistence:** diagnosis history (Prisma) and farmer auth flow belong to the app backend — not built here.
6. **Licence review** before any commercial/public deployment.
7. Old pip-only `ai/models/agrismart-india/.venv` and `_archive/` can be deleted by the owner.
8. 40 pre-existing lint warnings in template files (the font bug noted earlier is fixed).

## Follow-up (same day): home page, voice keys, template fixes

- **Home page `/`** replaced the create-next-app placeholder with the CropAI landing page from the supplied design: `app/page.tsx` + `components/marketing/home/*` (header with active-section underline and shadcn `Sheet` mobile menu, hero with overlapping feature `Card`, about with scan frame and floating result card, how-it-works, stats band, supported crops, CTA, footer). shadcn components: Button, Card, Badge, Separator, Sheet. Motion: GSAP ScrollTrigger on the existing Lenis smooth scroll (`home-motion.tsx`: hero intro, parallax, reveals, count-up, line drawing, floating card, scan line); disabled for `prefers-reduced-motion`. Palette scoped in `.theme-crop` (globals.css); Manrope font.
- **Honest copy:** design placeholders (2M+ farmers, 95 % accuracy, 40 % yield, yield/soil features) replaced with real figures — 59 crops, 387 diseases & pests, 94 % upstream test accuracy with crop selected (footnoted). Unbuilt features carry a "Soon" badge. "Healthy Crop 96 %" is a real model output.
- **Photos:** 8 Unsplash-License images in `public/images/home/` (credits in `CREDITS.md`); replace any file with the same name.
- **CTAs** ("Try AI Advisor", "Get Started", "Start for Free") open `/dev/model-lab` in development and `/register` in production until the farmer diagnosis flow exists.
- Verified: desktop 1440 px and mobile 390 px full-page captures, no horizontal overflow, no console errors, every animated element ends visible; build prerenders `/` as static.
- **Template fixes:** `globals.css` `--font-sans` self-reference (whole app fell back to serif) → Geist; Lenis ticker cleanup in `animations/smooth-scroll/provider.tsx` removed a different function than it added.
- **Vapi:** keys added to git-ignored `.env.local` under existing names (`VAPI_API_KEY` server-only, `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VOICE_MODE=vapi`); private key verified with a read-only `GET /assistant` (200). `NEXT_PUBLIC_VAPI_ASSISTANT_ID` left empty — none of the 4 existing assistants is the crop assistant.

## Next

Farmer-facing diagnosis flow (auth, upload, history), LangGraph tool wrapping `@/ai/diagnosis`, Vapi function handler, weather context.
