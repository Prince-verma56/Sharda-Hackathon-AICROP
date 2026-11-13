# Loop 7 — Model Laboratory UI (`/dev/model-lab`)

Status: **passed** — driven in a real headless Edge browser (CDP): crop picked from the dropdown, photo attached to the file input, **Run diagnosis** clicked, result rendered 0.5–1.4 s later. Screenshots: [desktop](evidence/model-lab-desktop-tomato.png), [mobile 390 px](evidence/model-lab-mobile-corn-auto.png); no horizontal overflow on mobile.

## Access

- `app/dev/layout.tsx` calls `notFound()` unless `NODE_ENV !== 'production'` or `ENABLE_DEV_TOOLS=true`. Verified: the production build serves `/dev/model-lab` with HTTP 404.
- `robots: noindex`. Sample photos are served by the dev-only `GET /dev/model-lab/samples/[name]` from the git-ignored local upstream folder (name allow-list; path traversal returns 404).

## Files

`app/dev/layout.tsx`, `app/dev/dev-tools.ts`, `app/dev/model-lab/page.tsx` (server: reads `samples.csv`), `app/dev/model-lab/_components/model-lab.tsx` (client), `app/dev/model-lab/samples/[name]/route.ts`.

## What it shows

- **Header** — backend connected/offline, model loaded/loading/unavailable (+ error code), model version, CPU/CUDA, "Real inference" badge; polls status every 4 s until loaded, then every 30 s.
- **Input** — shadcn `Select` populated from `GET /api/v1/crops` (59 crops + "Auto-detect"), class list and upstream macro-F1 for the selected crop, Top-k select, drag-and-drop / click-to-browse with preview, replace and remove, client-side type/size checks.
- **Samples** — the four PlantDoc photos with CC BY 4.0 attribution tooltip; ground truth is shown next to the result.
- **Result** — healthy/disease badge, crop source (user vs model), condition name, score bar, global score, margin, selected-crop mass, global top class when it differs, "Review required" alert with every advisory and its basis, top-k list with upstream per-class precision tooltips, global crop evidence, photo-quality metrics, inference / service / round-trip latency, device, checkpoint hash, preprocessing id, disclaimer.
- **Errors** — offline, not configured, model loading/unavailable, invalid image, unsupported crop, too large, timeout, busy; each with a fix hint and retry button.
- **Session runs** — table of runs in this tab (nothing persisted).

shadcn components used: Card, Button, Select, Badge, Progress, Alert, Skeleton, Separator, Tooltip. No other component library was added.

Note: the template's `globals.css` maps `--font-sans` to itself, so the app fell back to a serif font; fixed globally in Loop 10 follow-up (home page work).
