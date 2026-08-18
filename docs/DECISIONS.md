# DECISIONS.md — Why, Not Just What

> Guide habit 2. Code shows what changed; this shows why. Six months from now the "why" is
> the only thing that stops a settled argument from being re-litigated.
>
> **Append only.** Never rewrite history — if a decision is reversed, add a new entry that
> supersedes the old one and link them. Every entry is version-pinned (habit 14): behaviour
> shifts between AI versions, and knowing which one reasoned through a change matters when
> you're debugging it later.

### Entry format

```
## [YYYY-MM-DD] NNN — Short title
**Decision:** what was decided
**Context:** what forced the choice
**Rationale:** why this, and why not the alternatives
**Alternatives rejected:** option — reason
**Consequences:** what this now constrains or costs
**Decided by:** human name / AI model+version
**Supersedes / Superseded by:** entry number, if applicable
```

---

## [2026-08-18] 031 — UI Revamp Round 2, Phase D: executive roll-up gets its two missing DESIGN-SYSTEM.md §5 charts; a real label-collision caught by live verification, fixed by orientation, not a workaround

**Decision:** Built the two roll-up charts `DESIGN-SYSTEM.md` §5 specified in Round 1 but
were never built — the executive roll-up (`app/(internal)/rollup/page.tsx`) had zero charts
despite being the board-reporting surface, the single biggest gap-to-spec in the app.

1. `TierComparisonChart` — grouped horizontal bar, vendors per tier per workspace, sorted by
   Tier 1 count descending, per §5's literal spec ("Horizontal bar, grouped, sorted
   descending").
2. `CapAgeBucketChart` — overdue CAP tasks by age bucket, per workspace. Built vertical
   first (matching `RiskAgingChart`'s single-workspace pattern), but live browser
   verification (light + dark) showed a real defect: with only 2-3 workspaces, full
   workspace names as vertical-bar x-axis category labels collided with the legend row
   below the chart. Fixed by switching to horizontal orientation (matching
   `TierComparisonChart`) rather than truncating names or shrinking the legend — the
   dataviz skill's own step 7 ("render it and look at it — the validator checks color, not
   layout") is exactly what caught this; it would not have been caught by typecheck, lint,
   or the test suite.
3. Extended `getRollupAnalyticsSummary()` (`lib/services/analytics.ts`, Phase B) with
   `vendors_by_tier` (full tier1-3+unscored breakdown, not just `tier1_count`) and
   `cap_age_buckets`. Renamed the bucket keys from `"0-30"`/`"90+"`-style strings (used in
   `RiskAgingChart`'s bucket _value_, fine there) to `d0to30`/`d90plus`-style identifiers
   here, because in `CapAgeBucketChart` each bucket is a recharts `dataKey` _and_ a
   `ChartContainer` config key that gets turned into a `--color-${key}` CSS custom
   property — a leading digit and a literal `+` are not something to trust across browsers
   as a generated custom-property/dataKey suffix, so the technical key and the display
   label were split (`{ label: "90+ days", ... }` on a `d90plus` key).

**Context:** `docs/UI-REVAMP-2-PLAN.md` Phase D. `DESIGN-SYSTEM.md` §5's chart table names
five charts for the roll-up; Round 1 (`docs/features/ui-revamp.md`) shipped zero — this
phase closes that gap for the two required ones (line/stacked-bar/radar were either already
covered by other pages or explicitly optional).

**Rationale:** Reusing `getExecutiveRollup()`'s existing per-membership authorization loop
inside `getRollupAnalyticsSummary()` (rather than adding a parallel authorization path) was
already decided in Phase B (`DECISIONS.md` 029) — this phase just adds the two new fields to
that existing loop. The horizontal-orientation fix generalizes: any future cross-workspace
comparison chart in this app should default to horizontal bars once workspace names are the
category axis, not vertical — full entity names don't fit as rotated/truncated x-axis
ticks at the scale this app's typography uses.

**Alternatives rejected:**

- _Truncate workspace names or rotate x-axis labels to fix the collision_ — rejected;
  truncating a workspace's own name in its own reporting dashboard is a worse trade than
  changing chart orientation, and rotated labels are harder to scan at a glance than a
  horizontal bar's full-width category axis.
- _Build the optional radar chart (control-domain coverage)_ — rejected for this phase; no
  code anywhere maps risks/controls to a "control domain" taxonomy, so a radar chart would
  either fabricate data or need a new taxonomy decision — out of scope for a chart-layer
  task. `DESIGN-SYSTEM.md` §5 itself marks it optional.

**Consequences:** `lib/services/analytics.ts`'s `CapAgeBuckets` interface uses
`d0to30`/`d31to60`/`d61to90`/`d90plus` — any future consumer of `WorkspaceKriSummary` should
use these field names, not the display-string versions `RiskAgingBucket` uses for its
`bucket` value. The two new charts only render when `analyticsSummary.workspaces.length > 1`
(gated in the page, not the chart component) — a single-workspace comparison chart has
nothing to compare, so it's hidden rather than shown with one lonely bar.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), implementing Phase D of
`docs/UI-REVAMP-2-PLAN.md`.

---

## [2026-08-18] 030 — UI Revamp Round 2, Phase C: risk-severity palette validated (one pre-existing hard-fail flagged, not fixed), demo-data seed script, recharts hydration quirk noted

**Decision:** Three things settled for Phase C (dashboard rebuild):

1. Ran the `dataviz` skill's `validate_palette.js` against the project's actual chart colors
   before writing any chart code, per the skill's required procedure. The locked
   risk-severity palette (`--risk-critical`/`--risk-high`/`--risk-medium`/`--risk-low`) came
   back with a real finding: light-mode critical↔high (`#b91c1c`↔`#b45309`) sits at
   normal-vision ΔE 9.1 — below the validator's 15 floor, meaning even full-color-vision
   readers can find the two hard to tell apart in a bare color swatch. **Not fixed** — the
   palette is locked (`DESIGN-SYSTEM.md` §2/§3, restated in `DECISIONS.md` 028) and
   recoloring it is its own decision with its own blast radius (every badge, table cell, and
   existing chart in the app), not something to change as a side effect of building one new
   chart. Mitigation: every new severity-colored chart (`RiskAgingChart`) ships an
   always-visible legend, tooltip labels, and a mandatory table alternative — exactly what
   the validator itself prescribes for a WARN/FAIL band ("legal only with secondary
   encoding") and consistent with `DESIGN-SYSTEM.md` §3's pre-existing "icon + label + colour
   always" rule.
2. `scripts/seed-demo-data.ts` (new, `npm run db:seed-demo`) — 12 demo vendors with a
   realistic spread of tiers, risks, CAP tasks, and assessment states, so the new KRI/KPI
   charts have something real to render against locally. Deliberately separate from
   `scripts/seed.ts` (auth bootstrap, required for every environment) — this is opt-in
   dev-only visual-verification data, idempotent by a `.demo.mv-vra.local` domain suffix
   (a re-run deletes and recreates its own rows, never touches non-demo data).
3. A pre-existing `recharts` SSR/hydration quirk was surfaced during browser verification —
   not introduced by this phase, but now more likely to be _noticed_ since the dashboard
   went from 2 chart instances to 4. Client-side soft-navigation between two chart-heavy
   pages in the same session (e.g. dashboard → roll-up → dashboard) can produce a hydration
   warning from recharts' internal auto-generated SVG `clipPath` id counter drifting between
   the server and client render passes. Confirmed via a hard reload that a fresh page load
   never shows it — this is a client-navigation-only cosmetic console warning (React
   recovers by re-rendering the affected subtree), not a data or functional bug. Not fixed
   this phase; flagged in `HANDOVER.md` as a known, pre-existing issue worth a real fix
   (e.g. a stable `id` prop threaded through each `ChartContainer`) if it ever surfaces
   visibly to a user rather than only in devtools.

**Context:** `docs/UI-REVAMP-2-PLAN.md` Phase C. The `dataviz` skill (loaded per the plan)
requires running its validator before writing chart code, not eyeballing colorblind safety.

**Rationale:** Point 1 follows the same discipline `DECISIONS.md` has used for every other
locked-palette question in this project (025/028): a real accessibility finding gets
recorded and mitigated at the point of use, not silently absorbed into a bigger unrelated
change. Point 2 exists because Phase B's analytics aggregations are meaningless to look at
against near-empty dev fixtures — every KRI/KPI needs enough spread (varied tiers, risk
ages, CAP states) to actually be checkable by eye, and that data has no reason to be
conflated with the auth-bootstrap seed every fresh environment needs regardless of whether
anyone ever looks at a chart.

**Alternatives rejected:**

- _Re-step the risk-severity colors to clear the validator's normal-vision floor_ — rejected;
  out of scope for a chart-building task, and DESIGN-SYSTEM.md's original entry already
  hand-computed these specific hex values against WCAG contrast — a decision with its own
  reasoning that deserves its own review, not an incidental change here.
- _Fold demo data into `scripts/seed.ts`_ — rejected; would make every fresh clone's
  mandatory bootstrap step slower and noisier for a use case (visual dashboard verification)
  most environments don't need.
- _Chase the recharts hydration warning to a fix now_ — rejected; it's cosmetic
  (React self-heals), pre-existing (not a Phase C regression), and a proper fix means
  auditing every `ChartContainer` usage for a stable id strategy — a separate, scoped task.

**Consequences:** Any future new chart added to a page that already has charts on it should
expect the same recharts id-drift warning under client-side navigation until the underlying
id-stability issue is actually fixed — don't treat it as a new bug specific to that chart.
`npm run db:seed-demo` requires `npm run db:seed` to have run first (needs the default
workspace and an admin user) — it throws a clear error if not. The palette finding stands as
a documented, open item — a future accessibility pass on this app should start from this
entry rather than rediscovering it.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), implementing Phase C of
`docs/UI-REVAMP-2-PLAN.md`.

---

## [2026-08-18] 029 — UI Revamp Round 2, Phase B: three additive timestamp fields (not six — three already existed), cadence/SLA config on Workspace, null-excluded analytics

**Decision:** `docs/UI-REVAMP-2-PLAN.md`'s KPI/KRI framework named six additive fields.
Reading the actual models first (`lib/db/models/assessment.ts`, `lib/db/models/risk.ts`)
found three already exist and are already written: `Assessment.submitted_at` (written in
`portal-assessment.ts`'s `submitAssessment()`), `Assessment.reviewed_at` (written in
`completeReview()` — functionally identical to the plan's proposed `review_completed_at`,
just already under a different name), and `Risk.cap_tasks[].closed_at` (written in
`updateCapTask()`, Phase 9 — identical to the plan's proposed `cap_tasks[].completed_at`).
Only **three** fields were actually new:

1. `Assessment.due_date` — set at assignment (`assignAssessment()`) from
   `Workspace.settings.assessment_response_sla_days` (new, default 21 days).
2. `Assessment.next_review_due` — set in `completeReview()`, derived from the vendor's
   `inherent_risk_tier` and `Workspace.settings.reassessment_cadence_months` (new,
   `{tier1: 12, tier2: 18, tier3: 24}` defaults). Left `null` for an unscored vendor
   (tier `null`) rather than fabricating a due date — the "unscored vendor" KRI already
   covers that gap; this field must not paper over it.
3. `Risk.closed_at` — the risk itself never had a closed timestamp before this (only its
   embedded `cap_tasks` did). Stamped in `updateRisk()` when `status` transitions to
   `"closed"`, cleared to `null` if reopened — mirrors the existing `cap_tasks[].closed_at`
   pattern exactly rather than inventing a different convention.

All three are nullable, default `null`, no migration required — existing documents simply
read `null` until the next write reaches the relevant step, or a future backfill script
runs. `lib/services/analytics.ts` (new) computes the KRI/KPI framework's aggregations;
every field it derives from one of these three (or the existing three) treats a `null`
input as "exclude this record," never "treat as zero" or "default to another date" — same
rule as `DATA-MODEL.md` §4's fail-loud scoring contract, extended to analytics rather than
scoring.

**Context:** Discovered while implementing Phase B of `docs/UI-REVAMP-2-PLAN.md` — the
plan's "six additive fields" section was written from the KPI/KRI framework's _data needs_,
before anyone had actually opened the models to check what already existed. `codegraph`/
`Read` on both models surfaced the overlap immediately.

**Rationale:** Adding `review_completed_at`/`completed_at` alongside the existing
`reviewed_at`/`closed_at` would have created two fields meaning the same thing on the same
document — a duplication bug waiting to happen the first time someone reads the wrong one.
Checking first cost one `Read` call and avoided that. The cadence/SLA defaults
(`reassessment_cadence_months`, `assessment_response_sla_days`) live on
`Workspace.settings` — the same place `risk_weights`/`tier_thresholds` already live — so a
risk team can retune them per workspace without a code change, consistent with how every
other tunable scoring input in this codebase is already modeled.

**Alternatives rejected:**

- _Rename the existing `reviewed_at`/`cap_tasks[].closed_at` to match the plan's original
  field names_ — rejected; a rename touches every existing reader (five-plus call sites)
  for zero functional gain, purely to match a name chosen before the fields were known to
  exist.
- _Derive `next_review_due` from `Vendor.inherent_risk_tier` at read time instead of
  stamping it_ — rejected; a vendor's tier can change after an assessment completes (a
  re-tiering), and stamping at completion time freezes "what cadence applied to _this_
  review," matching how `template_snapshot` freezes what schema applied to _that_
  assessment (`DECISIONS.md` 007) rather than re-deriving from current state.
- _Default `assessment_response_sla_days`/cadence at the analytics-service call site
  instead of on `Workspace.settings`_ — rejected; putting it on the model means it's
  visible and editable the same way every other workspace-level tunable already is, not a
  magic number buried in a service file.

**Consequences:** Any future reader of `Assessment.reviewed_at` or
`Risk.cap_tasks[].closed_at` should know they now do double duty — Phase 9/10's original
purpose (audit trail) and Round 2's KPI purpose (cycle time, MTTR) — without having
changed shape or meaning. `lib/services/analytics.ts`'s MTTR calculation needed one
additional fix during implementation: `cap_tasks` subdocuments have no `created_at`
(`capTaskSchema` isn't timestamped) — resolved by decoding the creation time already
embedded in the auto-generated `task_id` ObjectId (`{ $toDate: "$cap_tasks.task_id" }` in
the aggregation) rather than adding a fourth schema field for something already derivable.
Two framework items from the plan are deliberately not implemented as first-class metrics
in Phase B: "evidence gap rate" is shipped as an approximation
(`evidence_gap_rate_approx`, answered-with-no-evidence rather than "questions that actually
require evidence" — no schema flag exists to join against) and is named accordingly rather
than presented as more precise than it is; "cross-workspace share reuse" is left for a
later pass rather than shipped as a shallow proxy metric.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), implementing Phase B of
`docs/UI-REVAMP-2-PLAN.md` per the project owner's direction and the brainstorming-session
decisions recorded in `DECISIONS.md` 028.

---

## [2026-08-18] 028 — UI Revamp Round 2: Glassmorphism un-rejected app-wide; risk-semantic surfaces stay flat; blanket dependency pre-approval for this round

**Decision:** Two things settled for UI Revamp Round 2 (`docs/UI-REVAMP-2-PLAN.md`):

1. **`DESIGN-SYSTEM.md` §2's explicit rejection of Glassmorphism is lifted.** Glass surfaces
   (`--glass-surface`/`--glass-border`/`--glass-highlight`, `.glass-panel`/`.glass-panel-sm`
   utilities), an aurora-mesh backdrop (`--gradient-aurora`, kept in the institutional blue
   family — not a generic amber/purple fintech preset), and depth are now sanctioned across
   page chrome, hero, KPI/stat cards, modals, popovers, and navigation — supersedes 025's
   narrower "headers/hero/stat-cards only" gradient scope, extending it to glass and to the
   whole app. **The one boundary that does not move**: severity/tier/status badges and any
   table cell carrying a risk color stay flat, solid, border-first — exactly 025/§2's
   original rule, unchanged. A `.dashboard`/`ExecRollupDashboard`/vendor scorecard KPI tile
   may be glass; a `RiskTierBadge` never is.
2. **`CONSTRAINTS.md` #1 (no new dependency without asking first) is pre-approved for this
   round only** — the project owner explicitly lifted it ("remove the restriction on adding
   new libraries... add whatever fits best") rather than requiring a stop-and-ask per
   package. This is a scoped exception for UI Revamp Round 2, not a standing change to
   `CONSTRAINTS.md` itself; each dependency actually added still gets its own entry here
   (name, version, why) so the trail exists even without a prior ask.

**Context:** Round 1 (`DECISIONS.md` 025/026) shipped a competent flat console but the
project owner's read after seeing it live: "still looks basic." An internal pilot is
imminent. `docs/DESIGN-SYSTEM.md` §2 had explicitly named Glassmorphism as rejected
("Frosted panels behind a dense risk table reduce legibility for no gain") — that specific
rejection is what's being reversed here, not the accessibility floor it was protecting.

**Rationale:** The `ui-ux-pro-max` skill's own data rates Glassmorphism `Best For: ...
financial dashboards, high-end corporate` with the caveat `⚠ Ensure 4.5:1` — a condition to
satisfy, not a reason to reject outright. §3's new glass tokens satisfy it structurally: light
glass surfaces are set to 72%+ opacity (not the ~10% a naive glassmorphism preset uses, which
the skill's own pitfall list calls out as illegible), and `@media (prefers-contrast: more)`
degrades `.glass-panel` to a flat `--card` background with no blur — glass is decoration, not
a reading dependency. Keeping risk-semantic surfaces flat is the one non-negotiable carried
forward unchanged from every prior style decision (010-era Swiss direction, 025's gradient
scoping) — the reason has not changed: colorblind reviewers make Tier-1 calls off these
colors, and frosting a red badge is a legibility regression with zero upside. Pre-approving
dependencies for this round (rather than a stop-and-ask per package) matches how the owner
actually wants to move here — fast, with the trail kept via this file rather than via a gate
before each install.

**Alternatives rejected:**

- _Glass on chrome only, keep content cards flat_ — considered and explicitly offered; the
  owner chose full-app glass instead, judging the chrome-only version would still read as
  "basic."
- _No exemption for risk-semantic surfaces, glass everywhere_ — also offered explicitly and
  not chosen; the risk-color legibility argument was accepted without qualification.
- _Standing removal of `CONSTRAINTS.md` #1_ — rejected; the ask was for this round's freedom
  to move fast, not a permanent policy change to a constraint that protects future sessions
  too. Left the constraint text as-is; recorded the scoped exception here instead.

**Consequences:** Any component built or touched from Round 2 forward that renders a
severity/tier/status value must be checked against this rule before it ships — `git grep` for
`risk-critical\|risk-high\|risk-medium\|risk-low` combined with `glass-panel` is a fast
sanity check if this is ever in doubt. Each new dependency this round still needs its own
`DECISIONS.md` entry recording name/version/why, even though no per-package ask happened
first — don't let "pre-approved" become "undocumented." `docs/UI-REVAMP-2-PLAN.md` §Decision
Log has the full brainstorming-session trail (KPI/KRI scope, additive schema fields, phased
sequencing) this entry doesn't repeat.

**Decided by:** Claude Opus 5 (`claude-opus-5`) for the design/brainstorming session and this
decision; Claude Sonnet 5 (`claude-sonnet-5`) implementing Phase A (token layer) — at the
project owner's direction, confirmed via `AskUserQuestion` (glass scope, KPI data scope,
surfaces, sequencing) then explicit follow-up lifting the dependency constraint.

**Supersedes:** 025 (narrows what 025 restricted — extends the sanctioned-surface list from
gradient-only/headers-hero-cards to glass+gradient/app-wide, keeping 025's risk-semantic
exemption intact).

---

## [2026-08-18] 027 — Git baseline finally established; `.gitignore`/`.env.example` added as prerequisites, not scope creep

**Decision:** Ran `git init`-equivalent (the repo already had `origin` configured but zero
commits) and made the root commit: 300 files, all of Phases 0–11 plus the UI Revamp.
Two files were added first, before staging anything, because their absence would have put
secrets or ~1.7GB of generated/dependency content into the first commit: `.gitignore`
(excludes `node_modules/`, `.next/`, `.env*.local`, `.DS_Store`, `tsconfig.tsbuildinfo`,
`coverage/`, `.codegraph/`) and `.env.example` (README already instructed `cp .env.example
.env.local`, but the file didn't exist — added with the same keys as `.env.local`, values
blanked, notably `SUPER_ADMIN_PASSWORD_HASH=`). Pushed to `origin/main`.

**Context:** `DECISIONS.md` 010/011/014/025 all raised the missing git baseline and were
each explicitly deferred by the project owner at the time. `HANDOVER.md` called it "the
single highest-leverage thing to fix before any further work" as of the last thirteen
phases of uncommitted work. This session, the project owner asked directly to push.

**Rationale:** `.gitignore` and `.env.example` aren't separate feature work — committing
without them would have shipped `.env.local`'s real `SUPER_ADMIN_PASSWORD_HASH` (an argon2
hash already flagged as exposed in a prior session transcript per project memory) and
`node_modules`/`.next` (783MB + 975MB) into permanent git history on a public-capable
remote. Both were verified absent from the staged tree (`git status --short | grep` for
each path) before committing, not assumed correct from the `.gitignore` content alone.

**Alternatives rejected:**

- _Commit everything first, clean history after_ — rejected; scrubbing a real secret out of
  git history after the fact requires a history rewrite (`git filter-repo` or equivalent)
  and, if already pushed, is not a full remediation — the secret must be rotated regardless.
  Cheaper and strictly safer to gitignore before the first commit ever happens.
- _Leave `.env.example` absent since it's not what was asked_ — rejected; the checked-in
  `README.md` already instructs `cp .env.example .env.local` as the first setup step, so a
  fresh clone following the README would fail immediately without it. Fixing a doc's own
  broken instruction is a prerequisite of "push the code," not an unrelated addition.

**Consequences:** `origin/main` now has a real history to diff against and revert to —
`ROLLBACK.md`'s "safe commit SHA" field has a value for the first time. Every prior
`DECISIONS.md` entry's "no revert path" caveat (010, 011, 014, 025) is resolved as of this
commit; do not restate it in future entries. `SUPER_ADMIN_PASSWORD_HASH` in the pushed
history's `.env.example` is blank, but the real value in local `.env.local` was already
exposed in a session transcript before this commit — rotating it is a separate, still-open
task, not something this commit fixes.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), at the project owner's direction ("git
is configured, let's push the code").

---

## [2026-08-17] 026 — UI Revamp: pinned `@tanstack/react-table` and `recharts` back to their

last stable major after both broke on the versions `npm i` resolved

**Decision:** Downgraded `@tanstack/react-table` from `9.1.2` to `8.21.3`, and `recharts`
from `3.8.0` to `2.15.4`. Both are pinned with an exact `^8.21.3`/`^2.15.4` semver range,
same as every other dependency in `package.json` — not floated to `latest`.

**Context:** `DECISIONS.md` 025 approved adding both packages for the UI revamp
(`docs/UI-REVAMP-PLAN.md` Phase 4/5/8). `npm i` at the time resolved the newest published
version of each — `@tanstack/react-table@9.1.2` and `recharts@3.8.0` — without anyone
checking whether that newest version was actually compatible with what was being built on
top of it.

**Rationale:** Both turned out to be ground-up rewrites, not incremental releases.
`@tanstack/react-table` v9 replaced the standard `useReactTable`/`getCoreRowModel()` API
(what shadcn's own `data-table` example and every public tutorial use) with an
unfamiliar, sparsely-documented `createTableHook`/`useTable` API — `components/data-table/
data-table.tsx` failed to typecheck against it outright. `recharts` v3 changed its
rendered DOM structure (a `recharts-zIndex-layer_*` architecture replacing the classic
`recharts-bar`/`recharts-cartesian-grid` class names) and dropped/renamed exported types
(`TooltipValueType` no longer exists) — `components/ui/chart.tsx`, generated from the
shadcn registry, targets the v2 API every public example uses and silently rendered zero
visible chart content on v3 (a real live-testing catch: `TierDistributionChart` showed an
empty box with real non-zero data behind it, confirmed via the "View as table" toggle).
Downgrading to the last stable major of each restored the exact API these components were
written against, with no further code changes needed beyond one type-import fix in
`chart.tsx` (`TooltipValueType` → `recharts/types/component/DefaultTooltipContent`'s
`ValueType`, aliased back to the same name).

**Alternatives rejected:**

- _Rewrite the shared `DataTable`/chart components against the v9/v3 APIs_ — rejected;
  both are new enough that reliable guidance doesn't exist yet, and burning build time
  reverse-engineering an undocumented API is a worse trade than pinning to the version
  the ecosystem's tooling and documentation actually targets today.
- _Leave the newer versions in and route around the breakage_ — rejected for recharts in
  particular: the breakage was silent (no error, no crash — the chart just rendered
  nothing), which is exactly the kind of bug that ships unnoticed if not caught by actually
  looking at the running app rather than trusting a green typecheck.

**Consequences:** `package.json` now pins these two packages below their latest published
major. A future `npm update`/`npm install` that bumps either forward again without
re-checking it against `components/data-table/data-table.tsx` and `components/ui/chart.tsx`
will very likely reintroduce the same class of breakage — re-verify against a running page
with real data before accepting either package past `9.x`/`3.x` again, not just a green
`npm run typecheck`.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), found via live browser testing during
the UI revamp build (Phases 4 and 8).

**Supersedes / Superseded by:** Corrects the dependency versions approved in principle by
`DECISIONS.md` 025 (the package names, not their exact versions, were what was approved).

---

## [2026-08-17] 025 — UI Revamp: bold-SaaS override of DESIGN-SYSTEM.md §2's Swiss-minimal

style; three new UI-only dependencies; gradients scoped out of risk-semantic surfaces; no
git baseline before starting

**Decision:** Override `DESIGN-SYSTEM.md` §2's "Minimalism & Swiss Style" direction
(flat surfaces, 1px borders, no shadows, no gradients, no decorative motion) with a bolder
modern-SaaS treatment for the internal console: gradient accent bands on page headers and
the dashboard hero, `shadow-md` elevation on KPI/stat cards, a larger display type scale,
and count-up/entry animation on stat values. §2's own reasoning stands — its anti-patterns
table explicitly flags gradients and glass as "Do Not Use For: data-heavy dashboards" — but
the project owner asked for "catchy," so the risk is taken knowingly rather than silently.
Approved three new dependencies (`recharts`, `@tanstack/react-table`, `motion`) under
`CONSTRAINTS.md` #1. Also proceeding **with no git baseline** — asked explicitly this
session (see `ROLLBACK.md`), the project owner declined to `git init` + commit first, so
this revamp has no revert path beyond manual re-diffing.

**Context:** MV-VRA's backend is feature-complete through Phase 11 (190 tests passing,
`HANDOVER.md` 2026-08-17), but the UI never got a design pass — every panel is a
hand-written `rounded-lg border p-4` div, no `card.tsx` primitive exists, nine installed
shadcn primitives are dead code, the dashboard is still the 20-line Phase 2 placeholder,
and the executive roll-up has zero charts despite `DESIGN-SYSTEM.md` §5 specifying five of
them. Full findings and phase plan in `docs/UI-REVAMP-PLAN.md`.

**Rationale:** The Swiss-minimal direction was chosen when this was a spec, not a shipped
product being evaluated for "does this look like something a CISO would buy." Bold styling
without touching risk semantics is achievable: severity badges, tier colors, and status
indicators are excluded from the gradient/shadow treatment entirely (`UI-REVAMP-PLAN.md`
"Design direction" — "a gradient behind a severity badge would compromise the one thing
the palette must communicate unambiguously"). `recharts` is needed because §5's chart
inventory (line/bar/stacked-bar/radar) cannot be hand-rolled in SVG at reasonable cost;
`@tanstack/react-table` because §4 requires sticky-header/sort/filter/saved-views on every
table and the current hand-rolled `<table>` in `risk-register-client.tsx` already has a
React `key` bug from doing this by hand; `motion` because CSS transitions alone can't do
the count-up/stagger effects the bold direction calls for while still gating everything on
`transform`/`opacity` only and respecting `prefers-reduced-motion`.

**Alternatives rejected:**

- _Keep Swiss-minimal, just build out what's missing_ — rejected; explicitly asked and the
  project owner chose "Bolder modern SaaS" over "Refined Swiss+" when offered both.
- _Hand-rolled SVG charts, no `recharts`_ — rejected; the "no new deps" option was offered
  and not chosen — `@tanstack/react-table` and `recharts` were both explicitly approved.
- _Init a git baseline before starting_ — offered explicitly this session, declined.

**Consequences:** `DESIGN-SYSTEM.md` §2 needs a superseding amendment (this entry is that
record; the file itself gets a status note pointing here). Gradients/shadows must stay
disciplined to headers/hero/stat-cards only — any future PR that gradients a severity
badge, a table row, or a form field is violating this decision, not extending it. No revert
path exists for this change beyond `git diff`-style manual comparison, since there is no
commit to reset to; each phase in `UI-REVAMP-PLAN.md` must land `npm run verify` green
before the next starts, since there is no "restore prior state" fallback if something
breaks mid-phase.

**Decided by:** Claude Opus 5 (`claude-opus-5`), at the project owner's direction (visual
direction, dependencies, and scope all confirmed via `AskUserQuestion` this session; git
baseline explicitly declined).

---

## [2026-08-17] 024 — Phase 11 RBAC: capability matrix over per-route role checks; membership resolved fresh from the DB every request, never cached in the session cookie; sharing is a manual per-document grant keyed by vendor domain

**Decision:** Six things settled together for Phase 11 (multi-workspace RBAC, sharing,
executive roll-up):

1. **`lib/auth/login.ts`'s `SUPER_ADMIN_EMAIL` gate (`DECISIONS.md` 013) is removed.**
   `login()` now authenticates any active `User` whose password matches — the single-email
   check was explicitly flagged in 013 as "the one thing to remove" once real multi-user
   auth was needed, and this is that moment.
2. **Authorization is a capability matrix (`lib/auth/rbac.ts`), not per-route ad-hoc role
   checks.** Four roles (`admin`, `risk_analyst`, `business_owner`, `viewer`) each map to a
   fixed `Set<Capability>` (e.g. `vendor.write`, `template.manage`, `sharing.manage`,
   `rollup.view`). Every route calls `requireCurrentMembershipWithCapability(capability)`
   rather than checking `role === 'admin'` inline — the mapping lives in one file, not
   scattered across 22 routes.
3. **A session's role is resolved from the database on every request
   (`lib/auth/current-membership.ts`), never cached in the signed session cookie.** The
   cookie carries only `{userId, workspaceId}` (unchanged from Phase 2/6's shape) — no
   `role` field was added to it. This means a role change (or membership removal) takes
   effect on the very next request from an already-logged-in browser, with no re-login
   required — verified by real HTTP request (promote mid-session, same cookie immediately
   gains the capability; demote, same cookie immediately loses it again).
4. **Switching the active workspace (`switchWorkspace()`) re-derives membership from the
   database, never trusts the caller's claim** — the same "re-derive scope, don't trust a
   parameter" rule `CONSTRAINTS.md` #8 already applies to tenant-scoped queries, extended
   here to the session's own `workspaceId` field.
5. **Cross-workspace document sharing (`lib/services/sharing.ts`) is a manual, explicit
   grant** on the previously-unused `SharedDocument` model (existed since Phase 1), scoped
   to vendor-uploaded documents (Phase 4's `Vendor.documents[]`) and keyed by
   `vendor_domain` rather than a specific vendor id in the _target_ workspace — the point is
   that Workspace B, which independently onboarded the same vendor by domain, can read
   Workspace A's already-collected documents for it without re-collecting them. Every read
   through a share is unconditionally audit-logged (`sharing.document_read`), matching the
   schema's own comment that this is the one sanctioned cross-tenant read path
   (`DATA-MODEL.md` §2, `CONSTRAINTS.md` #8).
6. **The executive roll-up (`lib/services/executive-rollup.ts`) authorizes per membership
   inside its own loop, not once at the top with a single `TenantContext`.** It takes a
   bare `userId`, walks every membership that `User` holds, and includes a workspace in the
   result only if that _specific membership's role_ has `rollup.view` — an `admin`
   membership in workspace A and a `viewer` membership in workspace B (both legitimately
   possible for the same account) must produce a roll-up that includes A and silently
   skips B.

**Context:** `PLAN.md` Phase 11 names multi-workspace RBAC, cross-workspace sharing, and an
executive roll-up as the last phase, explicitly because every collection has carried
`workspace_id` since Phase 1 — this phase adds authorization and UI, not isolation.
`FLOW.md` F6 (written at Phase 0 as a sketch) already named the per-workspace-authorization
requirement in prose, before any code existed to satisfy it. `DECISIONS.md` 013 already
flagged removing the `SUPER_ADMIN_EMAIL` gate as the explicit, singular step for this.

**Rationale:** A capability matrix in one file is reviewable and testable in one place
(`lib/auth/__tests__/rbac.test.ts`) instead of 22 independent "is this role allowed"
judgment calls scattered across route handlers, any one of which could silently drift.
Resolving membership fresh from the database rather than caching it in the cookie costs one
extra indexed `User.findOne()` per request but closes a real gap: a cached role in a signed
cookie would mean a demoted or removed user keeps their old permissions until the cookie
expires (up to 8 hours, Phase 2's TTL) or they happen to log out — unacceptable for a
security-relevant field, unlike `workspaceId`/`userId` which don't change meaning over a
session's life. `SharedDocument` being a manual per-document grant (not "share the whole
vendor" or "share by workspace pair blanket rule") keeps the blast radius of a sharing
mistake to exactly the documents someone explicitly chose, and auditing every read
unconditionally (not just the grant) means "who actually looked at this" is answerable, not
just "who could have." The roll-up's per-membership loop is the literal implementation of
`FLOW.md` F6's own stated gap — a single yes/no gate at the top would have been simpler to
write and wrong the first time a real user held two different roles in two workspaces.

**Alternatives rejected:**

- _Add a `role` claim to the signed session cookie, refreshed only at login/switch-workspace
  time_ — cheaper (no DB read on every request), but reintroduces exactly the staleness gap
  a role-based system exists to avoid: an admin revoking someone's access expects it to take
  effect immediately, not "next time they happen to re-authenticate."
- _Per-route inline role checks (`if (membership.role !== 'admin') throw ...`)_ — no new
  abstraction needed, but Phase 9/10's own `CLAUDE.md`-documented pattern of small, greppable
  shared helpers (`assertAssessmentNotArchived()`) argues for the same discipline here — one
  place to update the matrix, not 22.
- _`SharedDocument` keyed by a specific target-workspace vendor id instead of `vendor_domain`_
  — would require the target workspace to already know which of _its own_ vendor records
  corresponds to the shared one; keying by domain lets the reader resolve that itself
  (`readSharedDocument()`'s owner-scoped `VendorRepository` lookup), matching how a domain is
  already the natural identity DNS-adjacent systems use for "which company is this."
- _Executive roll-up as a single `TenantContext`-scoped function, called once per workspace
  by the caller_ — technically equivalent output, but pushes the "loop over every membership
  and check `rollup.view` per one" responsibility onto every future caller instead of making
  it structurally impossible to get wrong inside the one function that owns it.

**Consequences:** `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD_HASH` remain a valid bootstrap
admin credential — they simply stop being the _only_ account that can authenticate. Every
new internal-facing route from this phase forward must pick a `Capability` from
`lib/auth/rbac.ts` and call `requireCurrentMembershipWithCapability()`, or it is
unauthenticated-but-not-authorized (401 only, never 403) — a route that forgets this check
entirely is a real gap this pattern doesn't structurally prevent, unlike the
repository-level archive-immutability filters from `DECISIONS.md` 023. `getCurrentMembership()`
adds one database read to every authorization check in the app — acceptable at MVP scale
(`PLAN.md` A1), worth revisiting (e.g. a short-TTL in-memory cache) only if profiling ever
shows it matters. The admin-added-user flow sets a password directly (no invite-email flow)
— a real product would want email invites, deliberately out of scope for this MVP pass.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), at the user's direction ("Move on to
Phase 11... Proceed through all 4 steps and do the development with subagents").

**Supersedes:** 013 (removes the gate 013 introduced, per 013's own stated exit condition).

---

## [2026-08-17] 023 — Phase 10 offboarding: archive-immutability is a repository-level status filter, and archiving a record now needs an explicit new guard on risk/CAP writes

**Decision:** `completeOffboarding()` (`lib/services/offboarding.ts`) is the sole writer of
`Assessment.status = 'archived'` and `Offboarding.status = 'archived'`. Every write method
on `OffboardingRepository` and the new `AssessmentRepository.archive()` scopes its own
filter to exclude `status: 'archived'` (or an explicit allow-list of _from_ statuses), the
same structural-immutability mechanism `TemplateRepository.updateDraft()`/`publish()` use
for published templates. Because archiving an assessment is new as of this phase,
`AssessmentReviewService.raiseRisk()`/`updateRisk()`/`createCapTask()`/`updateCapTask()`
also gained an explicit `assertAssessmentNotArchived()` check — nothing needed this before
Phase 10, since nothing could archive an assessment yet.

**Context:** `CONSTRAINTS.md` #12 requires offboarding archives, audit trails, and
remediation logs to be append-only — "no edits, no deletes." `PLAN.md` Phase 10's exit
criterion is explicit: "no code path exists that can mutate it." Before this phase, no
document in the system ever became `archived` through any code path (`Assessment.status`
enum already listed `archived` since Phase 1, but nothing wrote it), so the risk/CAP-task
write paths built in Phases 8–9 had no reason to check for it and didn't.

**Rationale:** A service-layer `if (status === 'archived') throw` check alone is easy to
forget in a future service method; a repository-level filter that structurally excludes
`archived` from every update's match set fails safe even if a future caller forgets the
check — the write silently matches zero documents rather than corrupting an archive. Risks
and CAP tasks are "remediation logs" in `CONSTRAINTS.md` #12's language, embedded on the
`risks` collection rather than the `assessments` collection they belong to, so they needed
their own explicit guard rather than inheriting one from `AssessmentRepository`.

**Alternatives rejected:**

- _Soft-delete/flag on the Risk itself_ — rejected; the risk's parent assessment is already
  the unit of archival per `DATA-MODEL.md` and `FLOW.md` F5, and a second independent
  "archived" flag on `risks` would let the two disagree.
- _Only a service-layer check, no repository-level filter_ — rejected as the weaker
  half-measure; the whole point of `CONSTRAINTS.md` #12 is that this must not depend on
  every future caller remembering to check first.
- _Cascade the archive down into `cap_tasks` individually_ — rejected as unnecessary; a
  `cap_tasks` array only exists attached to a risk, which only exists attached to an
  assessment — archiving the assessment (and refusing further risk/CAP writes against it)
  already makes the whole subtree immutable without touching the CAP task schema.

**Consequences:** `raiseRisk`/`updateRisk`/`createCapTask`/`updateCapTask` now do one extra
`AssessmentRepository.findById()` read each (to check `status`) before writing — a cheap,
already-indexed lookup, not a performance concern at MVP scale (`PLAN.md` A1). Any future
service method that writes to `risks` or its embedded `cap_tasks` must add the same check;
`assertAssessmentNotArchived()` is a small shared helper in `assessment-review.ts` for
exactly that reason, not inlined per-method.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`).

---

## [2026-08-16] 022 — Phase 9 CAP tracking: vendor-owned CAPs always target the risk's own vendor; escalation is a stamped-field idempotency guard, not a job runner

**Decision:** Three shapes for CAP (corrective action plan) tracking:

1. `cap_tasks[].owner_ref` is ignored by the service for `owner_type: 'vendor'` — it is
   always set to the risk's own `vendor_id`, never a caller-supplied value. There is no
   product scenario where a CAP task on vendor A's risk should be owned by vendor B.
2. Overdue detection and escalation are **request-driven**, triggered by loading the
   overdue-CAP queue (`GET /api/risks/cap-tasks/overdue`), per `PLAN.md` §1's own stated
   default for this open question ("request-driven first; a job runner is a later, separate
   decision"). "Escalates once" is achieved with one additive field,
   `cap_tasks[].escalated_at: Date | null` — the first run that finds a past-due, not-yet-
   escalated task sends the email and stamps this field; every later run (including a page
   refresh) treats a non-null `escalated_at` as "already handled," so the email never
   re-sends however many times the query runs.
3. `createCapTask()` with `owner_type: 'internal'` requires an existing, `status: 'active'`
   `User._id` — resolved eagerly at creation time, not deferred to escalation time, so a
   CAP task can never silently point at a nonexistent or disabled internal owner.

**Context:** `PLAN.md` Phase 9 items 1–2 ("CAP tasks with owner... due date, status,"
"overdue detection and escalation — request-driven for MVP") and the still-open question in
`PLAN.md` §1 ("Background job runner, or request-driven escalation? — blocks Phase 9;
default: request-driven"). `cap_tasks` already existed as an embedded array on `Risk`
(`DECISIONS.md` 006) with no `escalated_at` field — Phase 8 shipped it always `[]`.

**Rationale:** (1) simplifies the CAP-creation UI to a two-way owner choice with no vendor
picker, and removes an entire class of "assigned the wrong vendor" bug at the type level —
the service, not the caller, decides the vendor. (2) A background job runner (cron,
queue worker) is real infrastructure this MVP doesn't have anywhere else — every other
async-looking process in the codebase (OTP TTL sweep, evidence-orphan sweep) is either a
DB-native mechanism or an explicit manually-run script, never a scheduler. Stamping
`escalated_at` on the document itself makes the "did this already send" question a property
of the data, not of some separate job-run ledger — consistent with how `residual_score`
being authoritative (`DECISIONS.md` 008) keeps a single source of truth on the document
that needs it. (3) Failing at creation time (not escalation time) means a broken owner
reference is a visible 422 to the person creating the CAP, not a silent no-op discovered
only when nobody ever gets escalated to.

**Alternatives rejected:**

- _Let `owner_ref` for `owner_type: 'vendor'` be caller-supplied_ — rejected; there is no
  legitimate cross-vendor CAP ownership case, and accepting the field just to ignore
  silently would be confusing. The route/service now takes it as an input (for
  API-symmetry with the `internal` case) but always overrides it.
- _A `node-cron`/`node-schedule` in-process scheduler for escalation_ — rejected; it's a new
  dependency (`CONSTRAINTS.md` #1) for a problem the request-driven approach already
  solves within this MVP's stated assumptions (A3: business-hours-best-effort, no HA), and
  it would be the first background process in a codebase that otherwise has none.
- _A separate `escalation_log` collection instead of a field on the task_ — rejected as
  more moving parts for the same guarantee; `cap_tasks` is already embedded and always read
  with its risk (`DECISIONS.md` 006's reasoning applies identically here).
- _Deferring the internal-owner existence check to escalation time_ — rejected; that would
  let a CAP task with a dangling owner reference sit silently until someone finally looks
  at the overdue queue, which could be long after the due date matters.

**Consequences:** The overdue queue endpoint does double duty (read + write) on every
`GET` — acceptable because it's scoped to one workspace's past-due tasks
(`RiskRepository.findRisksWithPastDueCapTasks()`'s `$elemMatch` filter), not a full table
scan, but a future high-volume workspace should watch this. If a real job runner is ever
introduced (still an open question per `PLAN.md` §1), it can call
`detectAndEscalateOverdueCaps()` directly — the method itself has no assumption baked in
about how it's triggered, only that repeated calls must stay idempotent for the send.
`MAIL_PROVIDER=console` is unchanged; nothing added by this phase reaches a real inbox.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), at the user's direction ("let's build
phase 9").

---

## [2026-08-16] 021 — Phase 8 verified and typecheck-fixed; two bug classes found and fixed, not redesigned

**Decision:** Phase 8's code (reviewer view, risk raise/update, residual scoring, register
page) was found already written but uncommitted, unverified, and failing `npm run
typecheck` when this session started. Fixed two mechanical bugs rather than redesigning
anything, then ran the full gate suite and a real-HTTP verification pass before marking the
phase done.

**Context:** `ROLLBACK.md`'s Active plan block (dated 2026-08-14, attributed to Gemini 3.6
Flash) described Phase 8 as "active" with a file list, but `HANDOVER.md` still said "not
started" and no feature trace existed. `npm run typecheck` failed with 8 errors across 6
files.

**Rationale:**

1. **`throw new UnauthorizedError()` (5 call sites, one per new route)** — the class's
   constructor requires a `message: string` argument (`lib/errors/index.ts`); every other
   route in the codebase already passes one (e.g. `'Not authenticated'`). The new routes
   omitted it, which `tsc` catches but a working dev server wouldn't necessarily surface
   immediately (the routes still 401 correctly at runtime — Next.js/TypeScript's structural
   typing let the call through in some code paths — but `--noEmit` fails it, so `npm run
verify`/CI would fail). Fixed by adding a message to each.
2. **`workspace_id: this.ctx.workspaceId` in three `recordAuditEvent()` calls
   (`lib/services/assessment-review.ts`)** — `TenantContext.workspaceId` is typed
   `string | Types.ObjectId` (it's built directly from the session, before any DB round
   trip), but `AuditEventInput.workspace_id` requires a real `Types.ObjectId`. Every other
   service in the codebase (`vendor-documents.ts`, `vendor-spoc.ts`,
   `questionnaire-templates.ts`, `portal-assessment.ts`, `portal-auth.ts`) sidesteps this by
   passing a **document's own** `workspace_id` field (already a real `ObjectId`, read back
   from the DB) instead of the raw context value. `AssessmentReviewService` had no
   document-level `workspace_id` handy at every call site, so it uses the already-imported
   `toObjectId()` helper (`lib/tenant/context.ts`) to coerce the context value instead —
   functionally identical to the other services' pattern, just without a spare document
   field to read it from.

**Alternatives rejected:**

- _Relaxing `AuditEventInput.workspace_id`'s type to accept a string_ — would weaken the
  one place `record-event.ts`'s append-only writer is supposed to be strict about what it
  accepts; the existing services all pass a real `ObjectId` on purpose.
- _Rewriting `AssessmentReviewService` to route every call through a document's
  `workspace_id`_ — more invasive than the bug warranted; `toObjectId()` already exists for
  exactly this coercion and is used at Phase 3's tenant boundary already.

**Consequences:** `npm run verify` (format/lint/typecheck/test/build) now passes clean.
Verified the Phase 8 exit criterion by real HTTP request (see
`docs/features/phase-8-review-risk-register-residual-scoring.md` §9) rather than trusting
the prior session's uncommitted claim of completeness. No unit/integration test coverage
was added for `calculateResidualScore()` or `AssessmentReviewService` — carried forward as
an open item, `TEST-CHECKLIST.md` Gate 2 still shows Residual Risk Calculation unchecked.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), 2026-08-16.

---

## [2026-08-14] 020 — Phase 7 questionnaire answering: file-type answer semantics, edit-lock boundary, evidence namespacing, sweep script scope, is_suppressed left unwritten

**Decision:** Six things settled for Phase 7 (questionnaire answering, evidence upload,
validation):

1. **A `type: 'file'` question's `response_value` is set to the uploaded filename** once
   evidence is attached, so the generic `required` check (`isAnswered(response_value)`)
   treats it as answered without a type-specific branch in the validator. Neither
   `DATA-MODEL.md` §3 nor §2 specifies what a file-type question's answer value should be.
2. **Writes (answer or evidence upload) are refused once an assessment leaves `sent`/
   `in_progress`**, enforced in the service layer (`getEditableVendorAssessment()`), not
   only by disabling inputs in the UI. Nothing in `PLAN.md` states this explicitly, but
   allowing a write to a submitted assessment would let a SPOC silently alter an assessment
   after review has started.
3. **Evidence storage keys are namespaced `<workspace_id>/assessments/<assessment_id>/
<control_id>/<uuid>-<filename>`** — parallel to Phase 4's `<workspace_id>/<vendor_id>/
<uuid>-<filename>` for vendor documents, not unified into one shape, since the two
   feature areas have different natural parent ids.
4. **The evidence-upload ordering follows `DATA-MODEL.md` §5 literally**: a response
   "shell" is upserted first (empty `response_value`, so evidence for an unanswered control
   doesn't fabricate an answer), the file is written to storage second, and the evidence
   metadata is `$push`ed onto the response last — three steps, not the two Phase 4's
   vendor-document upload uses (which has no separate "record first" step because a vendor
   always already exists by the time someone uploads a document to it).
5. **`scripts/sweep-orphaned-evidence.ts` cross-references both `Response.evidence` and
   `Vendor.documents`**, not just `Response`, because both currently share the same storage
   backend — otherwise every vendor document would misreport as an "orphan." Dry-run by
   default; deletion requires an explicit `--delete` flag.
6. **`Response.is_suppressed` (the field DATA-MODEL.md §2 calls "load-bearing... lets the
   validator distinguish 'hidden' from 'skipped'") is never written by this phase — it
   stays `false` on every document, always.** `submitAssessment()` instead recomputes
   visibility fresh from the current answers via `computeVisibility()` at submission time
   and never reads or writes the stored flag at all. This is a deliberate deviation from
   the letter of `DATA-MODEL.md`, called out explicitly rather than left to be discovered
   as an inconsistency later.

**Context:** `PLAN.md` Phase 7 item 4 says evidence upload is "bound to a specific
control," item 6 says "write the response record first, then the file" and "a
reconciliation pass sweeps files with no owning record" — the literal 3-step ordering and
the sweep script's scope (one storage backend, two independent referencing collections)
are both left for implementation to work out. `DATA-MODEL.md` §2 specifies `is_suppressed`
as the mechanism for the suppressed-vs-skipped distinction, without saying whether it must
be the _only_ mechanism.

**Rationale:** Treating a file upload as satisfying `required` via `response_value` keeps
`submitAssessment()`'s validation loop uniform — one `isAnswered()` check for every
question type, no `if (question.type === 'file')` special case that could drift from the
evaluator's own definition of "answered." The edit-lock boundary exists because Phase 8
(review) will read submitted responses as the record of what the vendor actually said;
letting the vendor keep editing after submission would undermine that record's integrity,
even though nothing enforces it from the review side yet. The sweep script checking both
collections was discovered as necessary while testing, not planned upfront — a first dry
run against real data would have reported every vendor document as an orphan otherwise.
Recomputing visibility at submission time rather than stamping `is_suppressed` avoids a
staleness bug the stored-flag approach is exposed to: if a SPOC answers a question,
changes their mind, and re-answers it differently before submitting, a flag written at
autosave time could reflect an answer that's no longer current unless every autosave also
recomputes and rewrites every other response's suppression state — recomputing once, at
the one moment it's actually needed (submission), is simpler and cannot go stale.

**Alternatives rejected:**

- _A `type === 'file'` special case in the validator_ — equally correct, but a second place
  that has to agree with the evaluator's "what counts as answered" rule instead of one.
- _Allow edits after submission, let the reviewer just see the latest state_ — simpler, but
  removes the one guarantee "submitted" is supposed to carry.
- _Give evidence and vendor documents visually distinct key prefixes precisely so the sweep
  script could ignore vendor documents entirely_ — rejected because it would mean designing
  the key format around an ops script's convenience rather than around what's natural for
  each feature; cross-referencing both collections in the script is one `Vendor.find()` and
  costs nothing.
- _Write `is_suppressed` on every autosave, matching `DATA-MODEL.md` §2 literally_ —
  rejected for the staleness reason above; would also require every autosave to
  recompute visibility for the _whole_ schema, not just the one control being saved, since
  answering one question can change another's suppression state.

**Consequences:** Phase 8's reviewer surface can trust that a `submitted` assessment's
responses are exactly what the vendor answered — no code path can mutate them afterward.
Any future storage consumer (a third feature that writes into the same backend) must also
be added to the sweep script's referenced-keys set, or it will start reporting false
orphans. **`Response.is_suppressed` must not be trusted by any future reader** (Phase 8's
reviewer view, an executive roll-up, an export) — it is always `false` in the database
regardless of whether the question was actually suppressed; anything that needs to know
must call `computeVisibility()` itself, the same way `submitAssessment()` does. If a
future phase needs the flag queryable without recomputing (e.g., an indexed query
filtering by suppression state), that's a new decision, not a silent reversal of this one.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), at the project owner's direction (all
five points are stated implementation choices per `CONSTRAINTS.md` #16, not decisions
requiring sign-off).

---

## [2026-08-14] 019 — Phase 6 OTP portal auth: constants, timing mitigation, in-memory rate limiting, assessment status on assignment

**Decision:** Five things settled for Phase 6 (assessment assignment and OTP portal auth):

1. **OTP constants, none from the spec:** 6-digit numeric code, 10-minute TTL, 5 verify
   attempts, rate limits of 5 requests per email and 20 per IP per 15-minute window.
2. **The enumeration-timing mitigation for a non-matching email is a dummy database read
   (`dummyOtpLookupForTiming()`), not a cryptographically-guaranteed constant-time path.**
   `PLAN.md` Phase 6 asks for "comparable timing," not a formal proof; a real Vendor lookup
   plus a same-shape dummy read is a reasonable best effort, not a stronger claim.
3. **Rate limiting is in-memory and per-process** (`lib/auth/rate-limit.ts`), not backed by
   a database or Redis. No new dependency was requested for this, and `PLAN.md` A3 already
   accepts no-HA/single-instance for the MVP — this resets on restart and doesn't share
   state across instances, both acceptable now and worth revisiting before any
   multi-instance deployment (Phase 12).
4. **Assigning a template to an engagement immediately sets the assessment to `status:
'sent'`** (not `'draft'` first, requiring a separate "send" action) — `PLAN.md`'s own
   text lists "`status: draft/sent`" without specifying which, or whether both are reachable
   from the assignment action itself. Treated as one action for the MVP; a `draft` staging
   step can be added later without a data migration since it's just a different initial
   status value.
5. **The portal session is a structurally separate module from the internal session**
   (`lib/auth/portal-session.ts`), not the same signer parameterized by a payload type —
   different payload shape, different cookie name, different signing secret
   (`OTP_HMAC_SECRET`, not `SESSION_SECRET`). Three independent reasons a portal token can
   never satisfy an internal check, not one.

**Context:** `PLAN.md` Phase 6 is explicit that this is "the highest-risk surface in the
system: externally reachable, and it guards another company's data," with an exit
criterion naming enumeration, expiry, attempt limit, replay, cross-vendor ID tampering, and
scope source by name. None of the specific numbers (code length, TTL, attempt cap, rate
limits) are specified anywhere in the docs.

**Rationale:** The constants are deliberately conservative-but-not-punishing: a real SPOC
retrying a mistyped code a few times, or requesting a fresh code once or twice, should
never get blocked; a scripted enumeration or brute-force attempt should hit a wall quickly.
Reusing `lib/auth/session.ts`'s payload shape for the portal (e.g. a generic `{id,
workspaceId}` signer parameterized by a role field) was considered and rejected — `FLOW.md`
F2 gap (b) exists specifically because a portal session must never be mistakable for an
internal one, and the strongest version of that guarantee is two independently-written
signers that share no code, not one signer that happens to be configured differently in
two places.

**Alternatives rejected:**

- _A generic session signer shared between internal and portal_ — less code, but weakens
  the "structurally impossible to cross-check" property this phase's whole purpose is to
  establish, for the sake of avoiding ~40 lines of duplicated Web Crypto boilerplate.
- _A real constant-time defense (e.g., always sleeping until a fixed elapsed time)_ — more
  rigorous, but adds latency to every legitimate request too, and the actual attack surface
  (attempting to enumerate registered vendor emails through timing on a local dev/small
  MVP deployment) doesn't currently justify the complexity. Revisit if this ever needs a
  real security audit before a production launch.
- _Assessment starts as `draft`, a separate action moves it to `sent`_ — matches
  `PLAN.md`'s literal enum more cautiously, but adds a whole workflow step (and its own UI)
  for a distinction nothing in the spec currently uses.

**Consequences:** Anyone hardening this for a real multi-instance production deployment
must replace the in-memory rate limiter with a shared store first — it silently stops being
effective the moment there's more than one server process. The timing mitigation should be
called out explicitly to any future security reviewer as "best effort," not "constant
time," so it isn't mistaken for a stronger guarantee than it is.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`), at the project owner's direction (all
five points are stated assumptions per `CONSTRAINTS.md` #16, not decisions requiring
sign-off — flagged here for correction rather than asked about, consistent with how prior
phases handled unspecified constants).

---

## [2026-08-14] 018 — Phase 5 template builder: form UI, forward-refs validated on every save, exactly one of all/any, archived is immutable too

**Decision:** Five things settled for Phase 5 (template builder and versioning):

1. **Builder UI is a form-based visual builder**, not a raw JSON editor — the project owner's
   explicit choice over a JSON-textarea MVP. Click-to-add sections/questions/conditions,
   dropdowns for type/operator, plain text inputs for values and comma-separated
   options/accept-lists.
2. **`validateQuestionsSchemaStructure` (control_id uniqueness, no forward references, no
   references to a nonexistent control_id) runs on every draft save, not only at publish.**
   DATA-MODEL.md §3 only requires forward references be "rejected at publish time" — this
   is stricter than the letter of that spec.
3. **`show_if` must have exactly one of `all` or `any`**, never both. DATA-MODEL.md §3's
   example only ever shows one key populated; the format doesn't explicitly forbid both,
   but "how do all and any combine when both are present" is undefined, so the Zod schema
   (`lib/questionnaire/schema.ts`) rejects that shape outright.
4. **Archived templates are immutable, same as published ones** — CONSTRAINTS.md #11 only
   names "published" by name, but there is no reason an archived (i.e. retired) version
   should become editable again. `TemplateRepository.updateDraft()`'s filter only ever
   matches `status: 'draft'`, so this falls out of the same mechanism.
5. **`in`/`not_in` against a multi_select answer (an array) match on any overlap with the
   condition's value list**, not exact-array equality. DATA-MODEL.md §3's only worked
   example (HOST-01/HOST-02) compares a single_select scalar answer to a value list; the
   multi_select case isn't specified. `lib/questionnaire/evaluator.ts` documents this
   extension where it's implemented.

**Context:** `PLAN.md` Phase 5 requires "Conditional-logic expression format — declarative,
evaluated by one shared module used by both the builder preview and the portal," and
"Publishing freezes the version; editing means creating a new version." The exact
structural-validation timing, the `show_if` wire shape when both `all`/`any` could be
present, archived-mutability, and multi_select condition semantics are all left open by
`DATA-MODEL.md` §3's prose.

**Rationale:** A form builder was chosen by the project owner over a JSON editor despite
the extra UI work, because the schema format's operators/conditions are exactly the part a
non-technical template author would get wrong by hand. Validating on every save (not only
publish) catches an invalid schema at the moment it's introduced rather than letting a
draft sit invalid until someone tries to publish it — `lib/questionnaire/evaluator.ts`'s
single-pass `computeVisibility()` is what makes the no-forward-references rule load-bearing
(every `show_if` target's visibility must already be computed), so there's no reason to
allow the invalid state even transiently in a draft. Restricting `show_if` to exactly one
of `all`/`any` avoids inventing undefined combination semantics that a future portal
implementer (Phase 7) would have to guess at from a frozen snapshot. Treating archived as
immutable follows the same spirit as CONSTRAINTS.md #11 even though the constraint's text
only names "published" — an archived version is, if anything, less appropriate to mutate.

**Alternatives rejected:**

- _JSON schema editor + live preview_ — faster to ship, and DATA-MODEL.md §3's format is
  fully specified so there was no ambiguity a form UI needed to resolve — but rejected by
  the project owner in favor of the friendlier form builder.
- _Allow forward references in drafts, reject only at publish_ — matches the letter of
  DATA-MODEL.md §3 exactly, but would let a draft's preview silently misbehave (an
  unresolved reference) until the author happened to try publishing.
- _Allow both `all` and `any` in one `show_if` (AND them together)_ — plausible, but invents
  behavior the spec never states, and the builder UI already models "match ALL/ANY of
  these conditions" as one mutually-exclusive choice per question, so there was no
  authoring path that would ever produce both anyway.

**Consequences:** A template built entirely through this UI can never actually construct
an ambiguous `show_if`, an unresolvable reference, or a mutation of a non-draft version —
those are structurally excluded, not just avoided by convention. Phase 6/7 (assessment
assignment, portal rendering) must snapshot the frozen `questions_schema` verbatim into
`template_snapshot` and can trust it already satisfies every structural rule — no need to
re-validate a snapshot at render time. If a future need arises for `all`+`any` combined
logic, that's a new decision superseding this one, not a silent schema change.

**Decided by:** Project owner (form-builder-vs-JSON-editor choice, via `AskUserQuestion`),
implemented by Claude Sonnet 5 (`claude-sonnet-5`).

---

## [2026-08-14] 017 — Phase 4 storage module: S3 SDK dependency, document metadata shape, and upload limits

**Decision:** Three things settled together for Phase 4 (vendor SPOC management + storage
abstraction):

1. `@aws-sdk/client-s3` (`^3.1110.0`) added as a new dependency for the S3 storage driver,
   approved by the project owner even though S3 stays unconfigured this phase.
2. Uploaded-file metadata is an embedded `documents` array subdocument on `Vendor`
   (`key`, `filename`, `mime`, `size`, `uploaded_by`, `uploaded_at`), not a new top-level
   collection. This is an addition to `DATA-MODEL.md` §2, not specified there originally.
3. Upload constraints: MIME allow-list (PDF, Word, Excel, PNG, JPEG) and a 10MB size cap,
   enforced in `lib/services/vendor-documents.ts` before storage or the database are
   touched.

**Context:** `PLAN.md` Phase 4 requires a working storage abstraction (`CONSTRAINTS.md`
#10) with an authorised proxy read path and server-side upload constraints, but the spec
has no dedicated "documents" collection — the only evidence-file mention
(`evidence_file_url` on a Question/Control Response) belongs to Phase 7. Phase 4 needed
something concrete to upload/retrieve/authorize against to meet its own exit criteria
ahead of that.

**Rationale:** An embedded array keeps the tenant boundary trivial — `vendor.workspace_id`
already scopes it, so `VendorRepository.findById()` (which every read already routes
through) is the entire authorization check; a `documents` collection would need its own
model, repository, and workspace_id-plus-vendor_id compound index for the same result.
The MIME/size limits are `PLAN.md` assumption A5 ("evidence files are documents,
single-digit MB") applied concretely, not a spec requirement — flagged here so it's easy
to correct if the risk team wants something different. `@aws-sdk/client-s3` was chosen
over the older v2 SDK because it's the maintained, tree-shakeable client and matches the
project's TypeScript-strict, modular-import style.

**Alternatives rejected:**

- _New top-level `documents`/`vendor_documents` collection_ — more consistent with every
  other entity in `DATA-MODEL.md`, but Phase 7's actual evidence-upload feature will very
  likely supersede this demo path anyway; not worth the extra model/repository/index for
  something Phase 7 may replace.
- _Stubbing the S3 driver without the real SDK_ — would defer the dependency decision to
  Phase 12, but the class would then need a second rewrite when Phase 12 actually wires it
  up, and PLAN.md's Phase 4 exit criterion explicitly asks for "unit-tested against a
  mock," which is more honest with the real client shape than a hand-rolled stub.

**Consequences:** `Vendor.documents` is a Phase-4-only convenience; Phase 7 (per-response
evidence upload) will need its own decision about whether to reuse this array, extend it,
or model responses' evidence separately — don't assume this shape survives unchanged.
`lib/storage/index.ts` throws at call time (not at `lib/env.ts` boot) if `STORAGE_DRIVER=s3`
is set without `AWS_S3_BUCKET`/`AWS_REGION`, so a misconfigured prod boot won't be caught
until the first upload — acceptable for now since `STORAGE_DRIVER` defaults to `local-fs`
and nothing sets it to `s3` before Phase 12.

**Decided by:** Project owner (S3 dependency approval, documents-array modeling choice via
`AskUserQuestion`), implemented by Claude Sonnet 5 (`claude-sonnet-5`).

---

## [2026-08-15] 016 — Audit-trail gap in Phases 1–2 noted, not retroactively fixed

**Decision:** `AuditEvent` (Phase 1 model) got its first-ever writer in Phase 3
(`lib/audit/record-event.ts`, called from `submitVendorIntake()`). Nothing in Phase 1
(model/repository/seed creation) or Phase 2 (login/logout) writes an audit event, even
though `PLAN.md` §3 states "every phase from 1 onward writes to `audit_events`; that is not
restated each time." This gap is recorded here, not fixed retroactively.

**Context:** Discovered while building Phase 3's audit write and grepping for prior usage —
there was none.

**Rationale:** Retrofitting audit events onto Phase 1/2 code paths (seed script, login,
logout) is a distinct, scoped task with its own review — CONSTRAINTS.md #13 ("one logical
change per request"). Silently folding it into Phase 3 would inflate this change beyond
"vendor intake and tiering" and make the diff harder to review.

**Alternatives rejected:**

- _Fix it now as part of Phase 3_ — rejected for the scope-creep reason above; login/logout
  audit events don't touch anything Phase 3 needs.

**Consequences:** Login, logout, and Phase 1 seed operations currently produce no audit
trail. Anyone reviewing `audit_events` for a full activity history should know it only
starts covering `engagement.intake_submitted` from this point forward. Raise
"backfill Phase 1/2 audit events" as its own task before this becomes a compliance gap
worth caring about (offboarding/archival phases will need a complete trail).

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`).

---

## [2026-08-15] 015 — Inherent-risk factor enums and weight-lookup shape (Phase 3)

**Decision:** `network_exposure` (`external`\|`internal`\|`none`), `system_access_level`
(`admin`\|`write`\|`read`\|`none`), and `business_redundancy`
(`single_source`\|`some_redundancy`\|`fully_redundant`) are fixed as TypeScript enums in
`lib/scoring/inherent-risk.ts`. `workspace.settings.risk_weights.<category>` is a
`Record<value, number>` map — each selected value must resolve to a configured number or
scoring fails (`DATA-MODEL.md` §4's fail-loud rule). `data_classification` reuses the
existing `pii`\|`phi`\|`financial`\|`none` enum from `DATA-MODEL.md` and is multi-select,
its contribution summed across every selected value.

**Context:** `VRA MVP Feature Specification.md` §2.1 and `DATA-MODEL.md` §4 name these four
scoring factors but do not enumerate option values for the latter three, or specify the
weight-lookup data shape. Phase 3 needed a concrete answer to build the intake form and the
scoring engine at all (`CONSTRAINTS.md` #16 — stating the assumption rather than blocking).

**Rationale:** A small, fixed enum per factor keeps the intake form a simple `<select>` and
keeps the scoring engine's fail-loud contract exact — a value can only either be in the
weights map or not, with no ambiguity about partial matches. The `Record<value, number>`
shape matches the model's existing `Schema.Types.Mixed` field exactly, so no schema
migration was needed.

**Alternatives rejected:**

- _Free-text or numeric-scale inputs instead of enums_ — rejected because it reopens the
  exact ambiguity the fail-loud rule exists to close; a numeric scale still needs weight
  brackets defined somewhere, which is the same problem restated.
- _A generic `Record<string, number>` weights shape keyed by an open string_ — technically
  equivalent, but typing each category against its own literal union catches a typo'd form
  value (e.g. `"External"` vs `"external"`) at compile time in the form and route schema,
  not only at runtime in the scoring engine.

**Consequences:** These strings are provisional, same as the enterprise-risk-taxonomy
placeholder in `PLAN.md`'s open-questions table. If the actual risk/admin team's scoring
matrix uses different factor levels, relabeling touches exactly three places:
`lib/scoring/inherent-risk.ts`'s type unions, `components/vendor-intake-form.tsx`'s option
lists, `app/api/vendors/route.ts`'s Zod enums, and `scripts/seed.ts`'s seeded weights — no
downstream code depends on the specific strings otherwise.

**Decided by:** Claude Sonnet 5 (`claude-sonnet-5`).

---

## [2026-08-14] 014 — Local mongod converted to a single-node replica set; git baseline gap re-deferred a third time

**Decision:** `/opt/homebrew/etc/mongod.conf` now sets `replication.replSetName: rs0`; the
service was restarted and `rs.initiate()` run once. `MONGODB_URI`'s default (`lib/env.ts`)
and `.env.example` now carry `?replicaSet=rs0`. Verified by running a real
`mongoose.startSession().withTransaction()` against the local database and confirming both
writes landed. The git-baseline gap (`DECISIONS.md` 010, restated in every Handover since)
was raised again this session and explicitly re-deferred — still no commit anywhere in the
repo.

**Context:** Superseded `DECISIONS.md` 011, which deferred this conversion until Phase 3
actually needed a multi-document transaction. Phase 3's "Vendor + Engagement written
atomically" step is that need. `HANDOVER.md` had flagged the conversion twice without it
being acted on.

**Rationale:** MongoDB transactions require a replica set (even a single-node one) — a
standalone `mongod` rejects `startTransaction()` outright. Converting in place (one config
line + `rs.initiate()`) keeps the existing data directory and requires no data migration,
since a single-node replica set is a strict superset of standalone behavior for all
non-transactional reads/writes already in use.

**Alternatives rejected:**

- _Defer again, have Phase 3 use a compensating-write / two-phase pattern instead of a real
  transaction_ — rejected because it trades a five-minute infra fix for permanent
  application-level complexity (a `scoring_failed`-style reconciliation path for a partial
  Vendor-without-Engagement write) that Phase 3's exit criteria doesn't otherwise require.
- _Full multi-node replica set_ — unnecessary for a solo local dev environment; a
  single-node set gives transaction support with no added operational surface.

**Consequences:** Any future clean-machine setup for this project must include the
`replSetName: rs0` config line and one `rs.initiate()` run — not just `brew install
mongodb-community` — or Phase 3 (and anything after it that assumes transactions) will fail
at the first atomic write. This should be captured in a setup doc before Phase 12
(hardening/release) if one doesn't already exist. The git-baseline gap remains open and
uncommitted; it was surfaced to the project owner and deliberately not acted on this
session — do not silently commit on its behalf later without being asked.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), at the user's direction (replica-set
fix approved; git baseline explicitly deferred).

**Supersedes:** 011.

---

## [2026-08-14] 013 — Login gated to `SUPER_ADMIN_EMAIL`, not any active User

**Decision:** `lib/auth/login.ts` checks the submitted email against `SUPER_ADMIN_EMAIL`
before ever querying the `User` collection. An active `User` document with a different email
— even a correct password against a real hash — cannot log in.

**Context:** The `User` model already supports multiple members with roles
(`DATA-MODEL.md` §2), built ahead of need in Phase 1. `ARCHITECTURE.md` §1.2 specifies only
a static super-admin credential for internal auth until Google SSO lands post-MVP.

**Rationale:** Building login against the `User` model (rather than a separate
credentials-in-env check with no database involvement) means Phase 2 generalizes cleanly to
real multi-user auth later — no rework needed, just relaxing this gate. But building on a
richer model ahead of the feature that needs it creates a real risk: if a later phase (or a
bug) creates additional `User` documents before proper multi-user auth and RBAC exist, they
would otherwise be able to log in immediately. The explicit `SUPER_ADMIN_EMAIL` check closes
that gap without giving up the generalization — verified in
`lib/auth/__tests__/login.test.ts` by a real second active `User` document, with the correct
password, that still cannot log in.

**Alternatives rejected:**

- _No gate — any active `User` with a correct password logs in_ — simpler, but silently
  turns "one static admin account" into "whoever gets a User document," which is a scope
  change from what the spec asked for and would happen invisibly.
- _Credentials entirely in env, no `User` document at all_ — matches "static credential"
  literally, but discards the model built in Phase 1 and would need a rewrite for real
  multi-user login later.

**Consequences:** Removing this gate is the explicit, singular step for enabling multi-user
internal login later — search for `SUPER_ADMIN_EMAIL` in `lib/auth/login.ts` when that
phase arrives, and replace the check with real RBAC-driven authorization.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`).

---

## [2026-08-14] 012 — Stateless HMAC session cookie; proxy fails closed with an explicit allowlist

**Decision:** Internal sessions are a stateless, HMAC-signed cookie (`lib/auth/session.ts`)
— no `sessions` collection, no per-request database read to check validity. `proxy.ts`
(Next.js 16 renamed `middleware.ts`) protects every request by default and only exempts
paths on an explicit `PUBLIC_PATHS`/`PUBLIC_API_PATHS` allowlist, rather than protecting an
enumerated list of internal routes.

**Context:** `DATA-MODEL.md` has no `sessions` collection — it wasn't planned for. Route
groups (`(internal)`/`(portal)`) don't add a URL segment in Next.js, so there was no
existing URL convention to key route protection off of.

**Rationale:** A stateless cookie means session validity is checked by verifying a
signature, not by a database round trip on every request — cheaper, and there is nothing to
clean up or garbage-collect. The cost is that a session can't be revoked server-side before
its 8-hour expiry (e.g., no "log out this device remotely"); acceptable for a single static
admin account, worth revisiting once multi-user auth makes revocation matter. On the
proxy default: fail-closed was chosen because the alternative — enumerating which routes
need protection — has exactly the failure mode `CONSTRAINTS.md` #8 already warns about for
tenant scoping: a new internal page added in a later phase and simply forgotten from the
protected list. Default-deny means a forgotten page is protected by construction, not by
someone remembering to add it.

**Alternatives rejected:**

- _A `sessions` collection with server-side revocation_ — strictly more capable, but adds a
  collection and a cleanup job for a capability (remote logout) not needed by a single
  static account.
- _Enumerate protected routes in `proxy.ts`_ — the default in many Next.js examples, but
  inverts the safety property this project has held everywhere else (fail closed, not
  fail open by omission).
- _URL-prefix internal pages under `/console` or similar to key protection off Next.js route
  groups_ — would make the matcher simpler, but forces a URL-naming decision now for a
  cosmetic convenience; the allowlist approach needs no such prefix.

**Consequences:** Revoking a compromised session server-side is not possible until a
`sessions` (or denylist) mechanism is added — rotating `SESSION_SECRET` invalidates _every_
session at once, which is the only revocation lever that exists right now. Every new public
route (there should be very few) must be added to `proxy.ts`'s allowlist explicitly; every
other route is protected without any action required.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`).

---

## [2026-08-14] 011 — Local mongod stays standalone; replica-set conversion deferred to Phase 3

**Decision:** The project owner's local mongod (a Homebrew service, confirmed running on
`localhost:27017`) remains a standalone instance for Phase 1. It is **not** converted to a
single-node replica set now, even though `DATA-MODEL.md` §5 states dev should use one so
that multi-document transactions work.

**Context:** Phase 1 (Mongoose models, tenant-guard repository, index sync, seed script)
does not itself need transactions — no step writes to two collections atomically. The
project owner asked for the reasoning restated before deciding, then chose to defer the
conversion rather than do it now.

**Rationale:** Transactions are needed starting Phase 3 (Vendor + Engagement created
together) and Phase 8 (Risk write + Assessment score update together), not Phase 1. Since
nothing in this phase requires them, converting now would be doing risky-adjacent
infrastructure work (editing `mongod.conf`, restarting a system service) ahead of the point
where it's actually load-bearing, for a benefit this phase doesn't use.

**Alternatives rejected:**

- _Convert now regardless_ — the technically tidy choice (the database was empty, nothing
  to lose), but the project owner asked to hold off, and the conversion carries a small
  independent risk (config edit + service restart) unrelated to Phase 1's actual scope.
- _Redesign `DATA-MODEL.md` §5 to avoid transactions entirely_ — offered as a third option;
  not chosen. Would mean reworking the intake and risk-write flows around eventual
  consistency before those flows are even built, which is solving a problem prematurely.

**Consequences:** This must be raised again, explicitly, before Phase 3 begins — Phase 3's
"Vendor + Engagement written atomically" step (`PLAN.md`) will fail against a standalone
mongod with a clear MongoDB error (`Transaction numbers are only allowed on a replica set
member or mongos`), not a subtle bug. `TEST-CHECKLIST.md` now documents that this repo runs
against a standalone instance so that error isn't mysterious when it happens.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), option selected by the project owner
after requesting the rationale be restated.

---

## [2026-08-13] 010 — Phase 0 executed without a git baseline

**Decision:** Phase 0 (scaffold and guardrails) was carried out without step 1 of
`PLAN.md`'s Phase 0 — the initial commit that establishes a rollback point. All other Phase
0 work (Next.js scaffold, shadcn/ui, design tokens, Zod env, ESLint/Prettier/Vitest,
`npm run verify`) proceeded on top of an uncommitted working tree.

**Context:** The project owner stated at the start of this session that git setup would
happen later and asked to proceed with building. `ROLLBACK.md` had already recorded "no
rollback point exists" as the repository's starting condition; that condition is now
carried forward through an entire phase of work rather than resolved by it.

**Rationale:** The instruction was explicit and unambiguous, and deferring git setup does
not make any individual file change riskier in itself — everything written this phase is
additive (new files, or edits to files with no prior committed version to lose). The
increased risk is systemic, not local: there is currently no single point to revert _to_ if
something goes wrong across the whole phase, only the ability to inspect and hand-fix
individual files.

**Alternatives rejected:**

- _Insist on a commit before proceeding_ — technically safer, but overrides an explicit,
  reasonable instruction from the project owner for a low-actual-risk phase (scaffolding,
  no destructive operations).
- _Silently commit anyway "to be safe"_ — would violate `CONSTRAINTS.md` #5 (don't commit
  without being told to) and second-guess an instruction that was clear, not ambiguous.

**Consequences:** `ROLLBACK.md`'s baseline SHA is still unfilled. Phase 1 (data layer) is
next per `PLAN.md`, and it is exactly the kind of change `ROLLBACK.md` says mandates a
rollback plan (touches more than one module, if MongoDB is involved). This should be raised
again before Phase 1 begins, not assumed resolved.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), instruction given directly by the
project owner.

---

## [2026-08-13] 009 — Phasing: linear vertical slices, auth and tenancy isolated

**Decision:** The build is sequenced as 13 phases (0–12) in `PLAN.md`, each a vertical slice
that is independently demoable. The tenant guard is built first (Phase 1), the
`questions_schema` format is fully specified before any assessment exists (Phase 5), and
multi-workspace RBAC/roll-up comes last (Phase 11). Phases 2, 6, and 11 — internal auth, OTP
portal auth, and tenancy surfaces — are each their own request with a `ROLLBACK.md` active
plan filled in first.

**Context:** Solo developer, no fixed deadline (confirmed by the project owner). That rules
out parallel workstreams and favours the smallest slices that can be demonstrated and
verified one at a time.

**Rationale:** The ordering is driven by cost-to-unwind, not by feature value. Retrofitting
tenant isolation across ten phases of existing queries is a rewrite, so it goes first.
Changing `questions_schema` after frozen snapshots exist means migrating documents that are
by definition immutable, so it is specified before Phase 6 creates the first snapshot.
Multi-workspace surfaces go last precisely _because_ every collection already carries
`workspace_id` from Phase 1 — Phase 11 adds UI and authorisation, not isolation.

**Alternatives rejected:**

- _Horizontal layers (all models, then all services, then all UI)_ — nothing is demoable
  until the end, and nothing is verifiable in between.
- _Feature-value ordering (register and dashboards early)_ — would put the tenant guard after
  the queries that need it.
- _Multi-tenancy last as an afterthought_ — rejected; that is how `workspace_id` gets missed
  on a collection.

**Consequences:** Phase 0 delivers no user-visible feature, which will feel slow. Phase 1
likewise. Accepted deliberately. Phases 3–7 form the first coherent demo (intake → tier →
assessment → portal → submit).

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), phasing proposed and delivery context
confirmed by the project owner.

---

## [2026-08-13] 008 — Score authority, and tiering fails loudly

**Decision:** `risk.residual_score` is authoritative and computed on risk write.
`assessment.overall_score` is **derived** from the constituent risks and recomputed in the
same operation — nothing else writes it. Separately: if any inherent-scoring input is missing
or unmappable the engine returns a failure rather than a score; `inherent_risk_tier` stays
`null` (no schema default), the engagement moves to `scoring_failed`, and it surfaces in a
triage queue. The resolved weights and their version are snapshotted onto the engagement.

**Context:** `FLOW.md` F4 flagged that steps 4 and 7 both write scores without defining which
is authoritative. `FLOW.md` F1 flagged that an unscored tier must not silently default to
Tier 3. Both were open gaps, not yet decisions.

**Rationale:** Two writers to a score with no defined precedence guarantees the register and
the assessment will eventually disagree, and there is no way to tell which is right. One
writer, one direction removes the class of bug. On fail-loud: a high-risk vendor silently
recorded as Tier 3 (low criticality) is the worst output this system can produce and the one
nobody would notice — a missing tier is visible, a wrong tier is not. The weights snapshot
exists because weights live in mutable `workspace.settings`; without it, a score computed in
March cannot be explained or reproduced in November.

**Alternatives rejected:**

- _Recompute `overall_score` on read_ — always consistent, but unindexable and unsortable,
  which the register table needs.
- _Default an unscoreable intake to Tier 1 (most conservative)_ — safer than Tier 3, but
  still fabricates a risk judgement and hides the scoring bug. Failing is honest.
- _Weights read live at explain time_ — cheaper, but makes history unreproducible.

**Consequences:** A `scoring_failed` queue must exist in the UI from Phase 3, and
`RiskTierBadge` must render `null` as a visible warning — never blank, never green
(`DESIGN-SYSTEM.md` §4). Risk writes need a transaction spanning `risks` and `assessments`.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`).

---

## [2026-08-13] 007 — Template immutability by embedded snapshot

**Decision:** Creating an assessment embeds `template_snapshot` — a frozen copy of the
published `questions_schema` — on the assessment document, in addition to keeping
`template_id` and `template_version` for provenance. The questionnaire format itself carries
a `schema_format_version`.

**Context:** `CONSTRAINTS.md` #11 and `TEST-CHECKLIST.md` Gate 5 require historical
assessments to keep rendering exactly as they were answered. Spec §3 only implies a
`template_id` reference.

**Rationale:** A reference satisfies the requirement only while the template document remains
intact _and_ the renderer's interpretation of the format is unchanged. Both are assumptions
about the future. Embedding makes correct historical rendering a property of the assessment
document itself, so no future template migration, deletion, or format change can break Gate 5.
`schema_format_version` lets the evaluator keep reading old snapshots after the format
evolves, which is the one thing embedding alone would not solve.

**Alternatives rejected:**

- _`template_id` + `version` reference only_ — smaller, but couples a compliance-critical
  guarantee to the continued integrity of another document.
- _Copy-on-write template documents_ — equivalent guarantee, extra collection, extra joins,
  and still breaks if the format's interpretation changes.

**Consequences:** Schema duplication per assessment (kilobytes — acceptable). Any change to
the conditional-logic evaluator must remain backward-compatible with every
`schema_format_version` in existence. Publish-time validation must reject forward references
so single-pass evaluation stays safe.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`).

---

## [2026-08-13] 006 — Responses as their own collection; CAPs embedded

**Decision:** `responses` is a separate collection keyed uniquely by
`(workspace_id, assessment_id, control_id)`. Corrective action plan tasks are embedded as an
array on the `risks` document.

**Context:** Spec §3 lists "Question / Control Response" as its own entity but does not state
embedded-versus-referenced, and does not mention CAP tasks as an entity at all.

**Rationale:** Opposite answers for opposite access patterns. Responses are written one
control at a time by portal autosave — a separate document avoids whole-document contention,
keeps evidence metadata from pushing the assessment toward MongoDB's 16 MB ceiling, and the
unique compound index makes autosave an idempotent upsert. CAP tasks are always read with
their parent risk and never queried independently of one, so embedding avoids a join for no
loss.

**Alternatives rejected:**

- _Responses embedded on the assessment_ — one atomic read, but autosave contention and an
  unbounded array on a document that must live forever.
- _CAPs as a separate collection_ — needed only if CAP reporting must span risks. That is the
  trigger to split them out later, not a reason to do it now (YAGNI).

**Consequences:** Rendering an assessment is two queries, not one. `is_suppressed` must be
persisted on the response so the validator can distinguish "hidden" from "skipped" — the
deadlock at `FLOW.md` F3.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`).

---

## [2026-08-13] 005 — UI: Tailwind + shadcn/ui, Swiss/minimal, two densities

**Decision:** Tailwind CSS with shadcn/ui components copied into the repo. Visual direction
is Minimalism & Swiss Style; palette is professional blue/neutral-grey (`#0F172A` primary,
`#0369A1` CTA); typography is Inter as a single family. The internal console and the vendor
portal share tokens but use deliberately different densities and information architecture.
Full specification in `DESIGN-SYSTEM.md`.

**Context:** The spec says nothing about UI. Recommendations were taken from the
`ui-ux-pro-max` skill's data for enterprise/GRC dashboards. (Its `search.py` could not run —
requires Python 3.12+, this machine has 3.9 — so the CSV data was read directly.)

**Rationale:** shadcn components are owned outright, so there is no runtime UI dependency to
upgrade around and no theming fight — appropriate for a long-lived internal tool. The skill's
data rates Swiss/minimal as best-for enterprise dashboards at WCAG AAA and Tailwind 10/10,
while explicitly warning off glassmorphism, neumorphism, and aurora gradients for
"data-heavy dashboards" and "critical accessibility". Inter as one family means one font
load and tabular figures for score columns. The two-density split is the substantive call:
the risk analyst wants maximum information per screen, the vendor SPOC is a reluctant
infrequent user who will abandon a dense form — and an abandoned questionnaire defeats the
platform's purpose.

**Alternatives rejected:**

- _MUI_ — mature DataGrid is genuinely attractive for the risk register, but a heavier bundle,
  a more opinionated visual language, and a runtime dependency to version-track.
- _Tailwind with hand-built components_ — maximum control, but dialogs, comboboxes, and date
  pickers would be rebuilt including their accessibility, which shadcn already gets right.
- _One density for both surfaces_ — cheaper, and the reason most GRC portals have poor vendor
  completion rates.

**Consequences:** shadcn's Radix peers must be approved under `CONSTRAINTS.md` #1. Component
code lives in the repo and is maintained by us, upstream fixes are not automatic. Every
severity indicator must be icon + label + colour, never colour alone.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), option selected by the project owner.

---

## [2026-08-13] 004 — TypeScript, App Router, Mongoose, Zod

**Decision:** TypeScript in strict mode; Next.js App Router with Server Components for the
internal console and two route groups (`(internal)`, `(portal)`); Mongoose as the ODM; Zod for
boundary validation. Layering is route handler → service → repository.

**Context:** Spec §1.1 commits to "Next.js" and "MongoDB" without specifying router, language,
or data-access approach. `ARCHITECTURE.md` §7 carried all three as open questions.

**Rationale:** The scoring engines and `workspace_id` scoping are exactly where a silent wrong
answer is most expensive, and exactly what a type system checks cheaply — so TypeScript is not
a preference here, it is a control. App Router because route groups give the internal console
and the external portal genuinely separate middleware and layouts, which suits a hard auth
boundary better than a shared `pages/` tree; it is also where Next.js is going. Mongoose
because MongoDB enforces no schema of its own and this data has compliance-grade integrity
requirements — and because declaring indexes alongside the model is what makes
"`workspace_id` first in every index" reviewable in one place. Zod _and_ Mongoose,
deliberately: Zod validates untrusted HTTP input and environment variables at the boundary,
Mongoose validates document shape at the database. They check different things.

**Alternatives rejected:**

- _Raw `mongodb` driver + Zod only_ — fewer abstractions and no ODM lock-in, but every schema
  guard and index becomes hand-written and easy to omit.
- _Pages Router_ — more examples available and no Server Component learning curve, but it is
  the legacy path and gives a weaker separation between the two auth surfaces.
- _Plain JavaScript_ — faster to start, and drops compile-time checking precisely on the
  scoring and tenant-scoping paths.

**Consequences:** Adds `typescript`, `mongoose`, and `zod` — approval required under
`CONSTRAINTS.md` #1. Server Components mean care about what runs where; a Mongo client must
never reach a client component (`CONSTRAINTS.md` #9). Mongoose `autoIndex` stays off outside
development, so an explicit index-sync script is required.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), option selected by the project owner.

---

## [2026-08-13] 003 — Tenancy: shared database with `workspace_id`, guarded by construction

**Decision:** One MongoDB database. Every tenant-scoped collection carries `workspace_id`, and
it is the first field of every index on those collections. All data access goes through a
repository base class that requires a `TenantContext`; constructing one without a
`workspace_id` throws `TenantScopeError`. There is no repository method that accepts a raw
filter. `users`, `mitigation_guidance`, and `shared_documents` are deliberately not
tenant-scoped; the exception on `vendors.spoc.spoc_email` is documented in `DATA-MODEL.md` §2.

**Decision also names the project: MV-VRA.**

**Context:** `ARCHITECTURE.md` §7 carried this as an open question, with shared-database
_assumed_ but not decided. `CONSTRAINTS.md` #8 makes isolation non-negotiable regardless of
which model is chosen.

**Rationale:** At the expected scale (assumption A1: tens of workspaces, low thousands of
vendors) database-per-tenant buys a stronger guarantee at a real cost — connection-pool
sprawl, N migrations per schema change, and the executive roll-up becoming a cross-database
fan-out job. Shared-database keeps roll-ups a single aggregation. The honest downside is that
isolation becomes application-enforced, so the code _is_ the security boundary. That is
mitigated structurally rather than by discipline: an unscoped query is made impossible to
express, and because `workspace_id` leads every index, any query that somehow lacks it
degrades to a visible collection scan instead of quietly returning another tenant's data.

**Alternatives rejected:**

- _Database per tenant_ — better isolation and an easier data-residency story, but the
  operational cost is not justified at this scale, and it would be reconsidered if A1 breaks.
- _Shared DB behind an abstraction that could become per-tenant later_ — the offered
  middle option; rejected as speculative indirection. The repository layer already isolates
  every query, so it is the natural place to change the physical model later if needed.

**Consequences:** Tenant isolation is the highest-priority test surface in the project
(`TEST-CHECKLIST.md` Gate 4) and Phase 1 exists to build the guard before any feature query.
A missing tenant filter is a breach, not a style issue. If assumption A1 breaks, this entry
must be revisited and superseded rather than patched around.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), option selected by the project owner.

---

## [2026-08-13] 002 — Field Guide documentation system adopted

**Decision:** Habits 1–9 of the AI Collaboration Field Guide are implemented as `CLAUDE.md`
plus nine documents in `docs/`. Maintaining them is part of the definition of "done."

**Context:** AI-assisted sessions start with amnesia; the reasoning behind each change
evaporates when the session ends. The project is at zero code, so the discipline can be
established before there's a backlog of undocumented decisions.

**Rationale:** `CLAUDE.md` at the repo root is auto-loaded into every Claude Code session,
so the rules are enforced by default rather than relying on the operator to paste them in.
The nine artifacts live in `docs/` to keep the root clean while staying next to the code.
`ARCHITECTURE.md` and `FLOW.md` were pre-filled from the MVP spec instead of left empty —
an empty template gets ignored, and the spec content was already available to ground them.

**Alternatives rejected:**

- _Docs at repo root_ — nine more root files would bury the specs and the eventual app dirs.
- _Empty scaffolds_ — cheaper to write, but a blank `FLOW.md` never gets filled in.
- _Documenting architecture as fact_ — rejected as misleading; no code exists, so both
  files carry explicit "NOT YET BUILT / unverified intent" status banners.

**Consequences:** Every session now has a read-first and write-last ritual. Docs will drift
if the ritual is skipped, so drift is treated as a bug. `ARCHITECTURE.md` and `FLOW.md`
must be rewritten with real file references as code lands.

**Decided by:** Claude Opus 5 (`claude-opus-5[1m]`), at the user's direction.

---

## [pre-2026-08-13] 001 — MVP stack and scope (imported from spec)

**Decision:** Next.js (frontend + API routes), MongoDB, AWS S3 in production with local
filesystem in development, static super-admin credentials for internal auth in dev, and
Email OTP to the Vendor SPOC for external portal access. Eight feature areas — AI evidence
analysis, Google SSO, automated discovery, agentic AI, control framework library,
continuous monitoring, contract/SLA tracking, and third-party integrations — are parked.

**Context:** Recorded in `VRA MVP Feature Specification.md` §1 and §4 before this decision
log existed.

**Rationale:** ⚠️ **Not documented in the source spec.** The spec states these choices but
not the reasoning behind them. The stated intent is a "streamlined workflow orchestration
engine without complex external integrations or AI agentic layers," which implies scope
control was the driver — but the specific choice of MongoDB over a relational store, and
the tradeoffs accepted with it, are unrecorded.

**Action required:** The project owner should backfill the rationale here. Until then,
treat the reasoning as unknown rather than assuming it. This matters most for MongoDB,
since the tenancy model (`ARCHITECTURE.md` §7) depends on why it was chosen.

**Consequences:** Document-oriented modelling with nested subdocuments and no joins;
`workspace_id` filtering carries tenant isolation in application code rather than being
enforced by the database; storage must be abstracted to keep dev/prod parity.

**Decided by:** Project owner (pre-dates this log). Entry transcribed by Claude Opus 5
(`claude-opus-5[1m]`) on 2026-08-13 — transcription only, no rationale invented.
