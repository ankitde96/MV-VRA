# HANDOVER.md — Where Things Stand

> Guide habit 1. Read this first, every session. Update it last, every session.
> Living record of the current state — not a dump of project history. Newest entry on top.
> Trim or delete stale entries; this file should stay short enough to actually be read.

---

## Current state (as of 2026-08-19)

- **Assessment workflow revamp complete — Stages 1–5 verified.** Stage 5 adds explicit
  per-control compliant/non-compliant review, reviewer-note autosave, a bounded correction
  round that reopens only non-compliant controls, server-enforced compliant-control locks,
  risk-gated completion, and per-vendor open-risk visibility. `npm run verify` is green
  (29 files, 225 tests, production build); Playwright is green (23 passed across desktop
  and mobile, one intentional desktop skip). The disposable browser correction journey
  proves verdict persistence, resend, reviewer-note visibility, and compliant/non-compliant
  edit boundaries. See `docs/features/assessment-workflow-stage-5-review-resend.md` and
  `DECISIONS.md` 045.
  **Stages 1–2 context:** Six defects/gaps were reported against the shipped assessment
  flow (no vendor evidence upload; no per-vendor questionnaire tailoring; a thin assessment
  history; single-SPOC vendors; no explicit send step; no per-question compliance verdict).
  Planned across five stages in `docs/ASSESSMENT-WORKFLOW-PLAN.md` (decisions D1–D8,
  `DECISIONS.md` 040) before any code — **read that plan file first**, then this entry, then
  the feature traces below before touching the remaining Stage 5 work.
  - **Stage 1 — evidence upload on every question — done.** The render/upload gate keyed on
    a template's `evidence` object is relaxed (the real 130-question seeded questionnaire
    never set one, so the control was invisible on all of them); evidence deletion was added
    (no delete path existed before). See
    `docs/features/assessment-workflow-stage-1-evidence-upload.md`, `DECISIONS.md` 041.
  - **Stage 2 — multiple Vendor SPOCs — done.** ⚠ Was auth-touching.
    `vendor.spocs[]` (additive) replaces the single embedded `spoc` as what OTP login,
    CAP-escalation contact, and (from Stage 4) questionnaire recipients resolve against; the
    legacy field is kept, unread by anything new. Portal session payload gained a required
    `spocId`. A real Mongoose 9 bug was found and fixed during verification — `updateOne()`
    with an aggregation-pipeline array now needs `{updatePipeline: true}` explicitly; a prior
    Mongoose major didn't require that — see
    `docs/features/assessment-workflow-stage-2-multi-spoc.md` §7, `DECISIONS.md` 042. Ran the
    real backfill migration (`npm run migrate:vendor-spocs`) against real pre-existing dev
    data, not just fixtures.
  - **Both stages verified: `npm run verify` green (212/212 tests, format/lint/typecheck/
    build clean) plus extensive real-HTTP-request walkthroughs** — see each trace's §9 for
    exact commands and output. Two transient test failures were hit, diagnosed, and either
    fixed (a Stage-2 test fixture genuinely needed `spocs[]` added) or confirmed as a
    pre-existing cross-file local-fs storage race unrelated to this work (reproduces
    intermittently across the whole suite, never in isolation).
- **Next up:** choose the next product plan; the assessment workflow plan has no open stage.

- **Browser E2E and portal reliability hardening added (2026-08-18).** Playwright now runs
  desktop Chromium and a Pixel 7 viewport against a real Next.js server. The read-only suite
  covers
  protected-route return behavior, generic credential failure, internal/portal session
  isolation, primary admin navigation, business-owner denial, seeded vendor login, and an
  OTP-request failure. Portal UX now refuses to advance after a failed OTP request, exposes
  autosave errors with a retry action, flushes pending autosaves before submission, and
  presents upload failures as accessible retryable states. See `e2e/`,
  `playwright.config.ts`, and `docs/features/browser-e2e-ux-reliability.md`.
- **Verification is fully green again.** The new browser gate passes 14/14 across desktop
  Chromium and Pixel 7; Vitest passes 206/206; format, typecheck, and production build pass.
  Fixing the long-documented Next.js route-type blocker required making the shared
  `withRouteErrors` wrapper's request/context parameters non-optional, matching the runtime
  contract every route already receives. Lint retains one known TanStack Table React
  Compiler advisory and no errors.
- **Documentation current-state cleanup completed.** `ARCHITECTURE.md` no longer claims the
  repository has no commits, `TEST-CHECKLIST.md` defines the browser gate, README documents
  setup/scripts, and `ROLLBACK.md` records this task's real baseline. Historical phase notes
  remain historical rather than being rewritten.

- **Work directly on `main`** — do not create branches or pull requests unless explicitly
  requested. Commits and pushes still require a direct request. See `DECISIONS.md` 039 and
  `CONSTRAINTS.md` #5.

- **Library additions are permanently pre-approved project-wide** — there is no
  per-package, per-session, or per-feature approval requirement. This supersedes the former
  `CONSTRAINTS.md` #1 restriction and `DECISIONS.md` 028's temporary exception. Continue to
  pin, document, and verify consequential additions. See `DECISIONS.md` 038.

- **MV-VRA Console redesign implemented** — the app now uses flat Swiss-style opaque
  surfaces, Geist typography, and the confirmed `#00A15C` action green. The locked risk
  palette is unchanged. Added Vendor `business_unit`, dashboard tier-by-BU aggregation,
  vendor filter chips, template section/question counts, `/assessments` review queue,
  cross-linked split login surfaces, and a section-based vendor portal questionnaire.
  See `docs/features/mv-vra-console-redesign.md` and `DECISIONS.md` 037.
- **Prior redesign verification note:** lint had zero errors (one existing TanStack compiler
  warning); 205/206 tests passed in that historical full run and the lone local-storage
  sharing failure passed on isolated rerun. See the newest entry above and current terminal
  verification for the present state rather than treating this historical count as current.

- **Recharts hydration mismatch fixed at root cause** — `DECISIONS.md` 034 corrects 030's
  "documented, not fixed" call after the user hit it directly in the browser console. Every
  chart now threads a `React.useId()`-derived `id` into its recharts container.
- **Real client questionnaire seeded** — `npm run db:seed-questionnaire`
  (`scripts/seed-questionnaire-template.ts`) imports the client-provided WFPL Vendor Risk
  Assessment Questionnaire v2.0 (`docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv`)
  as a published, immediately-assignable template — 19 sections, 130 questions, all
  `single_select` Yes/No per explicit direction (a real semantic loss for the handful of
  genuinely open-ended source questions, done anyway as instructed). Idempotent; now part of
  README's Getting Started sequence. `DECISIONS.md` 035.

**Project name:** MV-VRA (MoneyView Vendor Risk Assessment).
**Phase:** Phases 0–11 done (the original MVP). Two post-MVP UI passes now complete:
**UI Revamp Round 1** (8 phases, Swiss-flat design system — `docs/features/ui-revamp.md`)
and **UI Revamp Round 2** (6 phases, glass + KPI/KRI analytics — `docs/UI-REVAMP-2-PLAN.md`,
`DECISIONS.md` 028–033). Neither is part of `PLAN.md`'s 0–11 sequence.

- **UI Revamp Round 2 (Phases A–F) done, `npm run verify` green throughout every phase,
  204/204 tests, zero regressions, six commits (`45c392e`…`6be4510`).** Lifted §2's
  Glassmorphism rejection app-wide (`.glass-panel`/`.glass-panel-sm`, aurora-mesh hero,
  `DECISIONS.md` 028) while keeping every risk-severity surface flat and unchanged. New
  `lib/services/analytics.ts` computes the KRI/KPI framework (risk aging, residual exposure
  trend, cycle time, MTTR, reassessment-overdue, portal-stall, CAP closure rate, review
  coverage) from three new additive nullable fields (`Assessment.due_date`/
  `next_review_due`, `Risk.closed_at` — three of the original six-field plan turned out to
  already exist under other names, `DECISIONS.md` 029). Rebuilt the dashboard into a KRI/KPI
  cockpit (Phase C), gave the executive roll-up its two spec'd-but-never-built charts (Phase
  D — grouped-bar tier comparison, CAP age buckets), built the per-vendor risk scorecard
  §4 spec'd in Round 1 and never built (Phase E — `ScoreBreakdown`, assessment history,
  evidence coverage), and closed out Round 1's two remaining debts (Phase F — `DataTable`
  migration for admin-users/sharing, toast conversion audited via a full repo grep, two
  deliberate exceptions kept per §6/§7). Full details: `docs/UI-REVAMP-2-PLAN.md`,
  `DECISIONS.md` 028–033.
- **Two real bugs were found and fixed via live browser verification, not assumed** — this
  is the discipline worth carrying forward: (1) a chart's workspace-name x-axis labels
  collided with its legend in vertical orientation (Phase D, fixed by switching to
  horizontal); (2) a "reduction %" stat was hardcoded green regardless of sign, but
  `residual_total` can legitimately exceed `inherent_score` once a vendor carries several
  open risks — a vendor whose risk had _grown_ would have displayed as improved (Phase E,
  fixed via sign-based coloring). Neither would have been caught by typecheck/lint/tests.
- **`dataviz` skill's palette validator flagged a real, pre-existing accessibility gap**:
  the locked risk-severity palette's light-mode critical↔high pair sits below the
  normal-vision-floor threshold (`DECISIONS.md` 030). Not fixed — recoloring a
  locked, everywhere-used palette is its own decision, out of scope for a chart-building
  task. Mitigated per-chart with mandatory legends/tables; flagged here for a future
  accessibility pass to start from.
- **UI Revamp Round 1 (Phases 0–8) done, 190/190 tests, zero regressions** — Swiss-flat
  design system, sidebar shell, `⌘K` command palette, `DataTable` (vendors/risk-register/
  templates only — admin-users/sharing were Round 1 debt, closed in Round 2 Phase F), OTP
  portal redesign. `@tanstack/react-table@8.21.3`/`recharts@2.15.4` pinned after `npm i`
  resolved newer, incompatible majors (`DECISIONS.md` 026) — re-verify against the actual
  `data-table`/`chart` components before ever bumping either forward. Full details:
  `docs/features/ui-revamp.md`.
- **Git baseline established 2026-08-18** (`DECISIONS.md` 027) — root commit (300 files,
  Phases 0–11 + UI Revamp Round 1) pushed to `origin/main` (`github.com/ankitde96/MV-VRA`),
  followed by six more commits for Round 2. Every "no revert path" caveat in prior entries
  (010, 011, 014, 025) is resolved as of `0ea5688`.
- **Not done, deliberately** (see `docs/UI-REVAMP-2-PLAN.md`'s own scope notes): no
  automated a11y tooling (axe/Lighthouse); the "evidence gap rate" KRI is an approximation
  (answered-with-no-evidence, not "questions that actually require evidence" — no schema
  flag exists to join against); "cross-workspace share reuse" KRI not implemented; radar
  chart (control-domain coverage) not built — no code maps risks to a control-domain
  taxonomy, would have fabricated data.

**Prior phase (0–11, original MVP):**

- **Phase 11 (multi-workspace RBAC, sharing, executive roll-up) is done and verified**,
  closing `FLOW.md` F6 — the fourth and last fully-✅-BUILT flow. Removed the Phase 2
  `SUPER_ADMIN_EMAIL` login gate (`DECISIONS.md` 013, 024) — `login()` now authenticates any
  active `User` whose password matches. Built a four-role capability matrix
  (`lib/auth/rbac.ts`: `admin`/`risk_analyst`/`business_owner`/`viewer`) enforced via
  `requireCurrentMembershipWithCapability()` on every authorization-sensitive route,
  backed by `getCurrentMembership()` — resolved fresh from the database on **every
  request**, never cached in the signed session cookie, so a role change takes effect on
  the very next request, not at next login (verified by real HTTP request: promoted a
  fixture user mid-session with no re-login, the same cookie immediately gained the new
  capability; demoted, immediately lost it again). Applied capability checks to all 22
  pre-existing internal-facing routes. Built workspace switching
  (`lib/services/workspace-membership.ts`), admin user/membership management
  (`lib/services/admin-users.ts`), Cross-Workspace Document Sharing
  (`lib/services/sharing.ts` — the first-ever code to use the `SharedDocument` model,
  unused since Phase 1; every read through it is unconditionally audit-logged) and the
  executive roll-up (`lib/services/executive-rollup.ts` — authorizes **per membership
  inside its own loop**, not once at the top, so a user with an `admin` role in one
  workspace and a `viewer` role in another gets a roll-up that includes the first and
  silently omits the second). Extended `scripts/seed.ts` with a second workspace and
  fixture users of every role. Built four new UI surfaces: workspace switcher, admin users
  page, sharing page, roll-up dashboard. Ran the full gate suite (`format`/`lint`/
  `typecheck`/`test`/`build`, all clean, 190 tests total) and verified every named exit
  criterion by real HTTP request against a running dev server: multi-user login,
  workspace switching (including a refused cross-membership attempt), RBAC denial and
  dynamic role-change effect in both directions with no re-login, a real cross-workspace
  document share with byte-identical download and a refused unauthorized-workspace read,
  and the roll-up's per-membership authorization producing exactly the right included/
  excluded workspace sets for three different fixture accounts. See
  `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`,
  `DECISIONS.md` 024.
- **No invite-email flow exists for new users** — an admin sets a new user's initial
  password directly (`DECISIONS.md` 024). A real deployment would likely want this
  reworked before launch.
- **`getCurrentMembership()` adds one database read to every authorization check** — a
  deliberate cost for a security-relevant field that must never go stale, not an oversight.
  Revisit only if profiling ever shows it matters; never solve it by caching the role in the
  signed cookie itself.
- **Phase 10 (offboarding, destruction certificates, archiving) is done and verified**,
  closing `FLOW.md` F5 end to end — the third fully-✅-BUILT flow (after F3, F4). Built
  `OffboardingRepository` (checklist/certificate writes, each method structurally filtered
  to exclude an already-`archived` document — no service-layer-only check) and
  `AssessmentRepository.archive()` (the sole writer of `Assessment.status: 'archived'`).
  Because nothing before this phase could archive an assessment, added a new guard —
  `assertAssessmentNotArchived()` in `AssessmentReviewService` — to `raiseRisk()`/
  `updateRisk()`/`createCapTask()`/`updateCapTask()`, refusing (403) any risk/CAP-task
  write once the parent assessment is archived; this closes a gap Phases 8–9 couldn't have
  had. Built `lib/services/offboarding.ts` (initiate → checklist → certificate
  upload/verify → `completeOffboarding()`, a single atomic transaction archiving the
  offboarding record and every one of the engagement's assessments, closing the engagement,
  and terminating the vendor's lifecycle status), five API routes, and an offboarding panel
  on the vendor detail page. `Offboarding`'s schema was unused since Phase 1 and needed no
  changes. Ran the full gate suite (`format`/`lint`/`typecheck`/`test`/`build`, all clean,
  159 tests total) and verified the exit criterion by real HTTP request against a running
  dev server: refused premature completion at three separate readiness gates (no checklist
  done; checklist done but no certificates; certificates uploaded but unverified),
  successful archival once genuinely ready, confirmed all four documents landed in their
  correct terminal state in one pass, confirmed the archived assessment still renders,
  confirmed `raiseRisk()` against it now returns 403, confirmed a second completion attempt
  and a checklist mutation against the archived record both return 422, and confirmed the
  route is refused unauthenticated (401). See
  `docs/features/phase-10-offboarding-destruction-certificates-archiving.md`,
  `DECISIONS.md` 023.
- **The offboarding checklist's owner field is a raw `User._id` text input, not a picker** —
  same deferral as Phase 9's CAP dialog owner field (`DECISIONS.md` 013).
- **No retention/expiry or hard-delete path exists for archived records** — deliberate,
  `PLAN.md` §1's own stated default ("indefinite, nothing is deleted").
- **Phase 9 (CAP tracking and mitigation guidance) is done and verified**, closing
  `FLOW.md` F4's last step — F4 is now fully ✅ BUILT end to end. Before writing any Phase 9
  code, closed the test-debt gap Phase 8 left behind: `lib/scoring/
__tests__/residual-risk.test.ts` (9 unit tests) and `lib/services/
__tests__/assessment-review.test.ts` (integration, against a real MongoDB — raiseRisk/
  updateRisk/completeReview/listWorkspaceRisks). Then built CAP task create/update
  (`AssessmentReviewService.createCapTask()`/`updateCapTask()`, two new routes under
  `/api/risks/[id]/cap-tasks`) and request-driven overdue detection + one-time escalation
  (`detectAndEscalateOverdueCaps()`, `GET /api/risks/cap-tasks/overdue`) — no job runner,
  per `PLAN.md` §1's own stated default. One additive schema field made "escalate once"
  possible without a scheduler: `Risk.cap_tasks[].escalated_at`. Extended the Risk Register
  page with an "Overdue Corrective Actions" queue and an expandable per-risk CAP task list.
  Ran the full gate suite (`format`/`lint`/`typecheck`/`test`/`build`, all clean, 155 tests
  total) and verified the exit criterion by real HTTP request against a running dev server:
  created a CAP task with a past due date, confirmed the overdue-queue endpoint flagged it
  `overdue` and sent **exactly one** escalation email (grepped the dev console mail log —
  count stayed at 1 across two calls), confirmed closing the task removes it from the queue
  even with its due date still in the past, and confirmed the route is refused
  unauthenticated (401). See
  `docs/features/phase-9-cap-tracking-and-mitigation-guidance.md`, `DECISIONS.md` 022.
- **The CAP dialog's internal-owner field is a raw `User._id` text input, not a picker.**
  Deliberate — this MVP has exactly one authenticatable internal user
  (`DECISIONS.md` 013's `SUPER_ADMIN_EMAIL` gate) — a real picker has nothing to populate
  yet. Revisit once real multi-user internal auth exists.
- **Local dev environment is set up and verified working.** MongoDB was running standalone
  (not the required single-node replica set) — added `replication.replSetName: rs0` to
  `/opt/homebrew/etc/mongod.conf`, restarted the service, ran `rs.initiate()`. `npm run
db:indexes` and `npm run db:seed` both run clean. `npm run dev` serves on port 3000.
- **Phase 8 (review, risk register, residual scoring) is done and verified**, closing
  `FLOW.md` F4's steps 1–5 and 7 (step 6, CAP creation, is Phase 9). The code itself
  (`lib/scoring/residual-risk.ts`, `lib/services/assessment-review.ts`,
  `RiskRepository`, five API routes, the reviewer page, and the register page) was written
  in a prior uncommitted session and had never been typechecked or verified — this session
  found and fixed two bug classes (a missing `UnauthorizedError` constructor argument at
  five call sites; a `TenantContext.workspaceId` vs. `Types.ObjectId` type mismatch in
  three audit-event writes — `DECISIONS.md` 021), then ran the full gate suite
  (`format`/`lint`/`typecheck`/`test`/`build`, all clean) and verified the exit criterion
  by real HTTP request against a running dev server: raised a risk against a submitted
  assessment, confirmed `residual_score` matched a hand-computed value, confirmed
  `assessment.overall_score` always equals the sum of its risks' `residual_score` (in the
  same write, never independently — `risk.residual_score` is authoritative,
  `overall_score` is derived), confirmed the register lists it, confirmed a compensating
  control recomputes both scores correctly, confirmed review completion, and confirmed the
  pages render (not just the APIs). Auth boundaries hold: a vendor portal session cannot
  reach the new internal review/risk routes. See
  `docs/features/phase-8-review-risk-register-residual-scoring.md`.
- **No automated test coverage exists for the Residual Risk Calculation or
  `AssessmentReviewService`.** This phase's verification was real-HTTP-request-based, not
  unit/integration-test-based — unlike every prior phase. Add
  `lib/scoring/__tests__/residual-risk.test.ts` and integration tests for
  `AssessmentReviewService` before Phase 9 (CAP tracking) builds on top of unscored risk
  data. `TEST-CHECKLIST.md` Gate 2 flags this explicitly.
- **The full vendor SPOC round trip works end to end, verified by real HTTP request:**
  OTP login → answer → live conditional branching → blocked submission naming the specific
  missing control → evidence upload → successful submission → byte-identical evidence
  retrieval → post-submission edit lock → cross-vendor tampering refused. `FLOW.md` F3 is
  now **fully built**, start to finish (Phases 5–7). See
  `docs/features/phase-7-questionnaire-answering-evidence-upload-validation.md`.
- **`Response.is_suppressed` is never written — it is always `false` in the database.**
  `submitAssessment()` recomputes visibility fresh via `computeVisibility()` at submission
  time instead (`DECISIONS.md` 020). Any future reader (Phase 8's reviewer view, an export,
  a roll-up) that needs to know whether a question was suppressed must call
  `computeVisibility()` itself — the stored column cannot be trusted for that.
- **A small ops script exists for evidence hygiene:** `npm run sweep:evidence` (dry-run) /
  `-- --delete` reports/removes storage files no `Response` or `Vendor.documents` entry
  references. Verified against a real deliberately-created orphan.
- **Assessment assignment and the OTP vendor portal work end to end, verified by real HTTP
  request — this was the highest-risk surface in the system (externally reachable, guards
  another company's data).** Internal side: assigning a `published` template to an
  engagement (`/vendors/[id]`) creates an `Assessment` with a deep-cloned
  `template_snapshot`. External side: SPOC email → OTP (console-logged in dev, never a
  real send) → verify → a portal session (`mvvra_portal_session`, structurally separate
  crypto/cookie from the internal session) scoped to exactly one `vendor_id`. Every Gate 4
  attack class verified by real request: enumeration (byte-identical response, diffed),
  wrong code, replay, attempt-limit lockout (even with the _correct_ code), per-email and
  per-IP rate limiting (429), and cross-vendor scope isolation with two real vendors
  coexisting. See `docs/features/phase-6-assessment-assignment-and-otp-portal-auth.md`.
- **The rate limiter is in-memory/per-process, not shared or database-backed**
  (`DECISIONS.md` 019) — fine for the MVP's no-HA target, but must be replaced before any
  multi-instance deployment. The enumeration-timing mitigation is best-effort (a dummy DB
  read), not a cryptographic constant-time guarantee — say so explicitly to any future
  security reviewer.
- **The questionnaire template builder and versioning work end to end** — form-based
  builder, `draft → published → archived` with publishing structurally frozen
  (`TemplateRepository.updateDraft()`'s filter only matches `status: 'draft'`), a shared
  pure conditional-logic evaluator (`lib/questionnaire/evaluator.ts`) that both the
  builder's preview and (Phase 7) the real portal render through. A global seed-template
  library was **not** built — every workspace starts with zero templates. See
  `docs/features/phase-5-template-builder-and-versioning.md`.
- **Vendor SPOC management and the storage module work end to end** — SPOC edit, document
  upload/download through an authorised proxy route, local-fs active/S3 mock-tested. Two
  Phase 4 modeling decisions aren't in the original spec docs — check `DECISIONS.md` 017.
  See `docs/features/phase-4-vendor-spoc-and-storage.md`.
- **Vendor intake → tiering works end to end** — Inherent Risk Engine, Tiering & Triage,
  atomic Vendor+Engagement write. `network_exposure`/`system_access_level`/
  `business_redundancy` weights are a stated assumption, not from the spec
  (`DECISIONS.md` 015). See `docs/features/phase-3-vendor-intake-and-tiering.md`.
- **Internal login works end to end** — static super-admin credential, argon2, stateless
  HMAC-signed session, `proxy.ts` fails closed by default. **To log in locally:**
  `npm run hash-password -- '<password>'`, set `SUPER_ADMIN_PASSWORD_HASH` in
  `.env.local`, then `npm run db:seed` — the seeded placeholder hash cannot authenticate,
  by design. See `docs/features/phase-2-internal-authentication.md`.
- **The data layer exists and is tenant-isolation-tested against a real database**
  (Phase 1). Local MongoDB is a single-node replica set (`rs0`), not standalone
  (`DECISIONS.md` 014) — required for every multi-document transaction since Phase 3.
- **`audit_events` has its first writer (Phase 3), but Phases 1–2 wrote nothing to it**
  despite `PLAN.md` §3 saying every phase from 1 on should (`DECISIONS.md` 016) — noted,
  not retroactively fixed.
- **Still no git commit, anywhere, across six full phases of work now.** Carried forward
  from Phase 0 (`DECISIONS.md` 010), explicitly re-deferred again this session. This keeps
  compounding — worth raising directly rather than waiting to be asked again.
- Two source specifications remain read-only inputs in the repo root; `docs/PLAN.md` is
  the plan of record; `docs/DATA-MODEL.md` and `docs/DESIGN-SYSTEM.md` are its companions.
- `ARCHITECTURE.md` §7: nine questions resolved (one — the real mail provider — resolved
  only to "still open, separate decision"), four open with recorded defaults, none
  blocking Phase 8.

**Next concrete step:** No phase remains in `PLAN.md`'s 0–11 sequence; both UI Revamp
rounds are done; the git baseline gap is closed (`DECISIONS.md` 027). Open items, none
blocking: (1) rotate `SUPER_ADMIN_PASSWORD_HASH` — the real value was exposed in a prior
session transcript, per project memory; the pushed `.env.example` only ships a blank
placeholder, but the live local secret should still be rotated; (2) the risk-severity
palette's normal-vision-floor gap `DECISIONS.md` 030 flagged, if a real accessibility pass
is ever prioritized; (3) no automated a11y tooling (axe/Lighthouse) exists anywhere in the
app; (4) the eight explicitly-parked post-MVP feature areas (`DECISIONS.md` 001), if the
project owner wants to continue past current scope.

---

## Session log

### 2026-08-18 — UI Revamp Round 2: glassmorphism + KPI/KRI analytics (6 phases)

1. **What we did:** Ran the `brainstorming` skill end to end (Understanding Lock,
   `AskUserQuestion` on glass scope/KPI data scope/surfaces/sequencing, decision log) before
   any code, per project owner's request to move past Round 1's flat design and add real
   risk analytics. Delivered all 6 planned phases, each verified and committed separately:
   **A** — glass/depth token system (`.glass-panel`, aurora-mesh, Lexend display font),
   lifting `DESIGN-SYSTEM.md` §2's Glassmorphism ban while keeping risk-severity surfaces
   flat (`DECISIONS.md` 028). **B** — `lib/services/analytics.ts` (new), the KRI/KPI
   aggregation layer; found 3 of the originally-planned 6 additive schema fields already
   existed under different names once the models were actually read, so only
   `Assessment.due_date`/`next_review_due` and `Risk.closed_at` were genuinely new
   (`DECISIONS.md` 029). **C** — dashboard rebuilt into a KRI/KPI cockpit; ran the `dataviz`
   skill's palette validator before writing chart code per its required procedure, surfacing
   a real pre-existing accessibility gap in the locked severity palette (not fixed, flagged —
   `DECISIONS.md` 030); built `scripts/seed-demo-data.ts` for realistic local verification
   data. **D** — executive roll-up's two missing §5 charts (grouped-bar tier comparison, CAP
   age buckets); live browser verification caught a real label-collision bug, fixed by
   switching orientation, not a workaround (`DECISIONS.md` 031). **E** — per-vendor risk
   scorecard (`ScoreBreakdown`, spec'd in Round 1 and never built); live verification caught
   a real bug — a reduction-percent stat was hardcoded green regardless of sign, but
   residual can legitimately exceed inherent with multiple open risks, so a
   worsening vendor would have displayed as improving (`DECISIONS.md` 032). **F** — portal
   polish (restrained, no charts/KPIs there per §1/§7) plus Round 1's two remaining debts:
   `DataTable` migration for admin-users/sharing, and a full repo-wide `grep` (not just the
   §11 list) for every remaining `Alert variant="destructive"` — converted 9 to `toast()`,
   deliberately kept 2 inline per `DESIGN-SYSTEM.md` §6/§7's own rules (`DECISIONS.md` 033).
2. **What's left:** Nothing planned — this closes the UI Revamp Round 2 scope in full. See
   "Next concrete step" above for open, non-blocking items.
3. **Watch out for:**
   - **The risk-severity palette's colors are still locked and unchanged** — glass/gradient
     is sanctioned everywhere else, but every severity badge and risk-colored table cell
     must stay flat and solid. `git grep 'risk-critical\|risk-high\|risk-medium\|risk-low'`
     combined with `glass-panel` is a fast sanity check if this is ever in doubt.
   - **Three Round-2 timestamp fields are `null`-excluded, never defaulted**, by every
     analytics aggregation that reads them — a record written before this round (or one that
     never reached the step that stamps the field) is correctly excluded from averages, not
     treated as zero. Don't "fix" a `null` by defaulting it without re-reading
     `DECISIONS.md` 029's rationale.
   - **`getVendorScorecard()` is a separate function from `getWorkspaceAnalytics()`, not a
     `vendor_id` filter** — several `getWorkspaceAnalytics()` fields are portfolio-wide by
     definition and have no vendor-scoped equivalent (`DECISIONS.md` 032). Don't try to
     collapse them.
   - **Two portal files still use inline `Alert`, not `toast()`, on purpose** —
     `assessment-answer-form.tsx`'s submit-blocker list and `evidence-upload.tsx`'s
     field-adjacent error. Converting either to a toast would be a UX regression, not a
     cleanup (`DECISIONS.md` 033).
   - **No browser-driven (Playwright-style) automated test exists for any Round 2 UI** —
     every phase was verified by live Chrome browser interaction in this session (light +
     dark, real seeded data, cross-checked against direct DB queries), not by an automated
     regression suite. The next session should not assume repeat coverage.
4. **Files touched:** Too many to list individually — see the six commit messages
   (`45c392e` Phase A, `7c0c0f2` Phase B, `69e398b` Phase C, `a9e498b` Phase D, `e5f62ab`
   Phase E, `6be4510` Phase F) and `docs/UI-REVAMP-2-PLAN.md`'s per-phase file lists.
   `docs/DECISIONS.md` 028–033, `docs/ROLLBACK.md` (Active plan updated per phase),
   `docs/UI-REVAMP-2-PLAN.md` (new). No source specs modified.
5. **Model:** Claude Opus 5 (`claude-opus-5`) for the brainstorming/design session; Claude
   Sonnet 5 (`claude-sonnet-5`) for all six implementation phases.

### 2026-08-18 — Git baseline established; pushed to origin

1. **What we did:** At the project owner's direction ("git is configured, let's push the
   code... also create a readme"), found `origin` already configured
   (`github.com/ankitde96/MV-VRA`) but zero commits. Added `.gitignore` (excludes
   `node_modules/`, `.next/`, `.env*.local`, `.DS_Store`, `tsconfig.tsbuildinfo`,
   `coverage/`, `.codegraph/`) and `.env.example` (README already referenced it via `cp
.env.example .env.local`, but it didn't exist) before staging anything, verified neither
   `node_modules`/`.next` nor `.env.local` were staged, made the root commit (300 files),
   and pushed to `origin/main`. `README.md` already existed and was left as-is.
2. **What's left:** Rotate `SUPER_ADMIN_PASSWORD_HASH` — the real value was exposed in a
   prior session transcript (per project memory), unrelated to this commit but now more
   worth doing since the project has a real remote.
3. **Watch out for:** The pushed history's `.env.example` has a blank
   `SUPER_ADMIN_PASSWORD_HASH=` — never fill that in with the real hash and commit it,
   even to fix a "the example doesn't work" complaint; generate a fresh hash for whoever
   needs one via `npm run hash-password`.
4. **Files touched:** `.gitignore` (new), `.env.example` (new), `docs/DECISIONS.md` (027),
   `docs/HANDOVER.md`. No source code changed.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-17 — Phase 11: multi-workspace RBAC, sharing, executive roll-up

1. **What we did:** Read the session-start docs, drafted a plan for Phase 11 (four steps:
   auth core, RBAC applied everywhere, sharing, roll-up), got explicit approval to proceed
   through all four with subagents doing the development work, and filled `ROLLBACK.md`'s
   Active plan (auth-touching, its own request per `CONSTRAINTS.md` #2). Removed the Phase 2
   `SUPER_ADMIN_EMAIL` gate from `login()`. Built `lib/auth/rbac.ts` (capability matrix),
   `lib/auth/current-membership.ts` (fresh-per-request role resolution), and
   `lib/auth/require-capability.ts` (the route-level helper wrapping both). Built
   `lib/services/workspace-membership.ts` and two new auth routes for listing memberships
   and switching workspaces. Built `lib/services/admin-users.ts` and its two new routes,
   then retrofitted capability checks onto all 22 pre-existing internal-facing routes
   (vendor/template/assessment/risk/cap/offboarding), replacing their bare
   `getCurrentSession()` calls. Built `lib/services/sharing.ts` (first-ever use of the
   `SharedDocument` model) and its five new routes, and `lib/services/executive-rollup.ts`
   with its one new route. Extended `scripts/seed.ts` with a second workspace and three
   role-varied fixture users. Built four new UI surfaces (workspace switcher, admin users
   page, sharing page, roll-up dashboard) and wired them into the internal layout's
   navigation. Fixed three small TypeScript/Mongoose/UI-library mismatches surfaced by
   `npm run verify` (see the feature trace §7). Wrote unit/integration tests for every new
   auth module and service (29 new tests). Ran the full gate suite
   (`format`/`lint`/`typecheck`/`test`/`build`, all clean, 190 tests total) and verified
   every named exit criterion by real HTTP request against a running dev server, using
   disposable fixture accounts and a disposable smoke-test vendor/document (created,
   exercised, deleted afterward).
2. **What's left:** Nothing from `PLAN.md`'s original 0–11 sequence — this was the last
   phase. See the Follow-ups above and in the feature trace §11 for post-MVP items.
3. **Watch out for:**
   - **A session's role is never cached in the signed cookie — it's re-resolved from the
     database on every `requireCurrentMembership*()` call.** Do not "optimize" this by
     adding a `role` field to the cookie payload later without re-reading
     `DECISIONS.md` 024's rationale first; that would silently reintroduce the exact
     staleness gap this design was chosen to avoid.
   - **`SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD_HASH` still work as a login** — they just
     aren't the only account that can anymore. Don't assume removing them from `.env.local`
     is safe without checking `scripts/seed.ts` doesn't still reference them (it does, as
     the bootstrap admin for the default workspace).
   - **`SharedDocument` reads are the one query in the codebase that filters on
     `shared_with` instead of the caller's own `workspace_id`** — a deliberate, narrow,
     documented exception (`lib/services/sharing.ts`'s own comment,
     `CONSTRAINTS.md` #8). Any new cross-tenant read path added later must be its own
     explicit decision, not modeled after this one by default.
   - **The executive roll-up takes a bare `userId`, not a `TenantContext`** — this is
     deliberate (`DECISIONS.md` 024), not an inconsistency with every other service's
     signature. Don't "fix" it to take a `TenantContext` — that would collapse the
     per-membership authorization loop back into a single top-level check.
   - **No browser-driven (Playwright-style) test exists for any of the four new UI
     surfaces** — verified by real HTTP requests against the API routes they call and by
     reading the components. See the phase-11 feature trace §9/§11.
4. **Files touched:** `lib/auth/login.ts`, `lib/auth/rbac.ts` (new, + `__tests__/`),
   `lib/auth/current-membership.ts` (new, + `__tests__/`),
   `lib/auth/require-capability.ts` (new), `lib/auth/__tests__/login.test.ts` (extended),
   `lib/services/workspace-membership.ts` (new, + `__tests__/`),
   `lib/services/admin-users.ts` (new, + `__tests__/`),
   `lib/services/sharing.ts` (new, + `__tests__/`),
   `lib/services/executive-rollup.ts` (new, + `__tests__/`),
   `app/api/auth/memberships/route.ts` (new), `app/api/auth/switch-workspace/route.ts`
   (new), `app/api/admin/users/route.ts` (new), `app/api/admin/users/[id]/route.ts` (new),
   `app/api/sharing/{route,granted/route,available/route,[id]/route,[id]/download/route}.ts`
   (all new), `app/api/rollup/route.ts` (new), `components/workspace-switcher.tsx` (new),
   `app/(internal)/admin/users/page.tsx` (new),
   `components/admin/admin-users-client.tsx` (new), `app/(internal)/sharing/page.tsx`
   (new), `components/sharing/sharing-client.tsx` (new), `app/(internal)/rollup/page.tsx`
   (new), `app/(internal)/layout.tsx`, `scripts/seed.ts`, 22 existing route files under
   `app/api/{templates,risks,vendors,assessments,offboarding}/**` (RBAC checks applied),
   `docs/DECISIONS.md` (024), `docs/FLOW.md` (F6), `docs/TEST-CHECKLIST.md`,
   `docs/ROLLBACK.md`,
   `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md` (new). No
   source specs modified. No new dependencies.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-17 — Phase 10: offboarding, destruction certificates, archiving

1. **What we did:** Read the session-start docs, drafted a plan for Phase 10, got explicit
   approval before writing code (`CONSTRAINTS.md` #14), and filled `ROLLBACK.md`'s Active
   plan. Built `OffboardingRepository` (new) with every write method structurally scoped to
   exclude an already-`archived` document (mirrors `TemplateRepository`'s
   publish-immutability mechanism) and `AssessmentRepository.archive()`. Added
   `assertAssessmentNotArchived()` to `AssessmentReviewService`'s four risk/CAP-task write
   methods — a gap that couldn't have existed before this phase, since nothing could archive
   an assessment yet. Built `lib/services/offboarding.ts` end to end: `initiateOffboarding()`
   (atomic checklist creation + engagement/vendor status transition), checklist-item
   updates, certificate upload/download/verify (reusing the Phase 4 storage module and Phase
   7 upload constraints), a `refreshReadiness()` helper advancing
   `initiated → in_progress → verified` forward-only as the checklist and certificates
   complete, and `completeOffboarding()` — the terminal atomic transaction archiving the
   offboarding record and every one of the engagement's assessments, closing the
   engagement, and terminating the vendor. Added five new API routes and an offboarding
   panel on the vendor detail page. Wrote a new integration test file for the offboarding
   service and extended `assessment-review.test.ts` with an archived-assessment-immutability
   describe block. Ran the full gate suite (`format`/`lint`/`typecheck`/`test`/`build`, all
   clean, 159 tests total) and verified the exit criterion by real HTTP request against a
   running dev server using a disposable smoke-test vendor/engagement/assessment/offboarding
   record (created, exercised, deleted afterward; `SUPER_ADMIN_PASSWORD_HASH` temporarily
   swapped for a known test hash via the same pattern every prior phase used, then
   restored).
2. **What's left:** Phase 11 next — multi-workspace RBAC, sharing, executive roll-up.
3. **Watch out for:**
   - **Every `OffboardingRepository` write method filters out `status: 'archived'` in its
     own query, not via a service-layer check alone.** A future method added to this class
     that forgets the filter would silently be able to mutate an archived record — always
     copy the `NOT_ARCHIVED` filter pattern already in the file, don't rely on the caller to
     check first.
   - **`AssessmentReviewService`'s new `assertAssessmentNotArchived()` guard only covers
     `raiseRisk`/`updateRisk`/`createCapTask`/`updateCapTask`.** Any new write method added
     to this service that touches a risk or CAP task belonging to an assessment must call
     it too, or archived-assessment immutability quietly has a hole.
   - **`completeOffboarding()` is keyed on `offboardingId`, not `engagementId`** — a
     deliberate fix mid-implementation (see the phase-10 feature trace §7); don't assume the
     two are interchangeable across this service's functions.
   - **The offboarding checklist's owner field is a raw `User._id` text input** — same
     reasoning and deferral as Phase 9's CAP dialog (`DECISIONS.md` 013).
   - **No browser-driven (Playwright-style) test exists for the offboarding panel** —
     verified by real HTTP requests against the API routes it calls and by reading the
     component. See the phase-10 feature trace §9/§11.
4. **Files touched:** `lib/repositories/offboarding-repository.ts` (new),
   `lib/repositories/assessment-repository.ts` (adds `archive()`),
   `lib/services/offboarding.ts` (new, + `__tests__/`),
   `lib/services/assessment-review.ts` (adds `assertAssessmentNotArchived()` guard),
   `app/api/vendors/[id]/engagements/[engagementId]/offboarding/route.ts` (new),
   `app/api/offboarding/[id]/checklist/[itemId]/route.ts` (new),
   `app/api/offboarding/[id]/certificate/[kind]/route.ts` (new),
   `app/api/offboarding/[id]/certificate/[kind]/verify/route.ts` (new),
   `app/api/offboarding/[id]/complete/route.ts` (new),
   `components/offboarding/offboarding-panel.tsx` (new),
   `app/(internal)/vendors/[id]/page.tsx`,
   `lib/services/__tests__/assessment-review.test.ts` (extended), `docs/DECISIONS.md` (023),
   `docs/FLOW.md` (F5), `docs/ARCHITECTURE.md` (top status banner, module map, §7),
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-10-offboarding-destruction-certificates-archiving.md` (new). No
   source specs modified. No new dependencies.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-16 — Phase 9: CAP tracking and mitigation guidance (+ Phase 8 test-debt closure)

1. **What we did:** Read the session-start docs, drafted a plan for Phase 9 (test-debt
   prerequisite first, then CAP CRUD + request-driven overdue escalation), got explicit
   approval before writing code (`CONSTRAINTS.md` #14), and filled `ROLLBACK.md`'s Active
   plan. Closed the Phase 8 test-debt gap: unit-tested `calculateResidualScore()` (every
   severity/impact combination, the inherent-score blend, the compensating-control discount
   cap, the score floor, `NaN` handling) and integration-tested `AssessmentReviewService`
   against a real MongoDB (the score-authority invariant across multiple risk raises, an
   update recomputing both scores, tenant isolation on `listWorkspaceRisks()`/
   `getAssessmentReviewData()`). Then built Phase 9 itself: one additive schema field
   (`cap_tasks[].escalated_at`) to make "escalate once" possible with no job runner
   (`PLAN.md` §1's own stated default), `RiskRepository` methods for `$push`/arrayFilters
   updates on the embedded `cap_tasks` array, `AssessmentReviewService.createCapTask()`/
   `updateCapTask()`/`detectAndEscalateOverdueCaps()`, three new API routes, and UI
   additions to the Risk Register page (overdue queue, expandable CAP task list, add-CAP
   dialog). Verified the exit criterion by real HTTP request against a running dev server
   using a disposable smoke-test vendor/template/assessment/risk (created, exercised,
   deleted afterward; `SUPER_ADMIN_PASSWORD_HASH` temporarily swapped for a known test hash
   via the same pattern every prior phase used, then restored).
2. **What's left:** Phase 10 next — offboarding, destruction certificates, archiving.
3. **Watch out for:**
   - **`createCapTask()` ignores the caller's `owner_ref` when `owner_type: 'vendor'`** —
     it always forces the risk's own `vendor_id` (`DECISIONS.md` 022). Don't "fix" this
     later assuming it's a bug; there is no legitimate cross-vendor CAP ownership case.
   - **The overdue-escalation idempotency guard is a field on the document
     (`cap_tasks[].escalated_at`), not a job-run ledger.** Any future background-job-runner
     migration (still an open, deliberately deferred question) should call
     `detectAndEscalateOverdueCaps()` directly rather than reimplementing the check — the
     method has no assumption baked in about how it's triggered.
   - **The CAP dialog's internal-owner input is a raw `User._id` text field** — there is no
     picker because there is currently only one authenticatable internal user
     (`DECISIONS.md` 013). Don't mistake the missing picker for an oversight.
   - **No browser-driven (Playwright-style) test exists for the CAP UI** — verified by real
     HTTP requests against the API routes it calls and by reading the component, not by
     driving the actual React tree. See the phase-9 feature trace §9/§11.
4. **Files touched:** `lib/scoring/__tests__/residual-risk.test.ts` (new),
   `lib/services/__tests__/assessment-review.test.ts` (new), `lib/db/models/risk.ts`
   (adds `cap_tasks[].escalated_at`), `lib/repositories/risk-repository.ts` (adds
   `pushCapTask`/`updateCapTaskFields`/`findRisksWithPastDueCapTasks`),
   `lib/services/assessment-review.ts` (adds `createCapTask`/`updateCapTask`/
   `detectAndEscalateOverdueCaps`; extends `listWorkspaceRisks()`'s output with resolved
   `cap_tasks`), `app/api/risks/[id]/cap-tasks/route.ts` (new),
   `app/api/risks/[id]/cap-tasks/[taskId]/route.ts` (new),
   `app/api/risks/cap-tasks/overdue/route.ts` (new),
   `components/risks/add-cap-task-dialog.tsx` (new),
   `components/risks/risk-register-client.tsx`, `docs/DECISIONS.md` (022), `docs/FLOW.md`
   (F4), `docs/ARCHITECTURE.md` (top status banner, §4, §7), `docs/TEST-CHECKLIST.md`,
   `docs/ROLLBACK.md`,
   `docs/features/phase-9-cap-tracking-and-mitigation-guidance.md` (new). No source specs
   modified. No new dependencies.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-16 — Dev environment setup; Phase 8 verified and typecheck-fixed

1. **What we did:** Set up the local dev environment from a fresh session start: found
   MongoDB running standalone rather than the required single-node replica set, fixed it
   (`/opt/homebrew/etc/mongod.conf` + `rs.initiate()`), ran `db:indexes`/`db:seed`, started
   the dev server. Then found Phase 8 (review, risk register, residual scoring) already
   coded from a prior session (per `ROLLBACK.md`'s Active plan, dated 2026-08-14,
   attributed to Gemini 3.6 Flash) but uncommitted, never typechecked, and with no feature
   trace — `HANDOVER.md` still said "not started." Ran `npm run typecheck` and found 8
   errors across 6 files: `throw new UnauthorizedError()` missing its required `message`
   argument at 5 route call sites, and 3 `recordAuditEvent()` calls passing
   `this.ctx.workspaceId` (typed `string | Types.ObjectId`) where `Types.ObjectId` was
   required. Fixed both (see `DECISIONS.md` 021 for the reasoning), ran
   `format`/`lint`/`typecheck`/`test`/`build` clean, then verified the actual Phase 8 exit
   criterion by real HTTP request against the running dev server using a disposable
   smoke-test vendor/template/assessment: raised a risk, hand-verified the residual score
   formula, confirmed the assessment's `overall_score` always equals the sum of its risks'
   scores in the same write, confirmed the register lists it, confirmed a compensating
   control recomputes both scores, confirmed review completion, confirmed the actual pages
   render (not just the APIs), and confirmed a vendor portal session cannot reach the new
   internal routes. Cleaned up the smoke-test data and restored the real
   `SUPER_ADMIN_PASSWORD_HASH` afterward (same pattern as every prior phase's smoke test).
2. **What's left:** Phase 9 next — CAP tracking and mitigation guidance. First: add
   automated test coverage for Phase 8's scoring function and service (see above) — this
   phase's verification was real-HTTP-only, the first phase where that's true.
3. **Watch out for:**
   - **`lib/scoring/residual-risk.ts` has no unit test.** It's a pure function
     (`calculateResidualScore()`), cheap to test, and every other scoring engine in this
     codebase (Inherent Risk, at least) has one. Don't assume coverage exists just because
     the formula was hand-verified once by HTTP request this session.
   - **`AssessmentReviewService` has no integration test** — `raiseRisk()`, `updateRisk()`,
     `completeReview()`, `listWorkspaceRisks()` are all untested against a real MongoDB.
     Phase 9's CAP tracking will read `Risk.cap_tasks` (currently always `[]`) and should
     not assume the scoring path underneath it is regression-proof.
   - **`enterprise_risk_categories` is still a seeded placeholder list**
     (`DEFAULT_ENTERPRISE_RISK_CATEGORIES` in `lib/services/assessment-review.ts`), flagged
     `Provisional` in the UI. `ARCHITECTURE.md` §7's taxonomy-ownership question is still
     open — Phase 8 didn't resolve it, just shipped the documented default.
   - **The two bugs fixed this session were mechanical, not design flaws** — see
     `DECISIONS.md` 021 for exactly what pattern every other service uses for
     `recordAuditEvent()`'s `workspace_id` (a document's own field, not the raw
     `TenantContext` value) so a future service doesn't reintroduce the same mismatch.
4. **Files touched:** Edits only —
   `app/api/assessments/[id]/{complete-review,review,risks}/route.ts`,
   `app/api/risks/{route,[id]/route}.ts` (added `UnauthorizedError` message arg),
   `lib/services/assessment-review.ts` (`toObjectId()` coercion for audit events),
   `/opt/homebrew/etc/mongod.conf` (outside repo — replica-set config),
   `docs/DECISIONS.md` (021), `docs/ARCHITECTURE.md` (top status banner, §4, §5, §7),
   `docs/FLOW.md` (F4), `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-8-review-risk-register-residual-scoring.md` (new). No source specs
   modified. No new dependencies.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 7: questionnaire answering, evidence upload, validation

1. **What we did:** Built Phase 7 of `docs/PLAN.md` end to end — the second half of
   `FLOW.md` F3, which is now fully built start to finish. Filled `ROLLBACK.md`'s Active
   plan first. Extracted `lib/uploads/constraints.ts` from Phase 4's vendor-documents
   service once evidence upload became the second real caller needing the identical
   MIME/size rule. Added `list()`/`delete()` to the storage driver interface (both
   drivers, S3 mock-tested) for the reconciliation script. Built `ResponseRepository`,
   `lib/services/portal-assessment.ts` (answer, evidence upload/retrieve, submission
   validation), five API routes, the answer form and evidence-upload components (reusing
   Phase 5's `question-renderer.tsx` — added a `disabled` prop to it for the
   post-submission read-only state), the per-assessment portal page, and
   `scripts/sweep-orphaned-evidence.ts` (dry-run by default). Verified the full SPOC round
   trip by real HTTP request: live conditional branching (answering HOST-01 reveals/hides
   HOST-02), a blocked submission naming the specific missing control and missing evidence,
   a successful submission after satisfying both, byte-identical evidence retrieval, the
   post-submission edit lock (403 on further writes or a second submission), cross-vendor
   tampering refused (404, indistinguishable from "doesn't exist"), and the sweep script
   correctly reporting zero orphans, then detecting and removing a deliberately-created
   one. Cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH`
   afterward.
2. **What's left:** Phase 8 next — review, risk register, residual scoring.
3. **Watch out for:**
   - **`Response.is_suppressed` is never written — always `false` in the database.**
     `submitAssessment()` recomputes visibility fresh instead of reading it
     (`DECISIONS.md` 020). Any future code that needs to know whether a question was
     suppressed must call `computeVisibility()` itself; do not query this field expecting
     a real answer.
   - **Writes to an assessment are refused once it leaves `sent`/`in_progress`**
     (`getEditableVendorAssessment()`, enforced server-side, not just a disabled UI
     input) — this is deliberate (`DECISIONS.md` 020), the mechanism Phase 8's reviewer
     surface depends on to trust that submitted responses are exactly what the vendor said.
   - **A `type: 'file'` question's `response_value` becomes the uploaded filename** once
     evidence attaches, purely so the generic `required` check doesn't need a type-specific
     branch. Don't be surprised to see a filename where you might expect `null`.
   - **`scripts/sweep-orphaned-evidence.ts` checks both `Response.evidence` and
     `Vendor.documents`** — any future feature that writes into the same storage backend
     must be added to its referenced-keys set, or it will start reporting false orphans.
4. **Files touched:** `lib/uploads/constraints.ts`, `lib/repositories/
response-repository.ts`, `lib/services/portal-assessment.ts` (+ `__tests__/`),
   `app/api/portal/assessments/[id]/responses/[controlId]/route.ts`,
   `app/api/portal/assessments/[id]/responses/[controlId]/evidence/route.ts`,
   `app/api/portal/assessments/[id]/responses/[controlId]/evidence/[evidenceId]/route.ts`,
   `app/api/portal/assessments/[id]/submit/route.ts`,
   `app/(portal)/portal/assessments/[id]/page.tsx`, `components/portal/
{assessment-answer-form,evidence-upload}.tsx`, `scripts/sweep-orphaned-evidence.ts`.
   Edits: `lib/storage/{types,local-fs,s3,index}.ts` (+ `__tests__/`, adds `list()`/
   `delete()`), `lib/services/vendor-documents.ts` (uses the extracted constraints
   module), `lib/db/models/response.ts` (evidence subdoc `_id: true`; `is_suppressed`
   comment corrected), `lib/repositories/base.ts` (n/a this phase — already extended in
   Phase 6), `lib/questionnaire/evaluator.ts` (exports `isAnswered`, adds
   `findQuestion()`), `components/questionnaire/question-renderer.tsx` (adds `disabled`),
   `app/(portal)/portal/page.tsx` (links to the new per-assessment page),
   `package.json` (`sweep:evidence` script), `docs/DECISIONS.md` (020),
   `docs/ARCHITECTURE.md` (§2, §4, §5), `docs/FLOW.md` (F3), `docs/TEST-CHECKLIST.md`,
   `docs/ROLLBACK.md`,
   `docs/features/phase-7-questionnaire-answering-evidence-upload-validation.md` (new). No
   source specs modified.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 6: assessment assignment, OTP portal auth

1. **What we did:** Built Phase 6 of `docs/PLAN.md` end to end — the highest-risk surface
   in the system, called out by name in the plan. Filled `ROLLBACK.md`'s Active plan first
   (auth phase, `CONSTRAINTS.md` #2). No decision needed a stop-and-ask; every open
   number (OTP TTL/attempts/rate limits, portal session TTL, assessment status on
   assignment) is a stated assumption, recorded in `DECISIONS.md` 019. Built crypto/rate-
   limit primitives first and unit-tested them in isolation
   (`lib/auth/otp.ts`/`rate-limit.ts`), then a portal session module deliberately kept
   structurally separate from the internal one (`lib/auth/portal-session.ts` — own cookie,
   own signing secret, no shared signer), then the OTP data-access module and service
   (`lib/auth/otp-challenge.ts`, `lib/services/portal-auth.ts`), then `proxy.ts`'s second
   independent fail-closed branch for `/portal`/`/api/portal`, then assessment assignment
   (`lib/services/assessment-assignment.ts` — deep-clones `template_snapshot`, only from a
   `published` template, atomically moves the engagement to `in_assessment`), then the
   routes and pages. Verified every named Gate 4 attack class by real HTTP request:
   enumeration (diffed two response bodies, byte-identical), wrong code, replay,
   attempt-limit lockout (tested with the _actual correct_ code after exhausting
   attempts), per-email and per-IP rate limiting (429), and — the one that actually proves
   scope isolation rather than just asserting it — a second real vendor with its own
   assessment, confirming the first vendor's session still lists only its own. Cleaned up
   smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH` afterward.
2. **What's left:** Phase 7 next — questionnaire answering, evidence upload, validation.
3. **Watch out for:**
   - **The in-memory rate limiter (`lib/auth/rate-limit.ts`) is per-process, not shared.**
     It resets on restart and doesn't coordinate across instances — fine for the MVP's
     no-HA target, a real problem the moment there's more than one server process
     (`DECISIONS.md` 019).
   - **The enumeration-timing mitigation is a dummy DB read, not a constant-time
     guarantee.** Don't let a future security review assume more rigor than exists here.
   - **`next build` runs with `NODE_ENV=production`, which now requires
     `OTP_HMAC_SECRET`** the same way it already required `SESSION_SECRET` — a fresh
     checkout needs both dev values in `.env.local` or the build fails, not just `npm run
dev`.
   - **`lib/repositories/base.ts`'s `updateOne()` now accepts an optional `session`**,
     mirroring `create()` — used by `assignAssessment()` to update the engagement inside
     the same transaction that creates the assessment. Any future multi-write transaction
     across repositories should use this rather than a bare `updateOne()` call.
   - The portal session and the internal session share no code — this was deliberate
     (`DECISIONS.md` 019), not an oversight to "clean up" later by merging them.
4. **Files touched:** `lib/mail/{types,console,index}.ts`, `lib/auth/{otp,portal-session,
portal-session-cookie,current-portal-session,rate-limit,otp-challenge}.ts` (+
   `__tests__/`), `lib/repositories/assessment-repository.ts`, `lib/services/
{assessment-assignment,portal-auth}.ts` (+ `__tests__/`), `lib/http/request-ip.ts`,
   `app/api/vendors/[id]/assessments/route.ts`, `app/api/portal/auth/otp/{request,
verify}/route.ts`, `app/api/portal/auth/logout/route.ts`, `app/(portal)/portal/
{layout,page,login/page}.tsx`, `components/portal-otp-login-form.tsx`,
   `components/portal-logout-button.tsx`, `components/assessments/
assign-assessment-form.tsx`. Edits: `proxy.ts` (second fail-closed branch), `lib/env.ts`
   (`OTP_HMAC_SECRET`, `MAIL_PROVIDER`), `lib/errors/index.ts`
   (`UnauthorizedError`, `RateLimitedError`), `lib/repositories/base.ts`
   (`updateOne()` gains `session`), `app/(internal)/vendors/[id]/page.tsx` (Assessments
   section), `.env.local` (dev `OTP_HMAC_SECRET`), `docs/DECISIONS.md` (019),
   `docs/ARCHITECTURE.md` (§2, §4, §5, §6, §7), `docs/FLOW.md` (F2, F3),
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-6-assessment-assignment-and-otp-portal-auth.md` (new). No source
   specs modified.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 5: questionnaire template builder and versioning

1. **What we did:** Built Phase 5 of `docs/PLAN.md` end to end. Surfaced the one genuinely
   open decision — JSON schema editor vs. form-based visual builder — via
   `AskUserQuestion`; the project owner chose the form builder. Filled `ROLLBACK.md`'s
   Active plan before touching anything. Built the shared conditional-logic module first
   (`lib/questionnaire/schema.ts` — Zod shape; `evaluator.ts` — pure `computeVisibility()`;
   `validate-schema.ts` — control_id uniqueness and forward-reference rejection), unit-
   tested against the DATA-MODEL.md §3 HOST-01/HOST-02 example verbatim, before writing
   anything that depends on it. Then `TemplateRepository`/`lib/services/
questionnaire-templates.ts` (draft → published → archived, publish freezing enforced by
   the repository's own scoped filter, not just a service-layer check), five API routes,
   the shared renderer (`components/questionnaire/question-renderer.tsx` +
   `questionnaire-preview.tsx` — the same component the future portal will reuse), and the
   form-based builder (`components/templates/template-builder-form.tsx`) with an
   interactive preview tab. Verified the whole lifecycle by real HTTP request against a
   running dev server: create → edit draft → publish → edit-attempt refused (403,
   document unchanged) → new version (schema copied, version bumped) →
   second-new-version-while-a-draft-exists refused (422) → archive → archive-again refused
   (422) → invalid (forward-referencing) schema refused at creation, not only at publish.
   Cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH` afterward.
2. **What's left:** Phase 6 next — assessment assignment and OTP portal auth. Its own
   rollback plan is required (auth phase, `CONSTRAINTS.md` #2).
3. **Watch out for:**
   - **`show_if` accepts exactly one of `all`/`any`, never both** — a deliberate Zod-level
     restriction (`DECISIONS.md` 018), not a bug, if a future schema import ever has both.
   - **Structural validation (no forward references, no duplicate `control_id`s) runs on
     every draft save, not only at publish** — stricter than `DATA-MODEL.md` §3's literal
     text, which only requires it be enforced "at publish time." Documented in
     `DECISIONS.md` 018 so it isn't mistaken for a spec requirement later.
   - **Archived templates are immutable too**, same mechanism as published
     (`TemplateRepository.updateDraft()`'s filter only ever matches `status: 'draft'`) —
     `CONSTRAINTS.md` #11 only names "published" by word, this extends it.
   - **No global seed-template library exists** — every workspace starts with zero
     templates. `PLAN.md`'s own default answer for the workspace-scoped-vs-global question
     included one; it wasn't built this phase (`ARCHITECTURE.md` §7).
   - `in`/`not_in` against a multi_select (array) answer means "any overlap with the
     condition's value list," not exact-array equality — an extension beyond
     DATA-MODEL.md §3's single-answer example, documented in `lib/questionnaire/
evaluator.ts` and `DECISIONS.md` 018.
4. **Files touched:** `lib/questionnaire/{schema,evaluator,validate-schema}.ts` (+
   `__tests__/`), `lib/repositories/template-repository.ts`, `lib/services/
questionnaire-templates.ts` (+ `__tests__/`), `app/api/templates/route.ts`,
   `app/api/templates/[id]/route.ts`, `app/api/templates/[id]/{publish,archive,
new-version}/route.ts`, `app/(internal)/templates/{page,new/page,[id]/page}.tsx`,
   `components/questionnaire/{question-renderer,questionnaire-preview}.tsx`,
   `components/templates/{template-builder-form,template-actions,builder-state}.ts(x)`,
   `docs/DECISIONS.md` (018), `docs/ARCHITECTURE.md` (§2, §4, §5, §7), `docs/FLOW.md` (F3),
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-5-template-builder-and-versioning.md` (new). No existing source
   files edited — `QuestionnaireTemplate` already existed from Phase 1 with no changes
   needed. No source specs modified.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 4: vendor SPOC management, storage module

1. **What we did:** Built Phase 4 of `docs/PLAN.md` end to end. Surfaced two decisions not
   settled by the existing docs via `AskUserQuestion` before writing code: approved adding
   `@aws-sdk/client-s3` as a new dependency (`CONSTRAINTS.md` #1) for the still-unconfigured
   S3 driver, and chose an embedded `documents` array on `Vendor` over a new top-level
   collection for uploaded-file metadata (`DECISIONS.md` 017). Filled `ROLLBACK.md`'s Active
   plan before touching anything. Built `lib/storage` (one interface, `local-fs`/`S3`
   drivers, env-selected — `CONSTRAINTS.md` #10), `lib/services/vendor-spoc.ts` and
   `vendor-documents.ts`, three new API routes (`PATCH .../spoc`, `POST`/`GET
.../documents[/documentId]`), and the first vendor detail page. The download route is
   the "authorised proxy" `CONSTRAINTS.md` #10 requires — it re-derives authorization from
   the requesting session's workspace and the target vendor's own document list, never a
   raw key. Verified the whole thing by real HTTP request against a running dev server
   (SPOC edit and re-render, upload, byte-identical download, 401 unauthenticated, 404 on a
   well-formed-but-wrong document id, 422 on a disallowed MIME type), plus unit tests for
   both storage drivers (S3 against a mocked client) and integration tests for the document
   service's validation and authorization paths.
2. **What's left:** Phase 5 next — template builder and versioning.
3. **Watch out for:**
   - **`Vendor.documents` is a Phase-4 demo/harness shape, not necessarily what Phase 7's
     real evidence-upload feature should use.** `DECISIONS.md` 017's Consequences section
     says so explicitly — check it before assuming this array is the final answer.
   - **`Model.updateOne({$push: ...})` doesn't return the written subdocument.** Generate
     the subdocument's `_id` explicitly in the service (`new Types.ObjectId()`) before the
     push if the caller needs it back — discovered when the first draft had no way to
     return a usable document id to the upload route.
   - `lib/storage/index.ts` throws only when the S3 driver is actually constructed (i.e. on
     first use), not at `lib/env.ts` boot — acceptable today since `STORAGE_DRIVER` defaults
     to `local-fs` and nothing sets it to `s3` yet, but worth tightening before Phase 12.
   - The smoke test used the same temporary-password-then-restore pattern as Phase 3
     (`npm run hash-password`, test, `npm run db:seed` to restore) — the real
     `SUPER_ADMIN_PASSWORD_HASH` was restored and re-seeded afterward; don't assume the
     value currently in `.env.local` is the temporary one.
4. **Files touched:** `lib/storage/{types,local-fs,s3,index}.ts` (+ `__tests__/`),
   `lib/services/vendor-spoc.ts`, `lib/services/vendor-documents.ts` (+ `__tests__/`),
   `app/api/vendors/[id]/spoc/route.ts`, `app/api/vendors/[id]/documents/route.ts`,
   `app/api/vendors/[id]/documents/[documentId]/route.ts`,
   `app/(internal)/vendors/[id]/page.tsx`, `components/spoc-edit-form.tsx`,
   `components/vendor-document-upload.tsx`. Edits: `lib/db/models/vendor.ts` (adds
   `documents`), `lib/repositories/vendor-repository.ts` (adds `updateSpoc`/`addDocument`),
   `lib/env.ts` (adds optional `AWS_S3_BUCKET`/`AWS_REGION`),
   `app/(internal)/vendors/page.tsx` (links to the new detail page), `.gitignore`
   (`.storage-local`), `.env.example`, `package.json`/`package-lock.json` (new dependency
   `@aws-sdk/client-s3`), `docs/DECISIONS.md` (017), `docs/ARCHITECTURE.md` (§2, §4),
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-4-vendor-spoc-and-storage.md` (new). No source specs modified.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 3: vendor intake, Inherent Risk Engine, tiering

1. **What we did:** Built Phase 3 of `docs/PLAN.md` end to end. Raised the two carried-
   forward gaps first: converted local mongod to a single-node replica set `rs0` (approved,
   verified with a real `withTransaction()` call — `DECISIONS.md` 014) and re-confirmed the
   git-baseline gap stays deferred (project owner's explicit choice). Filled `ROLLBACK.md`'s
   Active plan before touching anything. Built the Inherent Risk Engine and Tiering & Triage
   as pure functions (`lib/scoring/inherent-risk.ts`) returning a discriminated
   tiered/scoring_failed result — no shared shape a caller could mistake for a default tier.
   Added `EngagementRepository`/`WorkspaceRepository` and a `session` param on
   `TenantRepository.create()` so the orchestrating service
   (`lib/services/vendor-intake.ts`) can write Vendor + Engagement atomically and record the
   first-ever `audit_events` entry in the same transaction. Added the first HTTP route error
   wrapper (`lib/http/with-route-errors.ts`), the intake API route, the intake form, and the
   vendor inventory page. Fixed the seed script's `risk_weights` using `$set` rather than
   `$setOnInsert` — the exact `$setOnInsert`-only pitfall already documented from Phase 2's
   password-hash bug. Verified the whole flow by real HTTP request against a running dev
   server (login, submit two intakes that tiered as 1 and 3, confirmed both in the
   inventory), plus unit tests at every tier boundary and the unscoreable case, plus an
   integration test proving the transaction against a real database.
2. **What's left:** Phase 4 next — Vendor SPOC management and the storage abstraction.
3. **Watch out for:**
   - **`workspace.settings.risk_weights`'s `InferSchemaType` collapse.** Same category of
     bug as the Phase 1 `timestamps` gotcha, different field — a plain nested object under
     `workspace.settings` infers to the schema-definition shape, not the runtime value type.
     Worked around with an explicit cast in `lib/services/vendor-intake.ts`; don't be
     surprised if it recurs on another nested plain-object field later.
   - **Mongoose's `Model.create()` array+session overload doesn't resolve against a generic
     `T`** — `lib/repositories/base.ts` has a narrow, commented cast for this, backed by the
     integration test that actually exercises the path.
   - **The dev database's `SUPER_ADMIN_PASSWORD_HASH` password is not `admin_123`** (that
     was tried and failed with `invalid_credentials`) — a temporary password was set for
     this session's smoke test and the original hash was restored afterward via
     `npm run db:seed`. If you need to log in locally and don't know the password, generate
     a new hash (`npm run hash-password`) rather than guessing.
   - Seed data now includes real `risk_weights` (Phase 1's seed had `tier_thresholds` but an
     empty weights map, which would fail every intake by design).
4. **Files touched:** `lib/scoring/inherent-risk.ts` (+ `__tests__/`),
   `lib/repositories/engagement-repository.ts`, `lib/repositories/workspace-repository.ts`,
   `lib/repositories/base.ts`, `lib/audit/record-event.ts`, `lib/http/with-route-errors.ts`,
   `lib/services/vendor-intake.ts` (+ `__tests__/`), `app/api/vendors/route.ts`,
   `app/(internal)/vendors/page.tsx`, `app/(internal)/vendors/new/page.tsx`,
   `components/vendor-intake-form.tsx`, `scripts/seed.ts`, `lib/env.ts`, `.env.example`,
   `docs/FLOW.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (014, 015, 016),
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`,
   `docs/features/phase-3-vendor-intake-and-tiering.md` (new). Outside the repo:
   `/opt/homebrew/etc/mongod.conf` (replica-set config). No source specs modified.
5. **Model:** Claude Sonnet 5 (`claude-sonnet-5`).

### 2026-08-14 — Phase 2: internal authentication

1. **What we did:** Built Phase 2 of `docs/PLAN.md` end to end. Filled `ROLLBACK.md`'s
   Active plan before touching anything (auth phase, `CONSTRAINTS.md` #2). Got approval for
   `argon2` and confirmed its native binding actually works on this machine before building
   on it. Built a stateless HMAC-signed session (Web Crypto, not `node:crypto` — portable
   regardless of runtime), a login function gated to `SUPER_ADMIN_EMAIL` specifically
   (`DECISIONS.md` 013, not "any active User"), and route protection that fails closed by
   default with an explicit public-path allowlist (`DECISIONS.md` 012). Discovered mid-session
   that Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts` and migrated by hand
   after the official codemod refused to run (it requires a clean git state, which this repo
   doesn't have). Verified the whole flow — unauthenticated redirect, protected-API 401,
   wrong password, wrong email, successful login, cookie attributes, tampered-cookie
   rejection, logout, re-protection — by real HTTP request against a running dev server,
   then added automated tests for the session module and login function.
2. **What's left:** Phase 3 next. Two carried-forward items to resolve or explicitly
   re-defer first: the replica-set conversion (now flagged twice) and the git baseline (now
   three phases deep).
3. **Watch out for:**
   - **The `SUPER_ADMIN_EMAIL` gate in `lib/auth/login.ts` is the one thing to remove** when
     real multi-user login is eventually built — named explicitly in `DECISIONS.md` 013 so
     it isn't rediscovered by trial and error.
   - **No server-side session revocation exists.** Rotating `SESSION_SECRET` invalidates
     every session at once; there's no way to revoke just one. Fine for one static account,
     revisit if multi-user auth lands.
   - **`tsx` does not auto-load `.env.local`** the way `next dev` does — that's Next-specific
     behavior. The `db:*` and `hash-password` npm scripts now pass
     `--env-file-if-exists=.env.local` explicitly (Node's own flag, no new dependency). Any
     new standalone script added later needs the same flag or it will silently run against
     defaults.
   - **A real bug caught by testing the actual flow, not just running the script:** the
     first version of `scripts/seed.ts` used `$setOnInsert` for `password_hash`, which meant
     re-seeding after generating a real hash would never update an already-existing
     placeholder-hash user. Fixed — `password_hash` is now unconditionally `$set` on every
     seed run. Worth remembering as a general pattern: `$setOnInsert`-only upserts silently
     stop updating a field the moment the document exists once.
   - Any future Next.js codemod in this repo will refuse to run until a git baseline exists
     — it checks for a clean git state first.
4. **Files touched:** `lib/auth/*.ts` (session, session-cookie, login, current-session, plus
   `__tests__/`), `proxy.ts` (new, repo root), `app/login/page.tsx`,
   `app/(internal)/layout.tsx`, `app/(internal)/dashboard/page.tsx`,
   `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`,
   `components/logout-button.tsx`, `scripts/hash-password.ts`, `scripts/seed.ts` (fixed),
   `lib/env.ts`, `.env.example`, `package.json`, `docs/ROLLBACK.md`, `docs/DECISIONS.md`
   (012, 013), `docs/TEST-CHECKLIST.md`, `docs/ARCHITECTURE.md` (§2),
   `docs/features/phase-2-internal-authentication.md` (new). No source specs modified.
5. **Model:** Claude Opus 5 (`claude-opus-5[1m]`).

### 2026-08-14 — Phase 1: Mongoose models, tenant guard, index/seed scripts

1. **What we did:** Built Phase 1 of `docs/PLAN.md` end to end. Discovered (rather than
   assumed) the project owner already had a MongoDB Community Homebrew service running
   standalone locally — found by process/port inspection, not by asking first. Confirmed
   with the project owner, after restating why, to defer converting it to a replica set
   until Phase 3 actually needs transactions (`DECISIONS.md` 011). Added `mongoose` and
   `tsx` (both approved). Built all 13 Mongoose models per `DATA-MODEL.md` §2, the
   `TenantContext` type, and a `TenantRepository` base class where every public method
   routes through a `scope()` call injecting `workspace_id` — construction without one
   throws `TenantScopeError`. Built `VendorRepository` as the first concrete example. Built
   an explicit index-sync script and an idempotent seed script (workspace, super-admin
   user, mitigation-guidance library), both run and verified against the real local
   database. Wrote and ran integration tests proving cross-workspace isolation and index
   existence against that same database.
2. **What's left:** Phase 2 (internal auth) is next. Before or alongside it: the
   git-baseline gap, and setting a real `SUPER_ADMIN_PASSWORD_HASH`.
3. **Watch out for:**
   - **Raise the replica-set conversion again before Phase 3.** Deferred deliberately, not
     forgotten — `DECISIONS.md` 011. Phase 3's atomic Vendor+Engagement write will fail
     outright on the current standalone mongod.
   - A real Mongoose/TypeScript gotcha, not obvious from the error it produces: any schema
     options object whose _literal string values_ matter for type inference (specifically,
     `timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }`) needs `as const` in
     this Mongoose version, or `InferSchemaType` silently collapses the entire document type
     to a generic string-indexed signature and every downstream `Model` call produces
     confusing, seemingly-unrelated type errors. Full mechanism and repro documented in
     `docs/features/phase-1-data-layer-and-tenant-guard.md` §7 — worth re-reading if a
     similar "everything collapses to an index signature" error shows up again elsewhere.
   - Mongoose 9.x renamed `FilterQuery` to `QueryFilter` (confirmed by grepping its own type
     declarations) — most existing online examples still say `FilterQuery`.
   - Vitest test files that touch the database use a separate `mv-vra-test` database
     (`vitest.setup.ts`), not the dev `mv-vra` one — confirmed by checking document counts
     in both, not assumed. Keep using that pattern for future DB-touching tests.
   - `npm run db:seed`'s super-admin user currently has a placeholder password hash that
     cannot authenticate — printed as a warning on every seed run until
     `SUPER_ADMIN_PASSWORD_HASH` is set.
4. **Files touched:** `lib/env.ts`, `lib/errors/index.ts`, `lib/db/connect.ts`,
   `lib/db/models/*.ts` (13 files + `index.ts`), `lib/tenant/context.ts`,
   `lib/repositories/base.ts`, `lib/repositories/vendor-repository.ts`,
   `lib/repositories/__tests__/*.ts`, `lib/db/__tests__/indexes.test.ts`,
   `vitest.setup.ts`, `scripts/db-indexes.ts`, `scripts/seed.ts`, `package.json`,
   `docs/TEST-CHECKLIST.md`, `docs/ARCHITECTURE.md` (§5), `docs/DECISIONS.md` (011),
   `docs/features/phase-1-data-layer-and-tenant-guard.md` (new). No source specs modified.
5. **Model:** Claude Opus 5 (`claude-opus-5[1m]`).

### 2026-08-13 — Phase 0: Next.js scaffold, shadcn/ui, tooling

1. **What we did:** Built Phase 0 of `docs/PLAN.md` end to end: scaffolded Next.js 16
   (TS strict, App Router, Tailwind v4) — worked around `create-next-app` rejecting the
   repo's directory name (`VRA`, capitalized) by scaffolding into a temp dir and merging in.
   Ran `shadcn init` and added the Phase 0 component set from `DESIGN-SYSTEM.md` §4 (worked
   around a Node TLS/certificate issue specific to this machine — see decision-adjacent note
   in the feature trace). Replaced shadcn's default palette with the `DESIGN-SYSTEM.md` §3
   tokens (light + dark, risk-severity colors, fixed z-index scale) and switched fonts to
   Inter + JetBrains Mono. Added a Zod-validated env module, ESLint/Prettier/Vitest, and
   `npm run verify`. Replaced `TEST-CHECKLIST.md` Gates 0–3 with real commands and removed
   the not-runnable banner. Verified by running `npm run verify` from a clean state and by
   hitting the running dev server directly, not by reading the code.
2. **What's left:** Everything from Phase 1 onward in `PLAN.md`. Immediately: resolve the
   git-baseline gap (see below) before Phase 1 touches the data layer.
3. **Watch out for:**
   - **No git commit exists anywhere in this repo, including this phase's work.** This was
     an explicit instruction from the project owner (`DECISIONS.md` 010), not an oversight —
     but it means the entire Phase 0 scaffold, plus every doc written this session and last,
     is sitting uncommitted. Raise this before Phase 1, which is exactly the kind of change
     `ROLLBACK.md` says needs a rollback plan.
   - A local machine quirk, not a project dependency: Node's bundled CA store doesn't trust
     whatever TLS intercept this network path uses, so any `npx shadcn ...` fetch fails with
     `self-signed certificate in certificate chain` unless `NODE_EXTRA_CA_CERTS` points at an
     export of the macOS system keychain first. Full detail in
     `docs/features/phase-0-baseline-and-guardrails.md` §7. Nothing in the repo depends on
     this; it's only relevant if a future session needs to run `shadcn add` again.
   - `tsc --noEmit` alone fails on a clean checkout (`Cannot find name 'LayoutProps'`) until
     `next typegen` has run once — `npm run typecheck` does this for you; don't run `tsc`
     directly against a checkout with no `.next` directory.
   - `npm ci` may hit a peer-dependency conflict between `shadcn`'s transient babel tooling
     and `@vitejs/plugin-react`; use `--legacy-peer-deps` if so (noted in
     `TEST-CHECKLIST.md` Gate 0).
   - Dark-mode tokens in `app/globals.css` are an unverified straight inversion of the light
     palette — fine, since `DESIGN-SYSTEM.md` doesn't require dark mode for MVP, but don't
     cite them as contrast-checked.
4. **Files touched:** `package.json`, `app/*`, `components.json`, `components/ui/*`,
   `lib/utils.ts`, `lib/env.ts`, `lib/__tests__/env.test.ts`, `.env.example`, `.gitignore`,
   `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`,
   `tsconfig.json` (untouched, already strict), `README.md`, `public/*.svg` (removed),
   `docs/TEST-CHECKLIST.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (010),
   `docs/features/phase-0-baseline-and-guardrails.md` (new). No source specs modified.
5. **Model:** Claude Opus 5 (`claude-opus-5[1m]`).

### 2026-08-13 — MV-VRA development plan created

1. **What we did:** Produced the development plan for MV-VRA. Read all nine Field Guide docs
   and the four requested skills (`brainstorming`, `nodejs-best-practices`,
   `database-architect`, `ui-ux-pro-max`) first. Locked four architecture decisions with the
   project owner — shared-DB tenancy, TypeScript/App Router/Mongoose, Tailwind + shadcn/ui,
   and solo/no-deadline delivery — then wrote `docs/PLAN.md` (13 phases, assumptions,
   critical path), `docs/DATA-MODEL.md` (14 collections, index policy, `questions_schema`
   format, consistency strategy), and `docs/DESIGN-SYSTEM.md` (two-density design system,
   tokens, accessibility floor). Resolved the `FLOW.md` F1 and F4 gaps as decisions rather
   than leaving them as noted risks. Appended `DECISIONS.md` 003–009 and closed out
   `ARCHITECTURE.md` §7.
2. **What's left:** Phase 0. Get the dependency list approved, make the initial commit,
   record the baseline SHA in `ROLLBACK.md`, scaffold Next.js + Tailwind + shadcn, then
   replace the `[PLACEHOLDER]` commands in `TEST-CHECKLIST.md` with real ones.
3. **Watch out for:**
   - **No rollback point still exists.** Any overwrite in this repo is permanent until the
     first commit lands.
   - All three new documents carry `STATUS: DESIGN — NOT YET BUILT` banners. They are intent,
     not description. Do not cite them as evidence that something works.
   - `TEST-CHECKLIST.md` is still not runnable. Nothing has been tested because there is
     nothing to test — no gates were run this session and none are claimed.
   - Six questions in `ARCHITECTURE.md` §7 remain open. Each has a default recorded in
     `PLAN.md` §1; the defaults are assumptions, not answers.
   - The `ui-ux-pro-max` `search.py` script **cannot run on this machine** — it needs Python
     3.12+ and only 3.9 is installed (`SyntaxError` on an f-string backslash in
     `design_system.py:437`). Design recommendations were read straight from the skill's CSV
     data instead. The colour-contrast ratios in `DESIGN-SYSTEM.md` §3 were computed by hand
     and are marked for in-browser verification.
   - `DECISIONS.md` 001 still carries an **action required**: the project owner needs to
     backfill why MongoDB was chosen. Decision 003 depends on that reasoning.
4. **Files touched:** `docs/PLAN.md` (new), `docs/DATA-MODEL.md` (new),
   `docs/DESIGN-SYSTEM.md` (new), `docs/DECISIONS.md` (appended 003–009),
   `docs/ARCHITECTURE.md` (§1, §2, §7), `docs/HANDOVER.md`. No source specs modified. No code
   written.
5. **Model:** Claude Opus 5 (`claude-opus-5[1m]`).

### 2026-08-13 — Field Guide documentation system set up

1. **What we did:** Implemented habits 1–9 of the AI Collaboration Field Guide as
   `CLAUDE.md` plus nine documents under `docs/`. Grounded `ARCHITECTURE.md` and `FLOW.md`
   in the MVP spec rather than leaving them as blank templates.
2. **What's left:** Make the first git commit to establish a rollback baseline. Answer the
   open architectural questions. Scaffold the Next.js app, then fill in the real commands
   in `TEST-CHECKLIST.md`.
3. **Watch out for:** `ARCHITECTURE.md` and `FLOW.md` are unverified intent, not
   description — they carry STATUS banners saying so. Do not treat them as ground truth
   about existing code. `TEST-CHECKLIST.md` commands are placeholders and will not run yet.
4. **Files touched:** `CLAUDE.md`, `docs/HANDOVER.md`, `docs/DECISIONS.md`,
   `docs/FLOW.md`, `docs/ARCHITECTURE.md`, `docs/CONSTRAINTS.md`,
   `docs/TEST-CHECKLIST.md`, `docs/ROLLBACK.md`, `docs/features/TEMPLATE.md`,
   `docs/bugs/TEMPLATE.md`. No source specs modified.
5. **Model:** Claude Opus 5 (`claude-opus-5[1m]`).
