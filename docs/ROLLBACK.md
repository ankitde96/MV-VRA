# ROLLBACK.md — The Way Back Out

> Guide habit 9. The confidence to let AI make bigger changes comes from knowing exactly
> how to reverse them. Fill in the **Active plan** section _before_ starting a large or
> risky edit — not after it breaks.

---

## ✅ Current status: rollback baseline exists (established 2026-08-18)

Baseline SHA: `0ea5688` (`origin/main`) — `DECISIONS.md` 027. Every prior "no revert path"
caveat in this file and in `DECISIONS.md` (010, 011, 014, 025) is resolved as of this commit.

---

## When a rollback plan is mandatory

Before any change that:

- touches more than one module,
- changes a MongoDB schema or runs a migration,
- modifies authentication (admin login or Vendor SPOC Email OTP),
- alters tenant isolation or `workspace_id` scoping,
- changes questionnaire template versioning or the archive path,
- adds or upgrades a dependency,
- rewrites more than ~100 lines.

For anything smaller, `git diff` and `git restore` are sufficient.

---

## Active plan

Overwrite this block at the start of each risky change. One at a time.

```
Reviewer experience upgrade — Stage 6: completion workflow and exports
(2026-08-20, DONE). Safe baseline: a78784873258c2e4001f0cbf3458f29a60fedb14
(origin/main; clean worktree at stage start).

Add a server-owned completion/report model, confirmation dialog, internal CSV and PDF
exports, and review-page export actions. The PDF renderer is a new pinned dependency. No
schema, migration, session, capability, tenant-scoping, template-write, storage, scoring,
or existing hard completion-gate change is planned; historical exports read only the frozen
assessment snapshot and workspace-scoped assessment records.

Reversible by restoring the Stage 6 service/route/component/test/dependency/documentation
files from the safe baseline and reinstalling the baseline lockfile. Generated downloads are
ephemeral response bodies and leave no persisted records; no data cleanup is required.

Verified: golden CSV/PDF and completion/report service coverage passed 2 files/25 tests;
the full unit/integration suite passed 37 files/264 tests; the disposable desktop/mobile
reviewer-remediation journey passed 2/2 and verifies authenticated CSV/PDF responses,
server summary confirmation, CAP acknowledgement, completion, and audit persistence; the
production build completed; `21st review` found no new browser-UI issue (only existing
repository primitive findings and informational print-PDF color notices).

Prior active plan (closed):

Reviewer experience upgrade — Stage 5: risk and remediation integration
(2026-08-20, DONE). Safe baseline: 1c76c4413716dc39449cc2d2d18f8c72ce161916
(origin/main; clean worktree at stage start).

Add reviewer-side prefilled risk creation and per-control risk state, an advisory CAP
owner/due-date completeness warning with an explicit audited completion override, and a
vendor-scoped overdue-remediation surface backed by the existing request-driven detector.
No schema, session, capability, storage, scoring, or hard completion-gate change is planned.

Reversible by restoring the Stage 5 service/route/component/test/documentation files from
the safe baseline. Risks or audit events created while deployed remain valid records if the
UI is reverted; the override is append-only audit context and requires no data cleanup.

Verified: focused service and age-bucket tests passed 2 files/28 tests; the disposable
desktop/mobile remediation journey passed 2/2 and proves vendor-scoped overdue display and
deep links, risk creation from a non-compliant control, explicit CAP-warning acknowledgement,
successful completion, and audit persistence; `21st review` reported 0 findings; `npm run
verify` passed 36 files/261 tests and the 35-page production build.

Prior active plan (closed):

Reviewer experience upgrade — Stage 4: evidence review experience
(2026-08-20, DONE). Safe baseline: 04b77cc71d75947b884ef93626cd25932bbd1db1
(origin/main; clean worktree at stage start).

Add internal-session evidence download/export routes, tenant-scoped evidence service and
repository operations, advisory insufficiency flags, reviewer evidence metadata/actions,
and the Stage 3 facet integration. This stage adds an archive dependency and one bounded
environment setting, but does not change session issuance, portal authorization, response
completion gates, or storage-driver implementations. All object reads continue through
`getStorageDriver()` and all database access remains workspace-scoped.

Reversible by restoring the Stage 4 route/service/repository/component/test/config/
documentation files from the safe baseline and reinstalling the baseline lockfile. The
additive `evidence_flags` records written while deployed remain schema-valid and advisory if
the UI is reverted; no migration or destructive cleanup is required.

Verified: focused evidence/review tests passed 3 files/31 tests; the disposable desktop and
mobile evidence journey passed 2/2 and proves single-file download, annotation persistence,
facet integration, ZIP export, and bidirectional internal/portal session isolation; `21st
review` reported 0 findings; `npm run verify` passed 35 files/254 tests and the 35-page
production build.

Prior active plan (closed):

Reviewer experience upgrade — Stage 3: bulk review and reviewer productivity
(2026-08-20, DONE). Safe baseline: 8aa27a0c2fe353af3721b08435f0cfbaae227c8d
(origin/main; clean worktree at stage start).

Client-only review-page enhancement: pure filter/progress helpers, typed URL state,
keyboard navigation, sticky controls, collapsible sections, and explicit autosave status.
No schema, API contract, authentication, tenant query, storage, dependency, or migration
change. Existing verdict PATCH/resend/completion paths remain the only persistence writers.

Reversible by restoring the Stage 3 component/hook/test/documentation files from the safe
baseline. URL query parameters introduced by this stage are inert if the UI is reverted;
saved response verdicts and notes remain valid existing data.

Verified: pure productivity/reducer tests passed 2 files/7 tests; desktop and mobile Stage 3
plus correction-round Playwright journeys passed 4/4; `21st review` reported 0 findings;
`npm run verify` passed 34 files/248 tests and the 35-page production build.

Reviewer experience upgrade — Stage 2: demo data v2
(2026-08-20, DONE). Safe baseline: 2ae938cef144
(origin/main; clean worktree at stage start).

Extend only the opt-in demo seeder and committed fixture/test/documentation files. Existing
production schemas, auth, APIs, and UI remain unchanged. Database cleanup stays bounded to
vendors in the default workspace whose domains end in `.demo.mv-vra.local`; responses,
assessments, risks, offboarding records, and engagements are resolved from those exact
vendor ids before deletion. Evidence uses a dedicated storage prefix; `--reset` may delete
only keys listed beneath that prefix.

Reversible by restoring the Stage 2 files from the safe baseline. Locally seeded demo
records can be rebuilt with the baseline script; non-demo records are outside both cleanup
boundaries. No migration or production cleanup is required.

Verified: focused fixture/spec tests passed 1 file/5 tests; the real seeder produced the
same 12 vendors, 11 assessments, 225 responses, 36 evidence records/keys, 17 risks, and 8
CAP tasks on consecutive runs. The non-demo counts and SHA-256 fingerprint were unchanged.
`npm run verify` passed 33 files/244 tests and the 35-page production build. No Playwright
run because this stage changes no UI or runtime request path.

Prior active plan (closed):

Reviewer experience upgrade — Stage 1: schema and upload foundations
(2026-08-20, DONE). Safe baseline: 94500144363457d1c34e33e819523cbeca31b2b5
(pushed origin/main; clean worktree at stage start).

Additive Response.evidence_flags[] schema; no migration or destructive write. CSV/TXT are
added to the shared 10 MB upload allowlist with filename-extension agreement, affecting
evidence, vendor-document, and offboarding-certificate callers consistently. New evidence
records use the already-authenticated portal spocId as uploaded_by; legacy vendor-id records
remain readable and label as the vendor. Reviewer data resolves uploader labels with one
workspace-scoped batch query, never per evidence item.

Reversible by restoring the Stage 1 files from the safe baseline. Documents already written
with evidence_flags remain valid additive data if code is reverted. CSV/TXT files uploaded
while deployed remain stored and retrievable; reverting only prevents new uploads of those
types. No authentication/session code or database cleanup is involved.

Verified: focused Stage 1 gate passed 4 files/51 tests plus typecheck; `npm run verify`
passed 32 files/239 tests and the production build. No Playwright run: this stage has no UI
change, and the integration suite exercises CSV/TXT against real local-fs storage. See the
feature trace for exact commands and the one existing lint advisory.

Prior active plan (closed):
Reviewer experience upgrade — Stage 0: review-page decomposition
(2026-08-20, DONE). Safe baseline: 453441ebcac2b9d33aedef1872fcc4c26f3ad717
(local main; clean worktree at stage start).

Refactor-only change: consolidate per-control review state behind a reducer, extract
memoized review question/section components, and add an initially field-free URL-state
hook. No schema, auth, tenant-scoping, storage, API-contract, or dependency changes.
Reversible by restoring the Stage 0 files from the safe baseline. Existing assessment and
response data is unaffected because this stage does not alter persistence behavior.

Verified: `npm run verify` passed (30 files, 228 tests, production build); the unchanged
Playwright correction journey passed 2/2 across desktop and mobile Chromium, exercising
verdict marking, reviewer-note autosave, saved state, resend, and portal correction scope.
The completion service remains covered by the passing integration suite; a manual browser
completion click was not run and is recorded in the feature trace.

Prior active plan (closed):
Assessment workflow revamp — Stage 5: compliance marking and resend loop
(2026-08-19, DONE). Safe baseline: 61a5569 plus the verified uncommitted Stage 4
completion diff on main.

Additive Response review fields and Assessment review-round/change-request fields. No
migration or destructive write. Reversible by restoring Stage 5 files; assessments already
in `changes_requested` must be returned to `submitted` only after confirming their ids.

Verified: `npm run verify` passed (29 files, 225 tests, production build); `npm run
test:e2e` passed 23 across desktop Chromium and Pixel 7 with one intentional desktop skip.
The browser journey proved reviewer autosave, resend, locked compliant controls, editable
non-compliant controls, and reviewer-note visibility. No migration or destructive cleanup
was run.

Prior active plan (closed):
Assessment workflow revamp — Stage 4: send, recipients, and assessment history
(2026-08-19, DONE). Safe baseline: 7fe01d2 (merged Stage 3 on main).

Additive Assessment fields: recipients, sent_at, last_activity_at. Draft-only send is
transactional and recipient ids must resolve to active SPOCs on the assessment's own vendor.
Portal reads become recipient-scoped. Reversible by restoring Stage 4 files to 7fe01d2;
records already sent during development remain valid and must not be deleted without
confirming their ids.

Verified: `npm run verify` passed (29 files, 221 tests, build); `npm run test:e2e`
passed 21 with one intentional desktop skip; a disposable real-HTTP walkthrough proved
single-recipient send, 21-day SLA, engagement transition, selected/unselected list and
direct-access boundaries, and answer-driven activity movement, then removed all fixtures.

Assessment workflow revamp — Stage 3: draft assessments and per-vendor checklist editing
(2026-08-19, DONE). See docs/ASSESSMENT-WORKFLOW-PLAN.md Stage 3.

Safe baseline: a77b01e (local main, Stage 2 commit).

Additive schema change: Assessment.template_name. Assignment changes from sent to draft,
leaves due_date null, and no longer advances the engagement; existing assessments are not
migrated. Draft snapshot edits are guarded structurally by a repository query containing
status: "draft" and remain workspace-scoped. Portal list/detail reads explicitly conceal
drafts with the same not-found boundary used for cross-vendor access. New checklist route
uses assessment.assign and validates both Zod shape and no-forward-reference structure.
Checklist PATCH carries `expected_updated_at` as an optimistic-concurrency token and
refuses stale editors instead of silently overwriting newer work.

Verified: `npm run verify` passed (29 files, 218 tests, production build); `npm run
test:e2e` passed 17 tests across desktop Chromium and Pixel 7 with one intentional
desktop skip for the mobile-only checklist journey; the disposable real-HTTP walkthrough
passed assignment, portal concealment, add/edit/delete, template isolation, clean second
assignment, and sent-write refusal, then removed all created records.

Reversible by restoring the Stage 3 files to a77b01e. No destructive data operation or
migration is involved. Assessments created while Stage 3 is deployed remain valid draft
records if code is reverted, but the old UI will not send them; either redeploy Stage 3 or
remove disposable drafts explicitly after confirming their ids.

Prior active plan (closed):
Assessment workflow revamp — Stage 2: multiple Vendor SPOCs (2026-08-19, DONE).
⚠ AUTH-TOUCHING (CONSTRAINTS.md #2) — its own request, own plan, below.
See docs/ASSESSMENT-WORKFLOW-PLAN.md Stage 2, DECISIONS.md 040/042,
docs/features/assessment-workflow-stage-2-multi-spoc.md.

Safe baseline: 137031b (local main, Stage 1's commit; not yet pushed to origin).

Files touched — schema: lib/db/models/vendor.ts (adds spocs[], legacy spoc kept unwritten),
lib/db/models/otp-challenge.ts (adds nullable spoc_id). Auth core: lib/auth/otp-challenge.ts
(findVendorBySpocEmail resolves spocs[] not the legacy spoc; issueOtpChallenge stores
spoc_id), lib/services/portal-auth.ts (requestOtp/verifyOtp both spoc-scoped; verifyOtp
re-checks the matched SPOC is still active at verify time), lib/auth/portal-session.ts
(PortalSessionPayload gains required spocId — rejects any pre-existing token without it).
Repository/service: lib/repositories/vendor-repository.ts (addSpoc/updateSpocFields/
setSpocStatus/setPrimarySpoc, replacing the retired single-object updateSpoc),
lib/services/vendor-spoc.ts (rewritten), lib/services/vendor-intake.ts (populates spocs[]
at creation), lib/services/assessment-review.ts (CAP vendor-owner email reads the primary
spocs[] entry). Routes: deleted app/api/vendors/[id]/spoc/route.ts, added
app/api/vendors/[id]/spocs/route.ts and .../[spocId]/route.ts (PATCH only, no hard delete —
DECISIONS.md 042). UI: components/spoc-edit-form.tsx (rewritten, list-based),
app/(internal)/vendors/[id]/page.tsx, app/(internal)/vendors/page.tsx +
components/vendors/vendors-table.tsx (SPOC column → primary + count). Ops: new
scripts/migrate-vendor-spocs.ts (+ npm script), scripts/seed.ts / seed-demo-data.ts extended.

What to re-check if reverting: a real bug was found and fixed during verification (Mongoose
9 requires `{updatePipeline: true}` for an aggregation-pipeline-array `updateOne` —
DECISIONS.md 042); if `setPrimarySpoc()` is ever rewritten, re-verify with a real HTTP
request, not just typecheck, since that bug had zero automated test coverage before this
stage added one. `spocId` being required in `PortalSessionPayload` means every existing
portal cookie is invalidated once — acceptable at the 1-hour TTL, but don't "fix" this by
making the field optional without re-reading DECISIONS.md 040 (D8)'s rationale. The legacy
`Vendor.spoc` field and its `{'spoc.spoc_email':1}` index are untouched and unread by
anything new — do not delete either without a separate, explicit decision.

Verified: npm run verify green (212/212 tests — 209 baseline + 3 net new; format/lint/
typecheck/build all clean; one `sharing.test.ts`/one `portal-assessment.test.ts` failure
each reproduced as a pre-existing cross-file local-fs storage race, confirmed by passing in
isolation and on a clean re-run, not a regression). Real HTTP request: ran the actual
migration script against real pre-existing data (backfilled one real vendor,
`nithin.r@jify.com`, confirmed idempotent on a second run); logged in as two different
SPOCs of the same vendor (one via the dev bypass, one via a real OTP read from the console
mail log) with independently scoped sessions; exercised every guard rail via the API
(deactivating the primary refused, deactivating the last active SPOC refused, deactivating
a plain active SPOC succeeded, an inactive SPOC's OTP request returned the byte-identical
enumeration-safe response with zero real challenges issued, make-primary followed by a
direct database read confirmed exactly one `is_primary: true`); confirmed the vendor list
and vendor detail pages render the new SPOC UI correctly. `npm run test:e2e` still not run
in this sandbox — see the Stage 1 note below, unchanged this stage.

Prior active plan (closed):
Assessment workflow revamp — Stage 1: evidence upload on every question (2026-08-19,
DONE). See docs/ASSESSMENT-WORKFLOW-PLAN.md Stage 1,
docs/features/assessment-workflow-stage-1-evidence-upload.md. Not auth-touching, no schema
change — but touches more than one module (portal component, service, repository, two new
routes), so a plan is filled per ROLLBACK.md's own trigger list. Verified: npm run verify
green (209/209 tests, format/lint/typecheck/build all clean), plus a real-HTTP-driven
manual walkthrough against a disposable fixture assessment (upload on a no-evidence-config
question succeeded, byte-identical download, delete removed both record and file, required-
evidence submit blocker unchanged, sweep script reported zero orphans throughout).
npm run test:e2e could not run in this sandbox (Chromium binary download blocked by TLS
interception, unrelated to this change) — flagged in HANDOVER.md, not silently skipped.

Safe baseline: 2b72d13d914386fd977c44e44180ca72ecb17c69 (local main; not yet pushed to
origin — see HANDOVER.md).

Files being touched: components/portal/assessment-answer-form.tsx (drops the
`question.evidence` render gate — EvidenceUpload always renders), lib/services/
portal-assessment.ts (removes the "does not accept an evidence upload" guard in
uploadEvidence(); adds deleteEvidence()), lib/repositories/response-repository.ts (adds
pullEvidence()), lib/storage/types.ts comment update (delete() gains a real feature caller,
not just the sweep script), new route app/api/portal/assessments/[id]/responses/[controlId]/
evidence/[evidenceId]/route.ts gains a DELETE handler, components/portal/evidence-upload.tsx
gains a delete affordance. Extends lib/services/__tests__/portal-assessment.test.ts.

What to re-check if reverting: submitAssessment()'s `evidence.required` blocker is
unchanged — only the upload-time gate moves. No data migration; existing evidence documents
are unaffected either way. `storage.delete()` already existed (used by the sweep script) —
this only adds a second caller, not new storage-driver code.

Reversible? Yes, by git restore per file — no schema, auth, or destructive write.

Prior active plan (closed):
Browser E2E + UX reliability + documentation cleanup (2026-08-18, completed locally).
Safe baseline: 5b37815193f5 (origin/main at task start).
No schema, tenant-scoping, session format, or persistence changes. Added Playwright as a
dev dependency plus playwright.config.ts/e2e/*. UX changes are confined to portal request,
autosave, submission-flush, and upload retry states. Documentation changes reconcile the
current git baseline and add the browser gate. Revert the task files from the safe baseline;
package.json and package-lock.json must be reverted together.

Prior active plan (closed):
MV-VRA Console redesign (2026-08-18).

Prior active plan (closed):
UI Revamp Round 2 — glassmorphism visual layer + KPI/KRI analytics (2026-08-18).

Safe baseline: commit 0ea5688 (origin/main) — first real rollback point this project has
ever had. `git diff 0ea5688` / `git restore --source=0ea5688 -- <file>` both work now.

Phase A (design tokens) — DONE, committed 45c392e. app/globals.css, app/layout.tsx.
No feature code touched.

Phase B (KPI/KRI data layer, in progress) — SCHEMA-TOUCHING. Three additive nullable Date
fields (not six — three already existed under different names, see DECISIONS.md 029):
Assessment.due_date/next_review_due, Risk.closed_at. Two new Workspace.settings config
blocks (reassessment_cadence_months, assessment_response_sla_days), both with schema
defaults so no existing Workspace document needs a migration. New lib/services/analytics.ts.
Files touched: lib/db/models/{assessment,risk,workspace}.ts, lib/services/
{assessment-assignment,assessment-review}.ts (new writers only, no existing write path
changed), lib/services/analytics.ts (new), plus new/extended tests. No auth, no tenant
scoping, no repository-layer change. What to re-check if reverting: every new field is
nullable with no default other than null — reverting the model files alone is safe even if
documents were already written with these fields set, since older code simply ignores
fields it doesn't select.

Phase C (dashboard rebuild) — DONE. app/(internal)/dashboard/page.tsx rebuilt (glass hero,
KRI/KPI tile rows, two new charts — RiskAgingChart, ResidualExposureChart — plus two new
KriListCard watchlists). New: components/charts/{risk-aging,residual-exposure}-chart.tsx,
components/layout/kri-list-card.tsx, scripts/seed-demo-data.ts. Edited: stat-card.tsx (adds
`glass` prop), page-header.tsx (adds `aurora` variant). No schema/auth/service change — only
new reads via existing getWorkspaceAnalytics(). Verified live in Chrome (light+dark,
multi-workspace-admin dev fixture login): all KRI/KPI numbers match a direct script query
against the same seeded data. One pre-existing recharts hydration quirk noted, not a
regression (DECISIONS.md 030) — reproduces only on client-side soft-nav between chart-heavy
pages, never on a fresh load.

Phase D (executive roll-up rebuild) — DONE. app/(internal)/rollup/page.tsx: aurora hero,
two new cross-workspace charts (TierComparisonChart, CapAgeBucketChart) gated to render only
when >1 authorized workspace, RollupWorkspaceCard re-skinned glass. Extended
getRollupAnalyticsSummary() (analytics.ts) with vendors_by_tier + cap_age_buckets — same
per-membership loop, additive fields only. Verified live in Chrome light+dark; caught and
fixed a real label-collision bug (CapAgeBucketChart's workspace names overlapped the legend
in vertical orientation — switched to horizontal, DECISIONS.md 031). No schema/auth/test
regressions — 202/202 tests, npm run verify clean.

Phase E (per-vendor risk scorecard) — DONE. app/(internal)/vendors/[id]/page.tsx: PageHeader
+ RiskTierBadge, ScoreBreakdown (inherent/residual/reduction% + open-severity counts),
AssessmentHistoryList, 3 glass tiles (reassessment due, CAP tasks, evidence coverage). New
getVendorScorecard() in analytics.ts (a real new function, not a filter on
getWorkspaceAnalytics() — see DECISIONS.md 032 for why). New components: score-breakdown.tsx,
assessment-history-list.tsx. Verified live in Chrome light+dark; caught and fixed a real
bug — reduction% was hardcoded green regardless of sign, but residual can legitimately
exceed inherent with multiple open risks (DECISIONS.md 032). 204/204 tests (2 new), npm run
verify clean.

Phase F (portal polish + Round 1 debt cleanup) — DONE, and the full Round 2 plan is now
complete. Portal: .glass-panel-sm header (sticky) + OTP card + assessment-list cards, no
density/charts/KPI change. DataTable migration: admin-users-client.tsx, sharing-client.tsx
(granted shares flattened to one row per share+target-workspace pair). Toast conversion:
9 files converted (vendor-document-upload, assign-assessment-form, offboarding-panel,
template-builder-form, vendor-intake-form, raise-risk-dialog, add-cap-task-dialog,
assessment-review-client, template-actions); 2 files deliberately left as inline Alert
(assessment-answer-form's submit-blocker list, evidence-upload's field-adjacent error) per
DESIGN-SYSTEM.md §6/§7 — DECISIONS.md 033. No schema/auth change. 204/204 tests unchanged
(no service-layer code touched this phase), npm run verify clean.

Round 2 (all 6 phases: A tokens, B data layer, C dashboard, D roll-up, E vendor scorecard,
F polish/cleanup) is complete. Next real work is outside this plan's scope.

Dependencies: CONSTRAINTS.md #1's per-package ask is pre-approved for this round only
(DECISIONS.md 028) — each package actually added still gets its own DECISIONS.md entry.
None added yet (Phases A/B were CSS + Mongoose schema only).

Historical note: `DECISIONS.md` 038 later superseded this round-only restriction with
permanent project-wide authorization for library additions.

Re-check after any revert attempt: npm run verify all green, 201 tests still pass, risk
badges/table cells render identically to pre-Round-2 (flat, no glass — the one thing that
must not visually change).
```

_UI Revamp Round 1 (full frontend redesign, Phases 0–8) was built and verified 2026-08-17 —
see `docs/features/ui-revamp.md`. Its Active plan is kept below for reference; closed out._

**Closed: UI Revamp Round 1 (2026-08-17).**

```
UI Revamp — full frontend redesign of internal console + vendor portal (2026-08-17).
Touches every module under app/ and components/ except app/api/**. No schema, auth, or
repository/service-layer changes — see docs/UI-REVAMP-PLAN.md's "Guardrails that survive
the revamp" section for the load-bearing data-fetching chain that must not move.

No git baseline existed at the time (project owner's choice that session). New
dependencies: recharts, @tanstack/react-table, motion — added that session (CONSTRAINTS.md
#1, approved per-package). A git baseline now exists (commit 0ea5688) as of 2026-08-18.
```

_Phase 11 (multi-workspace RBAC, sharing, executive roll-up) was built and verified
2026-08-17 — see
`docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`. The plan
filled in before starting it is kept below for reference; it is closed out, nothing is
currently mid-change._

**Closed: Phase 11 — multi-workspace RBAC, sharing, executive roll-up (2026-08-17).**

```
Phase 11 — multi-workspace RBAC, sharing, executive roll-up (2026-08-17, in progress).
AUTH-TOUCHING (CONSTRAINTS.md #2) — this is its own request, with its own plan below.

- Safe baseline: no git commit exists anywhere in this repo (carried-forward gap,
  DECISIONS.md 010) — no SHA to record; only lever is git diff/manual revert per file.
- Files being touched (auth core): lib/auth/login.ts (removes the single-email gate —
  login() now authenticates any active User whose password matches, not just
  SUPER_ADMIN_EMAIL), lib/auth/rbac.ts (new — role capability matrix),
  lib/auth/current-membership.ts (new — resolves a session's role fresh from the DB per
  request, never cached in the signed cookie so a role change takes effect without
  re-login), new routes app/api/auth/switch-workspace/route.ts,
  app/api/auth/memberships/route.ts, app/api/admin/users/**, then capability checks added
  to every existing internal-facing route (vendor/template/assessment/risk/cap/offboarding).
  New: lib/services/sharing.ts + app/api/sharing/** (uses the pre-existing, previously
  unused SharedDocument model). New: lib/services/executive-rollup.ts +
  app/api/rollup/route.ts. UI: components/workspace-switcher.tsx,
  app/(internal)/admin/users/page.tsx, app/(internal)/sharing/page.tsx,
  app/(internal)/rollup/page.tsx. scripts/seed.ts extended with a second workspace and
  users of varied roles.
- What to re-check if reverting: SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD_HASH remain valid
  as a bootstrap admin account even after login.ts's gate is removed (they just stop being
  the *only* account that can authenticate) — reverting login.ts alone restores the
  single-email gate without affecting seeded data. The session cookie format
  (`SessionPayload: {userId, workspaceId}`) is unchanged — no signed-token migration
  needed either direction. No destructive writes anywhere in this phase; SharedDocument
  reads are additive audit-logged reads, not mutations of the underlying vendor data.
- Reversible? Yes for code, by git restore per file. Any new seeded workspace/users are
  disposable dev-only fixtures, not production data.
```

_Phase 10 (offboarding, destruction certificates, archiving) was built and verified
2026-08-17 — see
`docs/features/phase-10-offboarding-destruction-certificates-archiving.md`. The plan filled
in before starting it is kept below for reference; it is closed out, nothing is currently
mid-change._

**Closed: Phase 10 — offboarding, destruction certificates, archiving (2026-08-17).**

```
Phase 10 — offboarding, destruction certificates, archiving (2026-08-17, in progress).

- Safe baseline: no git commit exists anywhere in this repo (carried-forward gap,
  DECISIONS.md 010) — no SHA to record; only lever is git diff/manual revert per file.
- Files being touched: lib/repositories/offboarding-repository.ts (new),
  lib/repositories/assessment-repository.ts (adds archive()),
  lib/services/offboarding.ts (new), lib/services/assessment-review.ts (adds an
  archived-assessment guard to raiseRisk/updateRisk/createCapTask/updateCapTask — no
  schema change, just an early throw), new routes under app/api/offboarding/** and
  app/api/vendors/[id]/engagements/[engagementId]/offboarding/route.ts, a new
  components/offboarding/offboarding-panel.tsx wired into
  app/(internal)/vendors/[id]/page.tsx.
- What to re-check if reverting: no auth/tenancy code touched. The only "schema-adjacent"
  change is behavioral (a new throw path in an existing service), not a model field —
  reverting is a clean file-level git restore. The terminal step
  (completeOffboarding()) writes Offboarding.status/Assessment.status/Engagement.status/
  Vendor.lifecycle_status in one transaction; if this needs undoing on a real document
  that already archived, it is a manual, reasoned document edit (not a script) per
  CONSTRAINTS.md #12 — archives are supposed to be append-only, so "undo" here means
  correcting a mistake by hand, not restoring a delete path.
- Reversible? Yes for code. Not applicable for data — this session uses disposable
  smoke-test vendors/engagements only, cleaned up afterward, same pattern as every prior
  phase's verification.
```

_Phase 9 (CAP tracking and mitigation guidance) was built and verified 2026-08-16 — see
`docs/features/phase-9-cap-tracking-and-mitigation-guidance.md`. The plan filled in before
starting it is kept below for reference; it is closed out, nothing is currently mid-change._

**Closed: Phase 9 — CAP tracking and mitigation guidance (2026-08-16).**

- **Safe commit / baseline:** no git commit exists anywhere in this repo (carried-forward
  gap, `DECISIONS.md` 010). There is no SHA to record; the only rollback mechanism
  available is `git diff`/manual revert of the specific files below.
- **Files being touched:** `lib/db/models/risk.ts` (adds `cap_tasks.escalated_at: Date?`
  — additive, no migration, existing documents read `undefined`/`null`), `lib/services/
assessment-review.ts` (adds `createCapTask`/`updateCapTask`/`detectAndEscalateOverdueCaps`),
  new routes `app/api/risks/[id]/cap-tasks/route.ts`,
  `app/api/risks/[id]/cap-tasks/[taskId]/route.ts`,
  `app/api/risks/cap-tasks/overdue/route.ts`, UI additions to the risk register/detail
  views. Also, first: `lib/scoring/__tests__/residual-risk.test.ts` and `lib/services/
__tests__/assessment-review.test.ts` (test-only, closing Phase 8's flagged gap before
  building on it).
- **What to re-check if this needs reverting:** no auth or tenancy code is touched; the
  one schema change is additive (new optional field), so reverting the model edit alone is
  safe even if documents were already written with `escalated_at` set — the field is just
  ignored by older code. No data migration, no destructive write, no email provider swap
  (still `MAIL_PROVIDER=console`, `ROLLBACK.md`'s "emails cannot be rolled back" rule is
  therefore inert for this phase — nothing leaves the dev console log).
- **Reversible?** Yes, by `git restore`/manual file revert — no schema drop, no
  cross-collection write, no auth change.

---

## Standard recovery recipes

**Uncommitted work, single file**

```bash
git diff -- <file>            # read it first — always
git restore -- <file>
```

**Uncommitted work, everything** — destructive, confirm with the owner first

```bash
git stash push -u -m "wip before discard"   # prefer stashing over discarding
```

**Committed but not pushed — keep the changes as edits**

```bash
git reset --soft HEAD~1
```

**Committed but not pushed — discard entirely** — destructive

```bash
git reset --hard <safe-SHA>
```

**Already pushed / shared** — never rewrite shared history

```bash
git revert <bad-SHA>          # a new commit that undoes it, history intact
```

**Recover a lost commit after a bad reset**

```bash
git reflog                    # find the SHA, then: git reset --hard <SHA>
```

---

## What git cannot roll back

Code reverts are the easy half. These need their own plan, and they are the reason the
"Data changes" and "Reversible?" lines above are not optional:

1. **MongoDB writes.** Reverting code does not un-write documents. Any migration needs a
   tested down-path, or a dump taken first:
   `mongodump --uri="<uri>" --out=./backup-<date>`
2. **Deleted or overwritten evidence files** in S3 or local storage. Confirm S3 versioning
   is enabled before touching storage code; local dev folders have no undo.
3. **Emails already sent** — OTPs, CAP escalations, vendor notifications. Once out, out.
   Prefer a dry-run flag over "just test it against the real sender."
4. **Immutable archives.** Offboarding records and audit trails are append-only by design.
   Corrupting them is not reversible in-band and is a compliance issue, not a bug.
5. **Leaked secrets.** A revert does not unleak a committed credential. Rotate it, then
   purge history.

## Post-rollback duties

- [ ] Note the rollback and its cause in `HANDOVER.md`
- [ ] Log _why_ the approach failed in `DECISIONS.md` — a rejected approach is a decision
      worth keeping, so the next session doesn't retry it
- [ ] Update the relevant `docs/bugs/` or `docs/features/` trace with what didn't work
