# MV-VRA Frontend UI Revamp

## Context

MV-VRA is feature-complete through Phase 11 — all six flows (F1–F6) build end to end, 190 tests pass. The **backend is done; the frontend never got a design pass.** The UI reads as a functional scaffold, not a product.

What exploration actually found:

- **Tokens landed, the design did not.** `app/globals.css` (183 lines) faithfully implements `DESIGN-SYSTEM.md` §3 — semantic colors, risk-severity ramp, radius scale, z-index scale, a complete `.dark` block. From §4 onward, almost nothing was built. Of 18 named feature components in §4, three exist. §5 (charts) is 0% built. The `--chart-1..5` and `--z-*` tokens are referenced by **nothing**.
- **No `card.tsx` primitive exists.** Every panel in the app is a hand-written `rounded-lg border p-4` div. Also missing: `sidebar`, `breadcrumb`, `avatar`, `chart`, `form`, `scroll-area`, `accordion`, `switch`, `pagination`.
- **Nine installed primitives are dead code**: `skeleton`, `progress`, `sheet`, `command`, `calendar`, `popover`, `dropdown-menu`, `separator`, `input-group`.
- **Shell is a flat 56px topbar** with six copy-pasted `<Link>`s — no sidebar, no active-route state, no breadcrumbs, no page-header pattern. Container widths are inconsistent across pages (`max-w-4xl` / `max-w-2xl` / `max-w-xl` / full-bleed).
- **Dashboard is still the 20-line Phase 2 placeholder** printing raw `userId`/`workspaceId` in mono. `app/page.tsx` still says "Phase 0 scaffold. No features are built yet."
- **Executive Roll-up is four tables of raw numbers.** No KPI tiles, no charts, no trend.
- **Zero `loading.tsx` / `error.tsx` / `not-found.tsx` anywhere.** No `<Suspense>` under `app/(internal)/`. Every page blocks on its full data fetch before painting.
- **Sonner is mounted and never called** — `toast` has zero hits outside `ui/sonner.tsx`. Every form surfaces one generic `Alert` banner; the string `'Something went wrong. Please try again.'` is duplicated in ~8 files. No field-level errors, no `aria-invalid`, no `aria-live`.
- **Dark mode is dead code** — the `.dark` block exists but no `ThemeProvider` ever sets the class.
- **`risk-register-client.tsx` (446 lines) hand-rolls a raw `<table>`** instead of using `ui/table`, and puts `key` on the wrong element (React key warning).
- **Portal violates its own spec**: 14px body text (§3 requires 16px minimum), no progress indicator, no submit blocker list, and it leaks internal vocabulary — `Status: under_review` and `control_id` are rendered straight to the vendor, which §7 rule 8 explicitly forbids.
- **Severity is color + text only, no icon** — violating §3's "color is never the only indicator," a hard requirement in a tool colorblind reviewers use to make risk calls.

**Outcome:** a bold, modern enterprise SaaS console that looks like a product a CISO would buy, without touching a single line of the service/repository/auth layer beneath it.

---

## Decisions taken (confirmed with the project owner)

| Decision           | Choice                                                                                                 | Consequence                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visual direction   | **Bolder modern SaaS** — gradient accent bands, soft elevation, larger type scale, animated stat cards | Contradicts `DESIGN-SYSTEM.md` §2, which rejects gradients/glass for data-heavy dashboards. §2 gets **amended**, with a `DECISIONS.md` entry recording the override and the risk.                        |
| New dependencies   | `recharts`, `@tanstack/react-table`, `motion` (framer-motion)                                          | `CONSTRAINTS.md` #1 satisfied — approved this session. All three are UI-layer-only.                                                                                                                      |
| Scope              | **Everything** — internal console + vendor portal                                                      | Two density languages per `DESIGN-SYSTEM.md` §1. Portal is its own phase and does **not** inherit the bold treatment wholesale.                                                                          |
| Component sourcing | shadcn registry primary, 21st.dev opportunistic                                                        | 21st MCP catalog search is erroring (`catalog search failed`) and the account is free-tier: **2 code retrievals/day**. Retry during the build; spend retrievals only on the dashboard hero and KPI card. |

### Guardrails that survive the revamp

`CONSTRAINTS.md` #9 says no direct DB access from UI components. Existing server pages call repositories/services directly — that is the established pattern and it is **not** in scope to change. The load-bearing chain is:

```
getCurrentSession() → new XRepository({ workspaceId: session.workspaceId }) or service fn
  → serialize (ObjectId.toString(), Date.toISOString())
  → initial* prop → client component → fetch('/api/*') → router.refresh()
```

**Tenant scoping rides on `session.workspaceId` being threaded into every repo/service constructor.** Any refactor that moves a data fetch must carry that context with it or tenant isolation silently breaks. There are **no Server Actions** in this codebase; do not introduce them as a side effect of a visual change. Adding `loading.tsx` / `<Suspense>` is purely additive and safe.

Also untouchable: auth logic (`CONSTRAINTS.md` #2), the two source specs in the repo root (#7), and template/archive immutability (#11, #12).

---

## Skills to load, per phase

Load these **before** writing the code they govern — not after.

| Phase                                                      | Skills                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| All UI work                                                | `ui-ux-pro-max` (already run — see Design Direction below), `frontend-design`, `frontend-dev-guidelines`                          |
| Foundation / tokens                                        | `tailwind-design-system`, `tailwind-patterns`, `shadcn`, `21st-registry`                                                          |
| Component sourcing                                         | `21st-ui-explore` → `21st-ui-build` → `21st-ui-review` (retry the MCP each phase; fall back to shadcn silently if still erroring) |
| Shell + routing                                            | `nextjs-app-router-patterns`, `nextjs-best-practices`, `react-best-practices`, `react-patterns`                                   |
| Charts — **mandatory before the first line of chart code** | `dataviz`, then `ui-ux-pro-max --domain chart`                                                                                    |
| Tables                                                     | `react-ui-patterns`, `typescript-pro` (TanStack column defs are generics-heavy)                                                   |
| Motion                                                     | `fixing-motion-performance` (transform/opacity only; `prefers-reduced-motion`)                                                    |
| Accessibility pass                                         | `accessibility-compliance-accessibility-audit`, `wcag-audit-patterns`, `fixing-accessibility`, `screen-reader-testing`            |
| Verification                                               | `webapp-testing`, `claude-in-chrome`, `ui-visual-validator`, `verification-before-completion`                                     |
| Review                                                     | `code-review`, `everything-claude-code:frontend-patterns`                                                                         |

---

## Design direction (from `ui-ux-pro-max --design-system`)

Query: `enterprise GRC risk dashboard admin console data-heavy professional`

- **Style:** Data-Dense Dashboard — KPI cards, data tables, grid layout, maximum data visibility. `⚡ Excellent` performance, `✓ WCAG AA`.
- **Effects sanctioned by the skill:** hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, loading spinners.
- **Anti-patterns:** ornate design, no filtering.
- **Charts** (`--domain chart`): Line for trend (fill 20% opacity), horizontal grouped Bar for comparison sorted descending, stacked Bar over pie (pie flagged `⚠ hard for accessibility`), Radar capped at 5–8 axes. **Every chart needs a data-table alternative.**
- **shadcn stack rules:** use `<SidebarProvider><Sidebar>`, never a custom `<div className="w-64 fixed">`. Use `<Table>`, never a div grid. — This directly condemns the current shell and `risk-register-client.tsx`.

**Bold layer on top** (the approved override): a gradient accent band on page headers and the dashboard hero, `shadow-md` elevation on KPI/stat cards, a larger display type scale, count-up animation on stat values. Gradients stay **out of** table rows, form fields, and anywhere a risk color carries meaning — a gradient behind a severity badge would compromise the one thing the palette must communicate unambiguously.

---

## Phases

Each phase ends green on `npm run verify` before the next begins. `CONSTRAINTS.md` #13 (one logical change per request) is honored by treating each phase as its own reviewable unit.

### Phase 0 — Guardrails and docs (before any code)

1. Fill `docs/ROLLBACK.md` "Active plan" — this touches every UI module. **There is still no git commit anywhere in this repo** (carried forward since Phase 0, `DECISIONS.md` 010). Raise this before starting: a revamp of ~7,200 lines of UI with no baseline commit has no revert path. Recommend committing the current tree first.
2. `docs/DECISIONS.md` — new entry: bold-SaaS override of `DESIGN-SYSTEM.md` §2, the three new dependencies, and why gradients are scoped away from risk semantics. Version-pinned to `claude-opus-5`.
3. `docs/DESIGN-SYSTEM.md` — amend §2 (style direction), extend §3 (elevation, gradient, motion tokens), mark §4's inventory as now-being-built.
4. Open `docs/features/ui-revamp.md` as the running trace.
5. `npm i recharts @tanstack/react-table motion`.

### Phase 1 — Design foundation

- **`app/globals.css`**: keep the existing semantic + risk tokens as-is (they are correct and load-bearing). Add: elevation scale (`--shadow-card`, `--shadow-float`, `--shadow-overlay`), gradient tokens (`--gradient-hero`, `--gradient-accent`), motion tokens (`--ease-out`, `--duration-fast: 150ms`, `--duration-base: 200ms`), and a global `@media (prefers-reduced-motion: reduce)` block — currently absent repo-wide despite §3 requiring it. Wire the declared-but-unused `--z-*` scale into the components that need it.
- **Verify the dark palette rather than trusting it.** The file's own header comment admits dark values are "a straight inversion, not separately verified for contrast." Check every dark pairing against 4.5:1 before shipping the toggle.
- **`app/layout.tsx`**: mount `next-themes` `ThemeProvider` (dependency already present, currently only `ui/sonner.tsx` consumes `useTheme`). Keep Inter + JetBrains Mono; add a display weight for the new large type scale.
- **Install missing shadcn primitives**: `card`, `sidebar`, `breadcrumb`, `avatar`, `chart`, `scroll-area`, `accordion`, `switch`, `form`, `pagination`, `hover-card`. Style stays `base-nova`; these resolve to `@base-ui/react`, not Radix.

### Phase 2 — App shell

- **`app/(internal)/layout.tsx`** — replace the flat topbar with `SidebarProvider` + collapsible `Sidebar`: grouped nav (Overview · Vendors · Assessments · Risk · Governance), active-route highlighting, icon + label, collapse to icon rail. Lucide only, no emoji.
- **Topbar**: breadcrumbs (from the new `breadcrumb` primitive — `assessments/[id]` currently hand-rolls one from `text-xs` links), workspace switcher promoted to always-visible, theme toggle, user avatar menu (`dropdown-menu`, currently dead code).
- **Command palette** — `⌘K`, built on the already-installed-but-unused `command` primitive. Jump to vendor / template / risk, plus actions.
- **New shared components** under `components/layout/`: `PageHeader` (title, description, breadcrumb slot, action slot, optional gradient band), `PageContainer` (one container width, ending the `max-w-4xl`/`max-w-2xl`/full-bleed inconsistency), `EmptyState`, `StatCard`.
- **Boundaries**: `loading.tsx` (skeleton matching each page's real layout, so nothing jumps), `error.tsx`, `not-found.tsx` for `app/(internal)/`, `app/(portal)/`, and root. This finally uses `ui/skeleton.tsx`.
- **`app/page.tsx`**: replace the stale Phase-0 text — redirect to `/dashboard` or `/login` by session state.
- **`app/login/page.tsx`**: branded split-screen — product identity on one side, form on the other.

### Phase 3 — Dashboard and Executive Roll-up

- **`app/(internal)/dashboard/page.tsx`** — replace the placeholder entirely. Gradient hero band, KPI row (total vendors, Tier 1 count, open risks, overdue CAPs, unscored vendors), risk-posture trend, tier distribution, an attention queue (overdue CAPs, assessments awaiting review, unscored vendors), and recent activity from `audit_events`. Reuse the existing repositories — no new service layer unless an aggregate genuinely has no reader, in which case add it under `lib/services/` following the established `TenantContext` signature.
- **`app/(internal)/rollup/page.tsx`** — keep `getExecutiveRollup(session.userId)` and its **per-membership authorization loop exactly as is** (`DECISIONS.md` 024 — it takes a bare `userId`, not a `TenantContext`, deliberately). Render its output as: stacked bar for tier distribution across workspaces, grouped horizontal bar for open risks by severity, bar for CAP age buckets. **Keep the existing tables** as the mandatory data-table alternative — move them behind a "View as table" toggle rather than deleting them.
- Charts use `--chart-1..5` and the risk tokens, never recharts' defaults. Load the `dataviz` skill first.

### Phase 4 — Data tables

Build one `components/data-table/` set on TanStack: sticky header, column sort, faceted filters, column visibility, global search, pagination, row-click navigation, per-table empty and loading states.

Apply to:

- `app/(internal)/vendors/page.tsx` — becomes the `VendorInventoryTable` §4 specifies (sort, tier/status/BU filters).
- `components/risks/risk-register-client.tsx` — **replaces the hand-rolled raw `<table>`**, fixing the misplaced React `key` along the way. Group by category per §4.
- `app/(internal)/templates/page.tsx`, `components/admin/admin-users-client.tsx`, `components/sharing/sharing-client.tsx` (currently `<ul>` lists, not tables).

### Phase 5 — Domain components

The `DESIGN-SYSTEM.md` §4 inventory, finally built:

- `RiskTierBadge` — **icon + label + color**, and a `null` tier renders a visible **"Not scored"** warning state, never blank and never green. This closes the current color-only violation.
- `SeverityBadge`, `StatusBadge` — replacing the ad-hoc `TIER_STYLE`/`STATUS_STYLE` maps duplicated across `vendors/page.tsx` and `templates/page.tsx`.
- `ScoreBreakdown` — factor-by-factor points and the weights version. The score must be explainable, not just displayed.
- `AssessmentProgress` — counts only currently-visible questions (suppressed excluded from both numerator and denominator; a progress bar that counts hidden questions destroys trust). Uses the dead `ui/progress.tsx`.
- `ResponseReviewPane` — side-by-side response + evidence, raise-risk inline (`assessment-review-client.tsx`, 447 lines).
- `OffboardingChecklist` — stepper with stages, owners, certificate slots (`offboarding-panel.tsx`, 328 lines).
- `CapTaskList` — overdue emphasis beyond color alone.

### Phase 6 — Forms and feedback

- **Migrate every success/error to `toast()`.** Sonner is mounted and unused; ~8 files duplicate `'Something went wrong. Please try again.'`. Keep `Alert` only for persistent, in-context blockers.
- **Field-level validation** — share the existing server-side Zod schemas in `lib/` with the client via the `form` primitive. `aria-invalid` + `aria-live` on every error. No client-side schema may diverge from the server's; the server stays authoritative.
- **`vendor-intake-form.tsx`** (316 lines, one flat form) → sectioned wizard with progress and a live inherent-score preview.
- **`vendor-document-upload.tsx` / `portal/evidence-upload.tsx`** → real `EvidenceUploader`: drag-drop, per-file progress, accepted types and size cap stated **before** the picker opens (reuse `lib/uploads/constraints.ts`, which already holds the shared rule).
- Date fields → `calendar` + `popover` (both currently dead code) instead of bare `<input type="date">`.

### Phase 7 — Vendor portal

Deliberately **not** the bold treatment. `DESIGN-SYSTEM.md` §1: low density, one section per screen, 16px minimum body text (currently 14px), 44×44px touch targets, prose capped at 70ch. A vendor abandoning a half-finished questionnaire is a business failure.

- `app/(portal)/portal/layout.tsx` — real branded shell with a persistent progress indicator. (Also fixes the inert `border-border` with no `border-b`, so the header currently has no visible border at all.)
- `portal-otp-login-form.tsx` → the §4 `OtpForm`: 6 separate paste-aware inputs, `autocomplete="one-time-code"`, attempts-remaining message.
- `assessment-answer-form.tsx` → visible autosave (`Saved 14:32`, not a transient "Saving…"), honest progress, an announcement when branching reveals new questions, resume-where-left-off.
- `ValidationSummary` at submit — every blocker an anchor link that scrolls to and focuses its field.
- **Plain language throughout.** Strip `Status: under_review` and `control_id` from vendor-facing output — §7 rule 8. Every terminal state (expired OTP, expired session, submitted assessment) gets a next action and a contact route.

### Phase 8 — Motion, a11y, responsive

- Motion via `motion`: page transitions, stat count-up, staggered list entry, chart draw-in. **Transform and opacity only**, 150–200ms, `ease-out`. Hover feedback through color and border, never scale — scale shifts layout. `prefers-reduced-motion` disables all of it.
- Full §6 accessibility sweep: 4.5:1 everywhere (including the newly-verified dark palette), visible focus rings, `<label for>` on every input, `aria-label` on every icon-only button (there will now be many — today there are no icons at all), keyboard-completable questionnaire, no emoji as icons.
- Responsive at 375 / 768 / 1024 / 1440. Wide tables scroll inside their own container, never the page. Fixes the `grid-cols-5` admin form and the 10-column risk table.

---

## Files

**Heaviest edits:** `app/globals.css`, `app/layout.tsx`, `app/(internal)/layout.tsx`, `app/(portal)/portal/layout.tsx`, `app/(internal)/dashboard/page.tsx` (full rewrite), `app/(internal)/rollup/page.tsx`, `app/page.tsx`, `app/login/page.tsx`.

**New:** `components/layout/{app-sidebar,page-header,page-container,empty-state,stat-card,command-palette,theme-toggle}.tsx`, `components/data-table/*`, `components/charts/*`, `components/domain/{risk-tier-badge,severity-badge,status-badge,score-breakdown,assessment-progress}.tsx`, `loading.tsx`/`error.tsx`/`not-found.tsx` per route group, ~11 new `components/ui/*` primitives.

**Restyled in place** (same props, same data flow — 19 client components): the pattern is identical across all of them, so it is described once rather than enumerated per file. Representative: `components/risks/risk-register-client.tsx` (raw table → TanStack), `components/assessments/assessment-review-client.tsx` (raw divs → split pane), `components/vendor-intake-form.tsx` (flat form → wizard), `components/offboarding/offboarding-panel.tsx` (div rows → stepper).

**Do not touch:** `lib/**` except to add a dashboard aggregate service if one is genuinely missing, `app/api/**`, `proxy.ts`, `scripts/**`, both root `.md` source specs.

---

## Verification

Per `CLAUDE.md` habit 8 — paste real output, never a summary.

1. `npm run verify` (`format:check` → `lint` → `typecheck` → `test` → `build`) green at the end of every phase. **190 tests must still pass** — this is a presentation-layer change; a failing service test means something load-bearing was moved.
2. `npm run dev`, then drive the real app with `claude-in-chrome`:
   - Log in as `admin@mv-vra.local`. Walk every internal route: dashboard, vendors, vendor detail, intake, templates, template builder, assessment review, risks, sharing, roll-up, admin users.
   - Switch workspace; confirm the current workspace is visible at all times and data actually changes.
   - Log in to the portal as a seeded vendor SPOC via OTP (console-logged in dev); answer a question, upload evidence, trigger a validation blocker, submit.
   - Screenshot each surface at 375 / 768 / 1024 / 1440 in both themes. Check for horizontal page scroll at every width.
   - Read the console for React warnings — the `key` warning in the risk register must be gone.
3. Targeted checks:
   - A vendor with a `null` tier renders a **visible "Not scored" warning**, not a blank cell and not a low-risk color.
   - Every chart has a reachable data-table alternative.
   - Keyboard-only: complete a full questionnaire without a mouse.
   - `prefers-reduced-motion: reduce` set in the browser → no animation runs.
   - Contrast-check the dark palette in-browser; it has never been verified.
4. Run `docs/TEST-CHECKLIST.md` gates and paste output.
5. Session close: update `HANDOVER.md` (5 lines), append `DECISIONS.md`, update `ARCHITECTURE.md` if the module map changed, finish `docs/features/ui-revamp.md`.
