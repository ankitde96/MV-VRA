# MV-VRA Frontend UI Revamp — Round 2

## Context

UI Revamp Round 1 (`docs/UI-REVAMP-PLAN.md`, `docs/features/ui-revamp.md`) shipped a
competent flat Swiss-SaaS console — 190/190 tests green, `npm run verify` clean throughout.
The project owner's read after using it: **still looks basic**. An internal pilot is
imminent.

Two problems, found by reading the actual dashboard/rollup code and the design doc it was
built against:

- **`DESIGN-SYSTEM.md` §2 explicitly rejected Glassmorphism** ("critical accessibility",
  "data-heavy dashboards"). Round 1's `DECISIONS.md` 025 only partly lifted the ban —
  gradients on headers/hero/stat-cards, glass stayed out entirely.
- **Analytics are counters, not risk posture.** `lib/services/dashboard.ts` computes six
  count-based KPIs and one trend. `DESIGN-SYSTEM.md` §5 specified **five** charts; only
  three exist (`risk-trend`, `severity-bar`, `tier-distribution`) — grouped-bar and radar
  were never built. The executive roll-up (`app/(internal)/rollup/page.tsx`, 43 lines) has
  **zero charts**. No cycle times, no rates, no aging, no reassessment tracking exist
  anywhere — none of the KRIs a TPRM program is actually judged on.

**Outcome:** a visually modern, glass-and-depth SaaS console whose dashboards answer real
vendor-risk questions, without compromising the one thing that must stay unambiguous — risk
color.

---

## Decisions taken (confirmed with the project owner via `AskUserQuestion`)

| Decision             | Choice                                                                                       | Consequence                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Glass scope          | **App-wide** — chrome, hero, KPI cards, modals, popovers, nav                                | `DESIGN-SYSTEM.md` §2's glass rejection lifted (`DECISIONS.md` 028).                                                                                                          |
| Risk-color exemption | Severity/tier/status badges and risk-colored table cells stay **flat, solid, high-contrast** | Colorblind reviewers make Tier-1 calls off these colors; frosting them degrades the signal. Non-negotiable, unchanged from every prior style decision.                        |
| KPI/KRI data scope   | **Additive schema fields + audit-event backfill**                                            | Six nullable Date fields on Assessment/Risk. Unlocks cycle-time, MTTR, aging, reassessment-overdue KRIs. Contract value/dates stay excluded (deliberately cut from MVP spec). |
| Surfaces             | Dashboard rebuild, executive roll-up rebuild, new per-vendor risk scorecard, portal polish   | Portal stays low-density/plain-language per §1/§7 — polish, not a cockpit; no charts or KPIs there.                                                                           |
| Dependencies         | Pre-approved for this round (`CONSTRAINTS.md` #1 exception, `DECISIONS.md` 028)              | Add whatever fits best; each package still gets its own `DECISIONS.md` entry recording name/version/why.                                                                      |
| Sequencing           | Phased — verify + commit each phase                                                          | Git baseline now exists (`0ea5688`), so every phase has a real revert point.                                                                                                  |

### Guardrails that survive this revamp (unchanged from Round 1)

Same load-bearing chain, same untouchables: no direct DB access from UI components
(`CONSTRAINTS.md` #9), tenant scoping via `session.workspaceId` threaded into every
repo/service call, no Server Actions introduced as a side effect, auth logic untouched
(`CONSTRAINTS.md` #2), template/archive immutability untouched (#11, #12). The two source
specs stay read-only inputs (#7).

**New this round:** Phase B adds nullable fields to `Assessment`/`Risk` — additive only, no
field removed or retyped, no migration of existing documents required (they simply read
`null` until written or backfilled). This is schema-touching per `CONSTRAINTS.md`'s spirit
(not auth) — its own `ROLLBACK.md` Active-plan block is filled before it starts.

---

## Skills loaded

`ui-ux-pro-max` (design-system search run — see below), `ui-skills`, `frontend-design`,
`dataviz` (load before Phase C/D chart code — governs palette and the required
data-table-alternative rule).

### Design system search (ui-ux-pro-max)

`--design-system` on "enterprise GRC risk dashboard fintech SaaS glassmorphism dark"
returned an Enterprise-Gateway/marketing pattern with an amber/purple palette — **not
adopted**: wrong pattern (marketing landing, not app), and amber/purple would compete with
the locked risk-severity palette (`--risk-high` is already amber-family). What was kept:

- **Style**: Glassmorphism, confirmed `Best For: ... financial dashboards, high-end
corporate`, condition `⚠ Ensure 4.5:1` — satisfied structurally via high-opacity glass
  tokens (§3 of `DESIGN-SYSTEM.md`), not assumed.
- **Chart domain**: Line chart for trend-over-time, `#0080FF`-family primary, 20% fill
  opacity, colorblind-safe pattern overlays — consistent with the existing `--chart-1..5`
  ramp, no change needed there.
- **Shadcn stack guidance**: compound components (`Card`/`CardHeader`/`CardContent`), CSS
  variables for theming (already the project's convention) — reinforces, doesn't change,
  existing practice.
- **Typography**: kept Inter as the body/data workhorse (tabular figures, zero blast radius
  across 80 components); added **Lexend** as a second `--font-display` face for hero/KPI
  display numerals only — `DESIGN-SYSTEM.md` §3 already named Lexend as its own documented
  accessibility-oriented alternative, so this is drawing on an existing decision, not a new
  one.

**Aesthetic direction** (`frontend-design` skill): _Refined Institutional Glass_ — a
two-direction blend of Luxury/Refined + Minimalist/Severe. DFII: Impact 4, Fit 5 (this is
exactly the enterprise-fintech context glass is rated for), Feasibility 5 (CSS-only, tokens
infra already exists), Performance 4 (blur scoped to a bounded set of chrome/card surfaces,
not the whole viewport), Consistency Risk 2 (tightly scoped via `.glass-panel` utility
classes + the risk-color exemption) → **DFII 16, capped at 15 — Excellent, execute fully.**

---

## The KPI / KRI framework

Split deliberately: **KRIs** measure risk carried (exposure, early warning); **KPIs**
measure how well the program runs (efficiency).

### KRIs — exposure and early warning

| KRI                                                                | Source                                            | Schema                |
| ------------------------------------------------------------------ | ------------------------------------------------- | --------------------- |
| Tier-1 concentration (count + % of portfolio)                      | `Vendor.inherent_risk_tier`                       | today                 |
| Unscored vendors (blind spots)                                     | `inherent_risk_tier: null`                        | today                 |
| Open critical/high risk count                                      | `Risk.severity` + `status`                        | today                 |
| Risk aging — open risks >30/60/90d by severity                     | `Risk.created_at`                                 | today                 |
| Residual risk exposure, trended                                    | `Risk.residual_score` sum/avg                     | today                 |
| Risk-reduction effectiveness — inherent vs residual delta          | `Engagement.inherent_score` vs residual           | today                 |
| Sensitive-data exposure — PII/PHI vendors with open high/critical  | `Engagement.data_classification` × Risk           | today                 |
| Single-source dependency at Tier 1 (continuity risk)               | `Engagement.weights_snapshot.business_redundancy` | today                 |
| Overdue CAPs + max overdue age                                     | `Risk.cap_tasks[].due_date/status`                | today                 |
| Reassessment overdue — Tier-1 vendors past cadence                 | last completed assessment vs cadence              | **`next_review_due`** |
| Portal stall rate — sent >14d, unsubmitted                         | `Assessment.status` + assigned date               | **`due_date`**        |
| Offboarding hygiene — terminated without verified destruction cert | `Offboarding`                                     | today                 |
| Evidence gap rate — answered controls with no evidence             | `Response.evidence`                               | today                 |

### KPIs — program performance

| KPI                                                                        | Source                  | Schema                                    |
| -------------------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| Assessment cycle time — assigned→submitted, submitted→reviewed, end-to-end | Assessment              | **`submitted_at`, `review_completed_at`** |
| On-time completion rate                                                    | vs `due_date`           | **`due_date`**                            |
| MTTR — CAP created→completed, by severity                                  | `cap_tasks[]`           | **`completed_at`**                        |
| CAP closure rate per period                                                | `cap_tasks[]`           | **`completed_at`**                        |
| Risk closure rate / backlog burn-down                                      | opened vs closed weekly | **`Risk.closed_at`**                      |
| Assessment throughput per period                                           | Assessment              | **`review_completed_at`**                 |
| Review coverage — % Tier-1 vendors ever assessed                           | Vendor × Assessment     | today                                     |
| Cross-workspace share reuse (duplicate assessments avoided)                | `SharedDocument` reads  | today                                     |

### Additive fields — three new, not six (`DECISIONS.md` 029)

Reading the models before writing this plan's original draft would have shown three of the
six were already there: `Assessment.submitted_at`/`reviewed_at` and
`Risk.cap_tasks[].closed_at` already exist and are already written (Phases 7/8/9). Only
three fields were actually new:

```
Assessment.due_date         Date|null   set at assignment, from Workspace.settings
Assessment.next_review_due  Date|null   set in completeReview(), from tier cadence
Risk.closed_at              Date|null   set in updateRisk() when status → closed
```

No backfill script was needed in the end — every field is forward-only (set by its writer
going forward) and null-excluded by every analytics aggregation that reads it, so there is
no "missing historical value" gap to fill from `AuditEvent`, unlike the original plan
assumed. If a real historical gap is ever found, a backfill script is still the right tool
(dry-run default, same pattern as `scripts/sweep-orphaned-evidence.ts`) — just not required
by Phase B as built.

Reassessment cadence defaults: Tier 1 = 12 months, Tier 2 = 18, Tier 3 = 24, stored on
`Workspace.settings` so the risk team can change it without a code change.

---

## Phased plan

Each phase ends with `npm run verify` green and its own commit.

### Phase A — Design language foundation ✅ (this session)

- `app/globals.css`: glass surfaces (`--glass-surface/border/highlight`, `.glass-panel`/
  `.glass-panel-sm` utilities), aurora-mesh backdrop (`--gradient-aurora`,
  `.aurora-backdrop`, institutional blue family), grain overlay (`.grain-overlay`,
  hero-only), `prefers-contrast: more` flat fallback.
- `app/layout.tsx`: added Lexend as `--font-display` (hero/KPI numerals only; Inter stays
  the body/data workhorse).
- `docs/DESIGN-SYSTEM.md` §2/§3 amended; `docs/DECISIONS.md` 028 recorded.
- No feature code touched. `npm run verify` green.

### Phase B — KPI/KRI data layer (no UI) ✅ (this session)

- Three new nullable fields, not six — see `DECISIONS.md` 029 (three of the plan's original
  six already existed under different names). Written at `assignAssessment()`/
  `completeReview()`/`updateRisk()`.
- New `lib/services/analytics.ts` — `getWorkspaceAnalytics(ctx)` (single-workspace, mirrors
  `getDashboardSummary()`'s `Promise.all` pattern) and `getRollupAnalyticsSummary(userId)`
  (reuses `executive-rollup.ts`'s per-membership authorization loop, `DECISIONS.md` 024 —
  not collapsed to a single top-level check).
- `reassessment_cadence_months`/`assessment_response_sla_days` added to
  `Workspace.settings`, both with schema defaults — no migration needed.
- No backfill script needed in the end (see the Additive-fields note above).
- Demo-volume seed data deferred to Phase C, once charts actually need judging.
- 9 integration tests in `lib/services/__tests__/analytics.test.ts` against real MongoDB,
  plus new assertions in `assessment-assignment.test.ts`/`assessment-review.test.ts` for
  the three new writers. 201/201 tests green, `npm run verify` clean.

### Phase C — Dashboard rebuild ✅ (this session)

- KPI/KRI cockpit: glass hero with aurora mesh + grain (`PageHeader`'s new `aurora` prop),
  8 glass KRI/KPI tiles (`StatCard`'s new `glass` prop), two new charts
  (`RiskAgingChart` — stacked bar by age bucket, `ResidualExposureChart` — trend line), two
  new watchlists (`KriListCard` — reassessment overdue, portal stalls). Kept Round 1's
  vendor-by-tier and risk-posture charts, attention queue, and recent activity — still
  useful, not replaced.
- `dataviz` skill's palette validator run before writing chart code — found a real,
  pre-existing normal-vision-floor issue in the locked severity palette; not fixed (out of
  scope, its own decision), mitigated via mandatory legend/table-alternative on the new
  chart. See `DECISIONS.md` 030.
- `scripts/seed-demo-data.ts` (new, `npm run db:seed-demo`) — 12-vendor demo dataset so the
  new charts render real spread, not empty states.
- Verified live in Chrome, light + dark, against real seeded data — every KRI/KPI number
  cross-checked against a direct script query. One pre-existing recharts hydration quirk
  noted (client-nav-only, not a regression) — `DECISIONS.md` 030.
- `npm run verify` clean throughout — no schema/service/test changes this phase, only new
  UI consuming Phase B's existing `getWorkspaceAnalytics()`.

### Phase D — Executive roll-up rebuild ✅ (this session)

- Built the two spec'd-but-missing charts: `TierComparisonChart` (grouped horizontal bar,
  vendors per tier per workspace, sorted descending) and `CapAgeBucketChart` (overdue CAPs
  by age bucket per workspace). Both gated to render only when >1 authorized workspace —
  nothing to compare with just one. Radar (control-domain coverage) explicitly **not**
  built — no code anywhere maps risks to a control-domain taxonomy, so it would fabricate
  data; §5 marks it optional.
- Extended `getRollupAnalyticsSummary()` with `vendors_by_tier`/`cap_age_buckets`, same
  per-membership auth loop (`DECISIONS.md` 024/029).
- Caught and fixed a real bug via live browser verification (not assumed): the CAP-bucket
  chart's workspace names collided with its legend in vertical orientation — fixed by
  switching to horizontal, matching the tier-comparison chart. `DECISIONS.md` 031.
- Aurora hero, glass `RollupWorkspaceCard`. Existing per-workspace severity chart/tables
  unchanged (still useful).
- 202/202 tests (1 new), `npm run verify` clean.

### Phase E — Per-vendor risk scorecard ✅ (this session)

- New panel on `app/(internal)/vendors/[id]/page.tsx`: inherent vs residual vs reduction%,
  open risks by severity, assessment history timeline, evidence coverage, CAP status,
  reassessment due.
- Builds `ScoreBreakdown` — spec'd in §4 for Round 1 Phase 3, never built.
- New `getVendorScorecard()` in `analytics.ts` — turned out to need its own function, not a
  `vendor_id` filter on `getWorkspaceAnalytics()` as originally assumed here; several of
  that function's fields are portfolio-wide by definition. `DECISIONS.md` 032.
- Live browser verification caught a real bug: reduction% was hardcoded green regardless of
  sign, but `residual_total` (sum of every open risk) can legitimately exceed a single-scalar
  `inherent_score` once a vendor has several open risks — a vendor whose risk had _grown_
  past baseline would have shown as improved. Fixed via sign-based coloring.
- 204/204 tests (2 new), `npm run verify` clean.

### Phase F — Portal polish (restrained)

- New tokens on portal chrome, OTP screen, progress, cards. Keeps 16px+ text, 44px targets,
  70ch, plain language. No charts, no KPIs, no jargon.
- Finishes two Round 1 debts: `DataTable` migration for `admin-users-client.tsx` and
  `sharing-client.tsx`; remaining ~9 `toast()` conversions.

---

## Verification

Per phase: `npm run verify`, real browser check at 375/768/1024/1440 (light + dark),
composited contrast check on every glass surface carrying text.

End-to-end before calling the whole thing done: demo-seeded walk through
dashboard → roll-up → vendor scorecard → portal, confirm every chart renders non-empty with
a working table alternative; backfill dry-run reviewed before any `--write` run; no KPI
displays a fabricated number where a source timestamp is null.
