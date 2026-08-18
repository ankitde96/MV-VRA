# Implement MV-VRA Console redesign (from Claude Design mockup)

## Context

Imported `MV-VRA Console.dc.html` from the Claude Design project
(`claude.ai/design/p/3a1f4b9e-…`) via the `claude_design` MCP. The mockup is a full
interactive prototype (dc-runtime + `support.js`) covering every screen in MV-VRA:
Dashboard, Vendors, Vendor Detail, Risk Register, Assessment Review, Templates,
Executive Roll-up, Login (internal + vendor OTP), and Vendor Portal.

The mockup's own embedded "Design notes" data (`NOTES` array in its script) states
explicitly what it's based on and what it changes — it was built by reading our real
`docs/DESIGN-SYSTEM.md`, `DECISIONS.md`, and current component files, and it makes one
deliberate call: **reverse `DECISIONS.md` 028** (glassmorphism/aurora/grain/gradient-hero,
added app-wide in UI Revamp Round 2) back to the flat, 1px-border "Swiss" discipline
`DESIGN-SYSTEM.md` §2 originally specified — plus a placeholder brand green (`#00A15C`)
since no real Moneyview brand hex was ever supplied.

User confirmed (via `AskUserQuestion`): follow the mockup exactly on visual style (drop
glass/aurora, adopt the placeholder green), skip building the meta "Design notes" screen
(it documents the mockup itself, not the product — `Sharing`/`Users`/`Workspaces` already
exist as real pages, nothing to stub), and add a `business_unit` field to the Vendor
schema (nullable, additive) to support the new "vendors by tier & business unit" chart.

Three Explore agents surveyed the current repo in parallel and confirmed: glass/aurora is
implemented app-wide today (not just chrome); the severity/tier/status color tokens
already match the mockup almost exactly (they're a locked, protected palette per
`DECISIONS.md` 028's own "never" clause — do not touch them); branching (`show_if`) and
autosave already exist in the vendor portal form; the portal is single-page (no wizard);
assessment review has no 3-pane sticky layout; there is no "Review queue" list page yet
(the sidebar's `Assessments → Review queue (4)` nav item in the mockup has nothing to
point at today); Risk Register bypasses the shared `DataTable`.

## Files this touches (survey summary)

- Tokens/shell: `app/globals.css`, `app/layout.tsx`, `app/(internal)/layout.tsx`,
  `app/(portal)/portal/layout.tsx`
- Shared: `components/layout/page-header.tsx`, `stat-card.tsx`, `kri-list-card.tsx`,
  `attention-queue.tsx`, `recent-activity.tsx`, `components/layout/app-sidebar.tsx`,
  `components/data-table/data-table.tsx`
- Domain: `components/domain/risk-tier-badge.tsx`, `severity-badge.tsx`,
  `status-badge.tsx`, `score-breakdown.tsx`, `assessment-history-list.tsx`
- Dashboard: `app/(internal)/dashboard/page.tsx`, `lib/services/dashboard.ts`,
  `components/charts/*` (residual-exposure, risk-aging, tier-comparison,
  cap-age-bucket, risk-trend, tier-distribution, severity-bar)
- Vendors: `app/(internal)/vendors/page.tsx`, `components/vendors/vendors-table.tsx`,
  `app/(internal)/vendors/[id]/page.tsx`
- Risk: `app/(internal)/risks/page.tsx`, `components/risks/risk-register-client.tsx`
- Assessments: `app/(internal)/assessments/[id]/page.tsx`,
  `components/assessments/assessment-review-client.tsx`, new
  `app/(internal)/assessments/page.tsx` (Review queue — net new)
- Templates: `app/(internal)/templates/page.tsx`, `components/templates/templates-table.tsx`
- Roll-up: `app/(internal)/rollup/page.tsx`, `components/rollup/rollup-workspace-card.tsx`
- Auth/portal: `app/login/page.tsx`, `app/(portal)/portal/login/page.tsx`,
  `components/portal-otp-login-form.tsx`, `components/portal/assessment-answer-form.tsx`,
  `components/questionnaire/question-renderer.tsx`
- Data: `lib/db/models/vendor.ts` (add `business_unit`), `lib/services/dashboard.ts`
  (add tier-by-BU aggregation), `lib/repositories/assessment-repository.ts` (Review
  queue query)

## Phase 0 — Save this plan into the repo

Copy this plan file into `docs/features/mv-vra-console-redesign.md` (Habit 5 full-trace
doc) at the start of implementation, so it lives with the repo's other docs, not just in
`~/.claude/plans/`.

## Phase 1 — Design tokens (reverse 028, adopt mockup palette/type)

- `app/globals.css`: remove `--glass-surface`, `--glass-border`, `--glass-highlight`,
  `--glass-blur*`, `.glass-panel`/`.glass-panel-sm`, `--gradient-aurora`,
  `.aurora-backdrop`, `.grain-overlay`, `--gradient-hero`, `--gradient-accent`, and the
  `@media (prefers-contrast: more)` glass-degrade rule (dead code once glass is gone).
- Replace brand tokens: `--primary` → `#00A15C` (action), add `--primary-strong: #00874D`
  (hover/links), `--ink-dark: #062B20` (sidebar/login dark panel), `--brand-tint: #E8F6EF`.
  **Do not touch** the severity tokens (critical/high/medium/low/neutral) — they are
  already correct and are the one thing every prior decision protects.
- Shift the generic neutral/border/background grays toward the mockup's cooler
  green-tinted scale (`#F6F8F7` bg, `#E4E9E6` border, `#5C6B64` muted text, `#8B9A93`
  faint text, `#D3DAD6` divider) — same role each token already plays, new values.
- Fonts: swap `next/font/google` Inter + Lexend + JetBrains Mono → **Geist + Geist Mono**
  only (mockup's TYPE note: single grotesk family, weight variation only, no separate
  display face). Update `--font-sans`/`--font-mono`, drop `--font-display` and its call
  sites (`page-header.tsx` display text, KPI numerals) to use `--font-sans` at weight 600.
- Strip every `.glass-panel`/`.glass-panel-sm`/`aurora`/`grain-overlay` usage found by the
  survey (`page-header.tsx` `aurora` prop, `stat-card.tsx`/`kri-list-card.tsx`/
  `rollup-workspace-card.tsx` `glass` prop, vendor detail page, login page, portal layout,
  `portal-otp-login-form.tsx`, `score-breakdown.tsx`, `assessment-history-list.tsx`,
  chart components) back to flat `bg-card border border-border`. Remove the now-dead
  `glass`/`aurora` boolean props from these components rather than leaving unused flags.
- Log a new `DECISIONS.md` entry reversing 028's glassmorphism call (cite the mockup's own
  DECISION note as the trigger + the project owner's confirmation), and update
  `DESIGN-SYSTEM.md` §2/§3 to match (tokens table, font family, reinstate the
  Glassmorphism-rejected line). Fill `docs/ROLLBACK.md` "Active plan" first: safe commit
  `4556945b0c9419f9e13cf833e3e438ae42e05eb8`, files = the token/shell files above.

## Phase 2 — Shared components & sidebar

- `app-sidebar.tsx`: add `Assessments → Review queue` nav item (icon `ClipboardCheck` or
  similar Lucide, badge count = assessments awaiting review), linking to the new
  `/assessments` route from Phase 4.
- Re-skin `PageHeader`, `StatCard`, `KriListCard`, badges to the flat card style (1px
  border, 8px radius, no shadow/blur) using the new tokens — no prop-shape changes beyond
  dropping `glass`/`aurora`.

## Phase 3 — Dashboard

- Reuse existing `DashboardSummary` fields (`vendors_by_tier`, `risk_posture_trend`,
  `attention_queue`, `recent_activity`) — no need to duplicate data already fetched.
- Add `business_unit` to `Vendor` schema (`lib/db/models/vendor.ts`): optional string,
  nullable/`"Unassigned"` default, no backfill migration needed. Surface it in the vendor
  intake form, vendor detail header, and `VendorsTable` (new column).
- Extend `lib/services/dashboard.ts` (or add a small dashboard-only aggregation) to group
  `vendors_by_tier` by `business_unit` for the new **"Vendors by tier & business unit"**
  stacked-bar section, replacing the dashboard's current `TierDistributionChart` slot.
- Re-skin `risk_posture_trend` into the mockup's **"Risks raised vs. closed"** grouped
  monthly bar chart (reuse existing weekly `{week, opened, closed}` data — no new query —
  the current `RiskTrendChart` already renders this data, this is a chart-type/style swap,
  not new data plumbing).
- Keep `ResidualExposureChart` and `RiskAgingChart` as-is (already match the mockup).
- `TierComparisonChart`/`CapAgeBucketChart` stay Roll-up-only (mockup doesn't put them on
  the Dashboard either).

## Phase 4 — Vendors, Vendor Detail, Risk Register, Templates

- `VendorsTable`: add tier + lifecycle filter chip rows above the table (segmented
  button groups, mirrors the mockup's `tierChips`/`lifeChips`), driving `DataTable`'s
  existing search/filter state — no new filtering primitive needed, just a chip UI wired
  to the same state `DataTable` already exposes via column filters.
- Vendor detail: visual-only re-skin (flat cards); structure already matches the mockup
  (scorecard, tiles, history, SPOC, documents, assessments, offboarding).
- Risk Register: keep the existing hand-rolled table (functional parity: overdue-CAP
  banner, severity/status filters, CAP expansion, `+CAP`/`Review ↗` actions) but restyle
  the severity/status `Select` filters as chip buttons to match the mockup, and re-skin to
  flat cards.
- Templates list: add `sections`/`questions` count columns (computed from
  `template_snapshot`/`questions_schema` — `sections.length` and summed
  `section.questions.length`, no schema change) and a "Preview" action linking into the
  portal's read-only render for that template.

## Phase 5 — New "Review queue" page

- `app/(internal)/assessments/page.tsx` (net new): server component, same pattern as
  `vendors/page.tsx` — `AssessmentRepository.find({ status: { $in: [...] } })` joined with
  vendor names, rendered through the shared `DataTable`. Columns: vendor, template
  version, status, submitted date. Row click → existing `/assessments/{id}`.

## Phase 6 — Assessment Review layout

- Restructure `assessment-review-client.tsx` into the mockup's 3-column sticky layout:
  left = section nav (reuse existing section grouping already computed for the metrics
  bar), center = scrollable answer cards, right = sticky "Raise risk" quick-form +
  "Reviewer notes". Keep all existing functionality (the 5-state `CONTROL_STATUS_BADGES`,
  `RaiseRiskDialog`, evidence list, mitigation guidance) — this is a layout change, not a
  logic change. Re-skin the 7 metric tiles to `StatCard`.

## Phase 7 — Executive Roll-up

- `RollupWorkspaceCard`: replace the chart/table-toggle body with the mockup's fixed
  5-metric grid (Tier 1, Open risks, Overdue CAPs, Residual sum, Avg. reduction) plus a
  derived posture badge (`Elevated` if Tier 1 or overdue-CAP count crosses a threshold,
  else `Stable` — simple derived label, no new backend field). Keep
  `TierComparisonChart`/`CapAgeBucketChart` as the two top-of-page charts (already correct).

## Phase 8 — Login & Vendor OTP

- Keep the two routes separate (internal `/login` uses email/password against real auth;
  portal OTP uses a different backend flow) — **do not touch auth logic**
  (`CONSTRAINTS.md` #2). Re-skin both to the mockup's split-screen layout: dark
  `--ink-dark` left panel with tagline + `loginStats`-style metrics, flat form on the
  right.
- Add a cross-link: internal `/login` gets "I'm a vendor — sign in with a code →" linking
  to `/portal/login`; portal login gets "Internal sign in" linking back to `/login`. Purely
  navigational, no shared state/toggle.
- Drop the mockup's "3 attempts remaining" OTP copy — the verify API doesn't return an
  attempts count today, and this pass isn't touching auth logic to add one; don't fabricate
  it.

## Phase 9 — Vendor Portal wizard

Biggest behavioral change. Current `assessment-answer-form.tsx` already has autosave and
`show_if` branching (via `computeVisibility`) — reuse both untouched.

- Add step state (current section index) to the answer form; render one section per
  screen instead of all sections in one scroll.
- Add a step-pill bar (done/current/upcoming, mirrors mockup's `portalSteps`) and a
  progress bar/count using the existing visible-question count logic.
- Add a structured "Before you submit" panel: reuse `computeVisibility` + the existing
  required/evidence checks (same logic `portal-assessment.ts`'s `submitAssessment` already
  runs for its `missing` list) to build a client-side blocker list with jump-to-question
  links, replacing the current single joined-string error alert on submit failure.
- `QuestionRenderer`: add a `size="portal"` (or similar) variant for large touch-friendly
  option buttons (44px+ targets, big radio-card style) used only inside the portal —
  keep the builder-preview default variant unchanged so the two never diverge in _what_
  renders, only in touch-target sizing/spacing.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run test` (per `docs/TEST-CHECKLIST.md`) —
  paste real output, not paraphrase.
- Manual pass in dev server: `grep` sweep for leftover `glass-panel|aurora-backdrop|
grain-overlay` (should be zero outside `globals.css`'s own removal diff), then click
  through Dashboard → Vendors → Vendor Detail → Risk Register → Templates → new Review
  queue → Assessment Review → Roll-up → Login (both modes) → Vendor Portal wizard
  end-to-end, confirming severity/tier/status badges never went glass (the one
  non-negotiable carried through every prior decision).
- Update `docs/HANDOVER.md`, append `DECISIONS.md` entries (028 reversal, `business_unit`
  field addition, Review queue page), update `FLOW.md`/`ARCHITECTURE.md` for the new
  Review queue route and the dashboard's new BU aggregation path.
