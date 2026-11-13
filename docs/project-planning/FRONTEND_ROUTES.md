# Frontend routes, layouts and components

Status: existing inventory observed; new routes/layouts proposed. No routes were created or moved.

Existing: `/` starter, `/login`, `/register`, root layout, `(auth)` centered form layout, `(marketing)` layout, `(dashboard)` sidebar layout. Existing API inventory is in `docs/upstream-integration/existing-files.txt`. Route-group names are not URL prefixes. Keep the existing root page in place while planning; do not create a conflicting second `/` in `(marketing)`.

| Planned URL | Purpose | Access / layout |
|---|---|---|
| `/` | Lightweight entry/language/help | Public, existing root |
| `/login`, `/verify-otp` | Phone entry and OTP | Public/challenge, extend `(auth)`; repurpose existing login only in implementation |
| `/profile/setup` | Optional profile; skip available | Farmer; auth/onboarding layout |
| `/home` | Camera-first home | `(farmer)` simple shell, authenticated farmer |
| `/crops` | Photograph/icon crop picker | Farmer; part of diagnosis flow, query state only non-sensitive |
| `/diagnose` | Crop selection, camera/upload, preview | Farmer |
| `/diagnose/[id]/processing`, `/diagnose/[id]` | Polling and assessment | Owning farmer; ownership checked server-side |
| `/history`, `/profile`, `/assistant`, `/help/expert` | Simple cards/profile/voice/escalation | Farmer; own records |
| `/about`, `/help`, `/privacy`, `/terms` | Limits, support and notices | Public/marketing |
| `/admin/login` | Stronger admin login | Separate public admin entry |
| `/admin`, `/admin/cases`, `/admin/cases/[id]` | Review queue/case | Staff with diagnosis review permission |
| `/admin/farmers` | Restricted farmer management | Farmer-management permission |
| `/admin/guidelines`, `/admin/crops` | Approved knowledge/taxonomy | Content/expert permissions |
| `/admin/alerts`, `/admin/system`, `/admin/audit` | Outbreak review/health/audit | Separate explicit capabilities |

Proposed admin grouping: public login outside a protected `(protected)` subgroup, e.g. `(admin-auth)/admin/login` and `(admin)/admin/(protected)/layout.tsx`. A blanket `/admin` layout must not redirect the login page into itself. Use `(dashboard)` only after a review of existing references; no farmer sidebar is inherited by default. Server/API authorization remains mandatory even when navigation is hidden.

| Component inventory | Reuse / planned work |
|---|---|
| `components/ui` Button, Card, Input, InputOTP, Select, RadioGroup, Dialog, Sheet, Alert, Progress, Skeleton, Sonner | Existing Base UI/shadcn `base-nova`, neutral CSS variables, Lucide; reuse APIs and variants |
| Existing data-table, sidebar, tabs, badge, chart | Admin only where needed; no mandatory charts |
| Existing voice button/orb | Inspect accessibility/status; add explicit consent/mute/end/fallback before activation |
| CropPhotoPicker, CaptureGuide, ImagePreview, RetakeAction, QualityWarning | New application components planned, no upstream source or unlicensed crop photos copied |
| AssessmentCard, AlternativesList, ExpertHelpAction, ApprovedGuidanceCard, WeatherContext | Display uncertainty/sources; avoid raw logits/technical English as farmer text |

Capture guidance: one affected leaf in natural light, steady phone, fill the frame, avoid glare/screens, preview and retake. Camera denied/unavailable -> file input. Stop media tracks on exit; capture once and freeze while explaining; do not repeatedly overwrite spoken results. Local brightness/blur warnings are advisory, not leaf or disease detection.

Responsive/accessibility: 320px baseline, single column, fixed primary action only if it does not cover content, 48px targets, visible labels/focus, language-specific `lang`, Urdu RTL if reviewed, text + icon + audio rather than colour alone, captions and mute, reduced-motion support, loading status via live regions, keyboard OTP paste/autofill, plain localized errors. Target languages and licensed crop photography remain open. Test at 200% zoom, keyboard/screen reader, low bandwidth and representative Android camera permissions.

Permission matrix:

| Action | Public | Farmer | Expert | Content approver | Admin/security |
|---|---|---|---|---|---|
| Entry/OTP/help | Yes | Yes | Yes | Yes | Yes |
| Farm/photo/history/voice | No | Own only | Assigned case DTO only | No | Explicit audited support permission |
| Review diagnosis | No | Submit/view own review | Assigned cases | No | Explicit review capability |
| Draft knowledge | No | No | If authorized | Yes | If authorized |
| Approve knowledge | No | No by default | Separate approval grant | Yes, separation of duties proposed | Explicit grant |
| Farmer management/system/audit | No | No | No by default | No | Distinct grants, MFA |

Roles alone are insufficient: each API requires capability plus object scope. Never send admin tools to farmer agents.
