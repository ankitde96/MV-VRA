# TEST-CHECKLIST.md — Proof, Not Claims

> Guide habit 8. "AI claiming success" and "code actually working" are two different facts.
> This file is how you stop confusing them. Actual commands, actual expected output — not a
> vibe check.
>
> **STATUS (2026-08-15): Gates 0–3 real since Phase 0; Gate 2 gained integration tests in
> Phase 1** (Mongoose models, tenant-guard repository base, index sync), **Phase 2**
> (session token, login), **and Phase 3** (Inherent Risk Engine unit tests at every tier
> boundary + the unscoreable case; a real multi-document transaction against MongoDB), **and
> Phase 4** (storage module local-fs/S3 unit tests, vendor-document upload/retrieve/
> authorization integration tests), **Phase 5** (conditional-logic evaluator and
> structural-validation unit tests; template lifecycle — draft/publish/immutability/
> versioning/archive — integration tests), **Phase 6** (OTP crypto/rate-limit unit
> tests; portal auth and assessment-assignment integration tests), **and Phase 7**
> (storage list/delete unit tests; portal-answering integration tests covering autosave
> idempotency, evidence upload ordering, and — the phase's named exit criterion — a
> suppressed required question not blocking submission). **Gate 4's "Evidence file
> access" item is now real** (Phase 4) — see below. **Gate 4's entire vendor-portal block
> (enumeration, OTP hygiene, vendor scoping/scope source) is now real** (Phase 6), and
> extended in Phase 7 to cover the answering surface itself (cross-vendor tampering on
> `saveResponse`/`submitAssessment`, not just the OTP endpoints). **Gate 4's tenant-isolation
> item is now exercised by a second repository** (`EngagementRepository`, Phase 3), still
> only at the repository level, not yet through an API route with two tenants. **Gate 5
> gained its first real item in Phase 5** — template immutability — and Phase 7 adds the
> suppressed-question-never-blocks-submission item; archive-record immutability
> (Phase 10) is still a placeholder. Gate 6's first line item ("internal login → submit
> intake → tier assigned and visible in inventory") is real and was run by direct HTTP
> request in Phase 3 — see `docs/features/phase-3-vendor-intake-and-tiering.md`. **Phase 8**
> (2026-08-16) added the "reviewer raises a risk" Gate 6 item, verified by real HTTP
> request, but added **no automated test coverage** for the Residual Risk Calculation or
> `AssessmentReviewService` — closed at the start of **Phase 9** (2026-08-16), which added
> `lib/scoring/__tests__/residual-risk.test.ts` (9 unit tests) and
> `lib/services/__tests__/assessment-review.test.ts` (14 integration tests covering
> raiseRisk/updateRisk/completeReview/listWorkspaceRisks and the new CAP task surface)
> before building CAP tracking on top, then added CAP task creation/update and
> request-driven overdue escalation, verified by real HTTP request including the exact
> "escalates once" invariant. **Phase 10** (2026-08-17) added
> `lib/services/__tests__/offboarding.test.ts` (integration, covering the full
> initiate → checklist → certificates → complete lifecycle plus the repository-level
> immutability guard) and closed Gate 5's last placeholder item — archive-record
> immutability is now real, verified by both integration test and real HTTP request.
> **Phase 11** (2026-08-17) added `lib/auth/__tests__/rbac.test.ts` (capability matrix),
> `lib/auth/__tests__/current-membership.test.ts` (fresh-per-request role resolution,
> including a revoked-mid-session case), extended `lib/auth/__tests__/login.test.ts` for
> multi-user login, and `lib/services/__tests__/{workspace-membership,admin-users,sharing,
executive-rollup}.test.ts` (all integration, against a real MongoDB) — then closed Gate 4's
> last open placeholder ("Executive roll-up aggregates only authorized workspaces") by both
> automated test and real HTTP request, and Gate 6 gained its first cross-workspace smoke
> path.
>
> **Gates 2–4 that touch the database require a local MongoDB reachable at
> `MONGODB_URI`** (default `mongodb://127.0.0.1:27017/mv-vra?replicaSet=rs0`, test default
> `mongodb://127.0.0.1:27017/mv-vra-test` — see `vitest.setup.ts`). **As of Phase 3, this
> must be a single-node replica set (`rs0`), not a standalone mongod** — `DECISIONS.md` 014
> supersedes the earlier standalone decision (011), because Phase 3's Vendor+Engagement
> write is a real multi-document transaction and a standalone `mongod` rejects
> `startTransaction()` outright. If no mongod is reachable, or it's still standalone, Gate 2
> will fail on the integration test files, not just skip them; report that explicitly.
>
> **Browser gate added 2026-08-18:** Playwright exercises authentication boundaries,
> role-aware navigation, responsive rendering, vendor portal login, and recoverable OTP
> failure behavior against a real Next.js server. It is intentionally separate from
> `npm run verify` because it requires seeded development fixtures and browser binaries.
>
> **Assessment workflow revamp, Stage 2 (2026-08-19):** Gate 4's vendor-portal block gains
> multi-SPOC coverage — `lib/services/__tests__/portal-auth.test.ts` now covers a second
> active SPOC logging in scoped to its own id, an inactive SPOC's OTP request behaving
> identically to no match (enumeration-safe), and a SPOC deactivated between OTP request
> and verify being refused at verify time. Verified by both integration test and a real
> HTTP request that also exercised the admin-facing SPOC management guard rails (primary
> cannot be deactivated, the last active SPOC cannot be deactivated, make-primary is
> atomic) and ran the real backfill migration against real pre-existing data. A real
> Mongoose 9 bug was found and fixed during that verification pass, not by an automated
> test — see `docs/features/assessment-workflow-stage-2-multi-spoc.md` §7,
> `DECISIONS.md` 042.
>
> **Assessment workflow revamp, Stage 1 (2026-08-19):** Gate 4's evidence-upload item is
> updated — a question with no `evidence` config now accepts an optional upload (previously
> refused), and evidence deletion exists for the first time
> (`lib/services/__tests__/portal-assessment.test.ts`, extended). Verified by both
> integration test and a real-HTTP-driven manual walkthrough against a disposable fixture
> assessment — see
> `docs/features/assessment-workflow-stage-1-evidence-upload.md` §9. The browser gate
> (`npm run test:e2e`) could not be run in that session's sandbox (Chromium binary download
> blocked by TLS interception) — reported as skipped, not silently omitted.

---

## Rules

1. Run the gates relevant to what you changed — not just the cheap ones.
2. **Paste real terminal output.** Never paraphrase a result, never predict one.
3. A skipped gate is reported as skipped, with the reason.
4. A failing gate means **not done**. Say so plainly; don't bury it under a summary.
5. If you changed a path that has no test, say that explicitly rather than implying
   coverage exists.

---

## Gate 0 — Toolchain sanity

```bash
node --version          # this repo was scaffolded on v26.7.0; no version pin enforced yet
npm ci                  # expect: exit 0, no peer-dependency errors
```

Note: `npm ci` from a clean checkout may hit a peer-dependency conflict between the `shadcn`
CLI's transient babel toolchain and `@vitejs/plugin-react`'s rolldown/babel peer. If so, use
`npm ci --legacy-peer-deps` — this is a dev-tooling conflict, not a runtime one. Logged for
awareness, not yet fixed at the root.

## Gate 1 — Static checks

```bash
npm run format:check    # prettier --check .        — expect: "All matched files use Prettier code style!"
npm run lint            # eslint                    — expect: 0 errors, 0 warnings
npm run typecheck       # next typegen && tsc --noEmit — expect: no tsc output, exit 0
```

`next typegen` must run before `tsc --noEmit` — the App Router's generated route types
(`LayoutProps<'/'>`, etc.) live under `.next/types` and don't exist on a clean checkout
until generated. `npm run typecheck` does this for you; do not run `tsc --noEmit` alone
against a fresh `.next`-less checkout.

## Gate 2 — Unit tests

```bash
npm test                # vitest run — expect: all suites pass, 0 failures
```

## Gate 2B — Browser end-to-end tests

Prerequisites: the development MongoDB replica set is running, `npm run db:seed` and
`npm run db:seed-questionnaire` have completed, and Chromium is installed once with
`npx playwright install chromium`.

```bash
npm run test:e2e                    # desktop Chromium + Pixel 7 viewport
npm run test:e2e -- --project=chromium  # faster focused desktop gate
npm run test:e2e:ui                 # interactive local debugging
```

The suite under `e2e/` is deliberately read-only against application data. It covers:

- unauthenticated redirects and post-login return destinations;
- generic invalid-credential behavior;
- internal/portal cookie isolation;
- primary administrator workspace surfaces;
- an explicit business-owner denial on an admin-only page;
- seeded vendor portal authentication; and
- an intercepted OTP-request failure that must remain on the email step.

Playwright owns server startup through `playwright.config.ts`, reuses an existing local
server outside CI, and retains traces/screenshots/video only for failures.

Phase 0 added one smoke test (`lib/__tests__/env.test.ts`). Phase 1 added real integration
coverage against a live local MongoDB:

- `lib/repositories/__tests__/base.test.ts` — constructing a repository without a
  `workspaceId` throws `TenantScopeError`
- `lib/repositories/__tests__/tenant-isolation.test.ts` — a repository scoped to workspace A
  cannot read, count, or find workspace B's documents by id; `create()` always stamps the
  constructing context's `workspace_id`, ignoring any other value passed in
- `lib/db/__tests__/indexes.test.ts` — every index declared in a model's schema exists on
  the live collection after `syncIndexes()`

Phase 2 added:

- `lib/auth/__tests__/session.test.ts` — round-trip, tampered signature rejected, tampered
  body rejected, expired-but-correctly-signed token rejected, malformed input rejected
- `lib/auth/__tests__/login.test.ts` — correct credentials succeed; wrong password fails;
  a _different, real, active_ `User` document with the correct password still fails (the
  `SUPER_ADMIN_EMAIL` gate, `DECISIONS.md` 013); unknown email fails; email match is
  case-insensitive

Phase 3 added:

- `lib/scoring/__tests__/inherent-risk.test.ts` — weighted sum across all four factors,
  multi-select `data_classification` summing, every Tier 1/2/3 boundary (exactly at
  `tier1_min`, one below, exactly at `tier2_min`, one below, zero), and the fail-loud path:
  empty `data_classification`, an unmapped value, an undefined required field, missing or
  partially-configured `tier_thresholds` — all assert `scoring_failed`/no `tier` key, never
  a default
- `lib/services/__tests__/vendor-intake.test.ts` — integration, against a real MongoDB
  transaction: Vendor + Engagement written atomically and tiered correctly; a second case
  with an intentionally-unmapped `network_exposure` weight lands both documents in
  `scoring_failed`/`null` tier

Phase 4 added:

- `lib/storage/__tests__/local-fs.test.ts` — put/get round-trip against the real dev
  driver, missing-key throws `NotFoundError`, a path-traversal key is refused
- `lib/storage/__tests__/s3.test.ts` — S3 driver against a mocked `S3Client` (no real AWS
  call): `put()` sends the expected `PutObjectCommand`, `get()` concatenates a streamed
  body, a `NoSuchKey` SDK error surfaces as `NotFoundError`
- `lib/services/__tests__/vendor-documents.test.ts` — integration, against a real MongoDB
  and the real local-fs driver: disallowed MIME type rejected before storage/DB are
  touched, oversized file rejected, full upload→retrieve round-trip byte-identical, and
  two authorization-refusal cases — a different workspace's session, and a real document
  id requested against the wrong vendor within the same workspace

Phase 5 added:

- `lib/questionnaire/__tests__/evaluator.test.ts` — every condition operator
  (eq/neq/in/not_in/gt/lt/is_answered/is_empty), the HOST-01/HOST-02 example from
  DATA-MODEL.md §3 verbatim, the multi_select-answer overlap extension, every
  non-presence operator evaluating false against an unanswered question, `all` vs `any`
  semantics, and suppression cascading to a question whose own condition would otherwise
  be true
- `lib/questionnaire/__tests__/validate-schema.test.ts` — accepts a valid schema and a
  same-schema earlier-reference; rejects a duplicate `control_id`, a forward reference, a
  reference to a nonexistent `control_id`, and a self-reference
- `lib/services/__tests__/questionnaire-templates.test.ts` — integration, against a real
  MongoDB: draft created at version 1; duplicate `template_key` rejected; a
  forward-referencing schema rejected at creation (not only at publish); a draft can be
  edited in place, then publishing freezes it — a subsequent edit attempt throws
  `ForbiddenError` and the document is unchanged; a new version copies the published
  schema and bumps the version number; creating a second new version while a draft
  already exists is rejected; archiving a published template succeeds, archiving it
  again is rejected

Phase 6 added:

- `lib/auth/__tests__/otp.test.ts` — `generateOtpCode()` always produces a 6-digit
  zero-padded string; `hashOtpCode()` is deterministic and differs per code;
  `constantTimeEqual()` correctly matches/mismatches, including different-length inputs
  without throwing
- `lib/auth/__tests__/rate-limit.test.ts` — allows up to the max within a window, blocks
  once exceeded, keys are independent, and the window resets after it elapses (fake timers)
- `lib/services/__tests__/portal-auth.test.ts` — integration, against a real MongoDB: a
  real vendor SPOC email creates a challenge; an unregistered email resolves without error
  and writes nothing (no enumeration); rate limiting per email and per IP; a correct code
  verifies and consumes the challenge; a wrong code is rejected generically and increments
  attempts; the attempt limit locks out even the correct code; an expired challenge is
  rejected; a replayed (already-consumed) code is rejected; verifying with no active
  challenge at all fails with the same generic error as every other failure mode
- `lib/services/__tests__/assessment-assignment.test.ts` — integration, against a real
  MongoDB transaction: assigning a published template snapshots its schema verbatim and
  moves the engagement to `in_assessment`; assigning a draft or archived template is
  rejected; an engagement that belongs to a different vendor is rejected; an engagement id
  from a different workspace is rejected (tenant isolation, `NotFoundError` — the
  `TenantRepository` scope makes it invisible, not just refused)

Phase 7 added:

- `lib/storage/__tests__/local-fs.test.ts` / `s3.test.ts` — `list()` finds every key under
  a prefix including nested subdirectories (local-fs) or across pagination via
  `ContinuationToken` (S3, mocked); `delete()` removes an object and is a no-op on a
  nonexistent key (local-fs), sends a `DeleteObjectCommand` (S3, mocked)
- `lib/services/__tests__/portal-assessment.test.ts` — integration, against a real
  MongoDB and the real local-fs driver: autosave upserts idempotently (a second save for
  the same control updates, never duplicates); unknown `control_id` rejected; cross-vendor
  tampering refused (`NotFoundError`) on both read and write; evidence upload creates a
  response shell without fabricating a `response_value`; disallowed MIME, wrong
  extension, and no-evidence-config uploads all rejected; evidence retrieval is
  byte-identical and a wrong evidence id is refused; submission blocks on an unanswered
  visible required question and on missing required evidence, naming the specific
  `control_id` in both cases; **a suppressed required question does not block
  submission** (`PLAN.md` Phase 7's named exit criterion, asserted directly, not just
  implied by an evaluator-level test); a fully-satisfied submission succeeds; writes and
  a second submission are both refused once an assessment is `submitted`

Phase 9 added (test-debt closure, before any new Phase 9 code was written):

- `lib/scoring/__tests__/residual-risk.test.ts` — every severity base score and impact
  multiplier in isolation, the 70/30 inherent-score blend, the 15%-per-control discount
  capped at 50%, blank/whitespace compensating-control entries ignored, the score floor of
  1, `NaN`/non-numeric `inherent_score` treated as absent rather than zero, and the
  `calculated_at` timestamp
- `lib/services/__tests__/assessment-review.test.ts` — integration, against a real
  MongoDB: `raiseRisk()`'s residual score hand-verified against the formula and its
  `overall_score` derivation; the sum-of-constituent-risks invariant across multiple raises
  on one assessment; `updateRisk()` recomputing both scores, including that adding a
  compensating control strictly lowers the score; a status-only update leaving the score
  inputs untouched; `completeReview()`'s timestamp; `raiseRisk()` rejecting missing
  required fields before writing anything; `listWorkspaceRisks()` tenant isolation (a
  second workspace never sees the first's risks); `getAssessmentReviewData()` refusing an
  assessment outside the caller's workspace

Then Phase 9 added, in the same file's `CAP tasks` describe block:

- `createCapTask()` with `owner_type: 'vendor'` always uses the risk's own `vendor_id`,
  ignoring a deliberately different `owner_ref` sent by the caller (`DECISIONS.md` 022);
  with `owner_type: 'internal'` rejects both a nonexistent and a `disabled` `User`, and
  succeeds for a real active one
- `updateCapTask()` setting `status: 'closed'` stamps `closed_at`
- `detectAndEscalateOverdueCaps()` flips a past-due task's status to `overdue` and sends
  **exactly one** escalation email (`vi.spyOn` on the real `Mailer.send`) across two
  consecutive runs — the second run's `newly_escalated` is `false` and the send count stays
  at 1 — and never surfaces or escalates a task that's already `closed`, even past its due
  date

Phase 10 added:

- `lib/services/__tests__/offboarding.test.ts` — integration, against a real MongoDB:
  `initiateOffboarding()` creates the checklist and atomically moves
  `Engagement.status`/`Vendor.lifecycle_status` to `offboarding`; initiating twice for the
  same engagement is rejected; the full readiness state machine
  (`initiated → in_progress → verified`) walked via checklist updates and certificate
  upload/verify, with `completeOffboarding()` explicitly rejected at three intermediate
  points (nothing done, checklist done but no certificates, certificates uploaded but not
  verified) before it succeeds; on success, the `Offboarding`/`Assessment`/`Engagement`/
  `Vendor` documents all land in their correct terminal state in one assertion block; and
  the **immutability guard itself** — after archiving, `OffboardingRepository.
updateChecklistItemFields()` called directly returns `matchedCount: 0` (repository-level,
  not just the service's own check), and `updateChecklistItem()` through the service throws
- `lib/services/__tests__/assessment-review.test.ts` (new `describe` block) — once an
  assessment is archived, `raiseRisk()`, `updateRisk()`, `createCapTask()`, and
  `updateCapTask()` all throw (`ForbiddenError`, message matching `/archived/`) and none of
  them write anything — asserted by re-reading the risk afterward and confirming its
  `status` and `cap_tasks` length are unchanged

Phase 11 added:

- `lib/auth/__tests__/rbac.test.ts` — every role's exact capability set (including
  `viewer`'s empty set), and `requireCapability()` throwing `ForbiddenError` only for a
  missing capability, never a present one
- `lib/auth/__tests__/current-membership.test.ts` — integration, against a real MongoDB:
  resolves the correct role for an active membership; returns `null` for a disabled user, a
  user with no membership in the session's workspace, and a membership that existed at
  login but was later removed (proving the "resolved fresh every request" property, not
  just "resolved once at login")
- `lib/auth/__tests__/login.test.ts` (extended) — a second, different active `User` with a
  correct password now succeeds (the Phase 2 `SUPER_ADMIN_EMAIL` gate is gone,
  `DECISIONS.md` 024); a disabled user and a user with no workspace membership both still
  fail
- `lib/services/__tests__/workspace-membership.test.ts` — integration: lists only the
  workspaces a user actually has a membership in (empty for a disabled user);
  `switchWorkspace()` succeeds for a real membership, refuses a workspace the user has no
  membership in even though the caller claims it, and refuses for a disabled user even
  against a workspace they're genuinely a member of
- `lib/services/__tests__/admin-users.test.ts` — integration: a newly-added user can
  actually log in with the password an admin chose (not just that a document was written);
  adding an email that already belongs to a `User` in a sibling workspace grants a second
  membership rather than duplicating the account (still exactly one `User` document
  afterward); adding a duplicate membership in the same workspace is rejected; a role update
  is scoped to the acting workspace only, leaving a sibling workspace's membership on the
  same account untouched; removing a membership leaves the account and its other
  memberships intact; an admin cannot remove their own membership
- `lib/services/__tests__/sharing.test.ts` — integration, against a real MongoDB and the
  real local-fs storage driver (documents uploaded through the actual
  `uploadVendorDocument()` service, not fabricated fixture rows): a granted share is visible
  to the target workspace and invisible to an unrelated third workspace; sharing with the
  owner's own workspace is rejected; the authorized workspace can read the file
  byte-identical and the read writes exactly one new audit event; an unauthorized workspace
  is refused (`ForbiddenError`); revoking removes the target from `shared_with` and an
  immediately-subsequent read from that workspace is refused
- `lib/services/__tests__/executive-rollup.test.ts` — integration: a user with an `admin`
  membership in one workspace and a `viewer` membership in a second gets a roll-up that
  includes the first workspace's real vendor-tier/risk-severity counts and completely omits
  the second, with `authorized_workspace_count` (1) strictly less than
  `total_membership_count` (2); a disabled user gets an empty result

Priority coverage — these are the algorithmic cores where a silent wrong answer is worse
than a crash:

- [x] **Inherent Risk Engine** — scoring matrix over data types (PII/PHI/Financial),
      network exposure, system access level, business redundancy (Phase 3)
- [x] **Tiering & Triage** — boundary cases at every Tier 1/2/3 threshold (Phase 3)
- [x] **Unscored input** — an unscoreable intake must fail loudly, **never** default to
      Tier 3 (`FLOW.md` F1) (Phase 3, verified at both the pure-function level and by a real
      transaction leaving `inherent_risk_tier: null` in the database)
- [x] **Residual Risk Calculation** — inherent score adjusted by verified and compensating
      controls (Phase 8, `lib/scoring/residual-risk.ts` — the formula:
      `severity_base × impact_multiplier`, blended 70/30 with the engagement's inherent
      score, discounted up to 50% by compensating controls at 15% each. Unit-tested as of
      Phase 9, `lib/scoring/__tests__/residual-risk.test.ts` — every severity/impact
      combination, the blend, the discount cap, and the score floor)
- [x] **Conditional logic evaluation** — questions correctly shown/suppressed (Phase 5 built
      the evaluator; Phase 7 wired it into the real portal renderer, verified by real HTTP
      request — answering HOST-01 live reveals/hides HOST-02 exactly as authored)
- [x] **Suppressed-question validation** — a hidden question must not be flagged "empty and
      missing" and deadlock submission (`FLOW.md` F3) (Phase 7,
      `lib/services/portal-assessment.ts`'s `submitAssessment()` — verified by both
      integration test and real HTTP request with an evidence-requiring suppressed
      question)

### Assessment workflow Stage 3 — draft checklist gates

- [x] **Draft assignment semantics (focused integration):** assignment stores `draft`,
      `template_name`, a deep-cloned snapshot and null `due_date`, while leaving the
      engagement unchanged.
- [x] **Snapshot immutability boundary (focused integration):** editing a sent assessment is
      refused; invalid and forward-referencing schemas fail before persistence; tailoring
      does not modify the published template; a second assessment starts from the clean
      published schema.
- [x] **Concurrent editor protection (focused integration):** a stale `expected_updated_at`
      cannot overwrite a newer checklist save.
- [x] **Portal draft concealment (targeted integration):** the portal service excludes a
      draft from its list and returns `NotFoundError` for direct access.
- [x] **Full `npm run verify`:** format, lint, typecheck, 218/218 tests, and production
      build passed on 2026-08-19. The first two attempts exposed the pre-existing shared
      `.storage-local` cleanup race; cleanup is now workspace-scoped and the clean rerun
      passed.
- [x] **Real HTTP workflow:** authenticated assignment returned `201`/`draft`; the assessment
      stayed absent from the portal list and its direct page rendered the not-found boundary;
      add/edit/delete checklist PATCHes returned `200`; the published-template SHA-256 stayed
      `14739bec12dabcb81930e6cae8e77ca477760920fafa17c6f10fc128eb08e5ea`; a second
      assessment matched the published snapshot; and a PATCH after transitioning the first
      fixture to `sent` returned `403`. Cleanup removed two assessments, four audit events,
      and the disposable engagement.
- [x] **Playwright desktop + mobile:** `npm run test:e2e` passed 17 tests in 1.4 minutes on
      desktop Chromium and Pixel 7. The one skip is intentional: the new checklist-editor
      add/edit/save/delete/overflow journey runs only in the mobile project.

Actual Stage 3 focused output obtained on 2026-08-19:

```text
npm run typecheck
Generating route types...
✓ Types generated successfully

npm test -- --run lib/services/__tests__/assessment-assignment.test.ts
Test Files  1 passed (1)
Tests  10 passed (10)

npx vitest run lib/services/__tests__/portal-assessment.test.ts -t "conceals draft" --reporter=verbose
Test Files  1 passed (1)
Tests  1 passed | 17 skipped (18)

npm run lint
eslint

git diff --check
(exit 0; no output)

npm run test:e2e
17 passed, 1 skipped (1.4m)
```

### Assessment workflow Stage 4 — send, recipients, and history gates

- [x] Draft-only send stores selected active SPOCs, starts the workspace SLA, stamps
      `sent_at`/`last_activity_at`, advances the engagement, and audits atomically.
- [x] Invalid/cross-vendor/inactive recipient ids are refused before state changes.
- [x] Portal list and detail are scoped to signed `spocId`; legacy sent assessments without
      recipients remain usable.
- [x] History uses the shared DataTable with exactly Questionnaire, Started, Last update,
      and Status; portal/history/review queue share plain-language status labels.
- [x] Activity timestamp moves on answer, evidence add/delete, submit, risk/review updates,
      and completion.
- [x] Real HTTP: selected SPOC saw the assessment; unchecked SPOC list hid it and direct
      access rendered not-found; stored SLA was 21 days and answer autosave moved activity.
      Cleanup removed one response, audit, assessment, and engagement.
- [x] Playwright: 21 passed, 1 intentional desktop skip (56.3s), including send-modal
      recipient selection and portal scoping on desktop Chromium and Pixel 7.
- [x] `npm run verify`: 29 files, 221/221 tests, lint 0 errors/1 known advisory, typecheck
      and 35-page production build passed.

## Gate 3 — Build

```bash
npm run build            # next build — expect: "Compiled successfully", static pages generated, exit 0
```

`npm run verify` runs Gates 1–3 in sequence (format:check → lint → typecheck → test →
build) and is the single command to run before calling any phase done.

## Gate 4 — Security gates (run on ANY change touching auth, tenancy, or the portal)

Non-negotiable. These are the paths where a bug is a breach.

- [ ] **Tenant isolation:** a user in workspace A cannot read, list, or count any record in
      workspace B — verified by request, not by reading the code (repository-level only so
      far, Phases 1 and 3; no API route exercises cross-workspace isolation directly yet —
      `POST /api/vendors` always writes to the caller's own session-derived workspace, so
      there's no code path to test it against a second workspace's data through that route)
- [x] **Vendor scoping (Phase 6, extended Phase 7):** the vendor portal has no route that
      accepts a vendor id from a URL or request body at all — every
      `lib/services/portal-assessment.ts` function re-derives `vendorId` from the session
      and 404s (not 403 — indistinguishable from "doesn't exist") if the target assessment
      belongs to someone else. Verified by real HTTP request twice: at the assessment-list
      level (Phase 6 — vendor A's session lists exactly one assessment even after vendor B's
      exists) and at the answer-writing level (Phase 7 — vendor B's session gets a 404 on
      both `GET /portal/assessments/[vendor-A's-id]` and `PUT .../responses/[controlId]`
      against vendor A's assessment).
- [x] **Vendor scope source (Phase 6, `FLOW.md` F2 gap b):** `vendorId`/`workspaceId` are
      set once, server-side, from the matched `OtpChallenge` document at verify time
      (`verifyOtp()`) — never from the request body — and re-derived from the signed
      session cookie on every subsequent read. Verified by integration test and by request.
- [x] **Email enumeration (Phase 6, `FLOW.md` F2 gap a):** `POST /api/portal/auth/otp/request`
      returns a byte-identical `{"ok":true}` body for a registered SPOC email and an
      unregistered one — verified by diffing the actual response bodies from two real
      requests. Timing is a best-effort mitigation (a dummy DB read on the miss path), not
      a cryptographic constant-time guarantee (`DECISIONS.md` 019). Internal login (Phase 2)
      already returns an identical `invalid_credentials` response for both a wrong password
      and an unregistered email — verified by request, see Phase 2 feature trace.
- [x] **OTP hygiene (Phase 6):** expiry enforced explicitly (not just the TTL sweep,
      `DATA-MODEL.md` §2), attempt limit enforced (5, locks out even the _correct_ code
      once exceeded), no reuse after a successful login (replay rejected) — all verified by
      integration test and by real HTTP request, including exhausting the attempt limit
      with wrong codes and then presenting the real code from the dev console log.
- [x] **OTP request rate limiting (Phase 6, `PLAN.md` Phase 6 item 5):** per-email and
      per-IP caps, verified by real HTTP request — the 5th request for one email succeeds,
      the 6th returns 429; the same holds per IP across 20 different emails.
- [x] **Evidence file access (Phase 4):** the download route (`app/api/vendors/[id]/
documents/[documentId]/route.ts`) requires a valid session (401 without one,
      verified by real HTTP request) and re-derives authorization from the vendor's own
      `documents` array, never a raw key — a real document id requested against the wrong
      vendor or the wrong workspace's session returns 404, verified by both an integration
      test (`lib/services/__tests__/vendor-documents.test.ts`) and a real HTTP request
      against a running dev server. Vendor-portal cross-vendor scoping is covered by the
      "Vendor scoping" item above. Evidence-upload-within-the-portal access follows the
      identical pattern (Phase 7,
      `lib/services/__tests__/portal-assessment.test.ts`'s evidence-retrieval tests).
- [x] **Internal auth (Phase 2, new item):** no `(internal)` route or protected API is
      reachable without a valid session — `proxy.ts` fails closed by default with an
      explicit public allowlist (`DECISIONS.md` 012). Verified by request: unauthenticated
      access to `/dashboard` redirects to `/login`; to a protected API returns 401 JSON; a
      tampered session cookie is rejected identically to a missing one; login sets an
      `HttpOnly`, `SameSite=Lax` cookie; logout clears it and protection re-engages
      immediately. See the Phase 2 feature trace for the full request transcript.
- [x] **No secrets** in the diff — grepped for the test password, hash, and session secret
      used during Phase 2 verification; all confined to the gitignored `.env.local`, none
      in any tracked-looking file
- [x] **RBAC capability enforcement (Phase 11):** a `business_owner` session is refused
      (403, naming the missing capability) when it attempts a `template.manage`-gated write
      (`POST /api/templates`) — verified by real HTTP request. A `risk_analyst` session is
      refused (403) switching to a workspace it has no membership in, even though it
      supplies that workspace's real id (`POST /api/auth/switch-workspace`) — verified by
      real HTTP request.
- [x] **Dynamic role resolution, both directions (Phase 11):** promoting a user's role
      mid-session (same signed cookie, no re-login) immediately grants the new capability on
      the very next request; demoting immediately revokes it on the next request after
      that — verified by real HTTP request against a running dev server (see
      `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`).
- [x] **Cross-workspace sharing is a manual, explicit grant, never implicit (Phase 11):** a
      document shared from workspace A to workspace B is downloadable byte-identical from a
      workspace-B session and refused (403) from an unrelated third workspace's session —
      verified by real HTTP request. Revoking the grant refuses a subsequent read from the
      previously-authorized workspace, verified in the same pass.

## Gate 5 — Data integrity gates (run on any schema or template change)

- [x] **Historical assessments render against the exact template version they were
      answered under** (Phase 7): the portal page reads `template_snapshot`, never the
      live `QuestionnaireTemplate` document — verified by real HTTP request (a template
      created, published, and assigned; the assessment renders and accepts answers
      identically regardless of what the template document does afterward, since nothing
      in the answering path ever queries it again).
- [x] **No mutation of a published or archived template version** (Phase 5): the repository
      write (`TemplateRepository.updateDraft()`) scopes its own filter to `status: 'draft'`,
      so the write is structurally impossible against a non-draft document, not merely
      gated by a service check — verified by integration test
      (`lib/services/__tests__/questionnaire-templates.test.ts`) and by real HTTP request
      (a `PATCH` against a published template returns 403, and the document is unchanged).
- [x] **Assessment carries a frozen `template_snapshot`, not a reference** (Phase 6):
      `assignAssessment()` deep-clones `questions_schema` at assignment time; verified by
      integration test that the stored snapshot equals the source schema exactly.
- [x] **Archived offboarding records, audit trails, and remediation logs remain unaltered**
      (Phase 10): `completeOffboarding()` is the sole writer of `status: 'archived'` on both
      `Offboarding` and `Assessment`; every write method on `OffboardingRepository` and
      `AssessmentRepository.archive()` scopes its own filter to exclude already-archived
      documents (structural, same mechanism as Phase 5's template-immutability filter), and
      `AssessmentReviewService`'s risk/CAP-task write paths gained the same guard
      (`DECISIONS.md` 023). Verified by integration test
      (`lib/services/__tests__/offboarding.test.ts`,
      `lib/services/__tests__/assessment-review.test.ts`) and by real HTTP request: after
      archiving, a checklist-item update returns 422, a `raiseRisk()` call against the
      archived assessment returns 403, and a second `complete` call returns 422.
- [x] **A `SharedDocument` grant is the only exception to tenant isolation, and it is
      re-verified from the database on every read, not cached** (Phase 11): revoking a share
      immediately refuses a subsequent read from the previously-authorized workspace —
      verified by integration test (`lib/services/__tests__/sharing.test.ts`) and by real
      HTTP request.
- [ ] Migrations are reversible, and the reverse was actually tested (not applicable yet —
      no migration has been needed)

### Assessment workflow Stage 5 — review and correction-round gates

- [x] Verdict and reviewer note persist; first mark advances submitted to under review.
- [x] Resend refuses zero non-compliant responses and query-guards eligible source status.
- [x] Correction-round portal writes refuse compliant controls at the service boundary.
- [x] Completion lists unmarked controls and non-compliant controls without risks, then
      succeeds after the risk exists.
- [x] Shared 400 ms autosave flushes before resend/complete and exposes saved/error state.
- [x] `npm run verify`: 29 test files, 225 tests, typecheck and 35-page build passed.
- [x] `npm run test:e2e`: 23 passed on desktop/mobile, one intentional desktop skip.

## Gate 6 — Manual smoke path (run before any release)

- [x] Internal login → submit intake → tier assigned and visible in inventory (Phase 3, by
      real HTTP request against a running dev server — see
      `docs/features/phase-3-vendor-intake-and-tiering.md`)
- [x] Vendor detail page → edit SPOC → change persists and re-renders; upload a document →
      appears in the list → download returns byte-identical content; unauthenticated
      download returns 401; a well-formed but nonexistent document id returns 404 (Phase 4,
      by real HTTP request against a running dev server — see
      `docs/features/phase-4-vendor-spoc-and-storage.md`)
- [x] Create a template (draft) → edit it in place → publish → edit attempt refused (403) →
      create a new version → attempt a second new version while the first is still a draft
      (refused, 422) → archive the draft version → archive it again (refused, 422) →
      templates list shows the latest version per `template_key` (Phase 5, by real HTTP
      request against a running dev server — see
      `docs/features/phase-5-template-builder-and-versioning.md`)
- [x] Assign a published template to an engagement → assessment appears on the vendor
      detail page → SPOC requests an OTP (identical response for a real vs. fake email) →
      reads the code from the dev console transport → verifies → portal session set → sees
      exactly their own assessment (confirmed against a second vendor's assessment
      existing) → logs out → session cleared. Also: wrong code refused, attempt limit
      locks out even the correct code, replaying a consumed code is refused, and both
      per-email and per-IP request rate limits trigger a 429 (Phase 6, by real HTTP
      request against a running dev server — see
      `docs/features/phase-6-assessment-assignment-and-otp-portal-auth.md`).
- [x] **Full SPOC round trip** (`PLAN.md` Phase 7 exit criterion): OTP login → answer
      HOST-01 → conditional follow-up HOST-02 appears live only on the "Cloud" branch →
      submit without answering HOST-02 refused (422, names both the unanswered question
      and its missing evidence) → answer HOST-02 and upload its required evidence → submit
      succeeds → evidence downloads byte-identical → further edits and a second submission
      are both refused (403) → a second vendor cannot read or write the first vendor's
      assessment (404) → `scripts/sweep-orphaned-evidence.ts` correctly reports zero
      orphans, then correctly detects and (with `--delete`) removes a deliberately-created
      one (Phase 7, by real HTTP request against a running dev server — see
      `docs/features/phase-7-questionnaire-answering-evidence-upload-validation.md`).
- [x] **Reviewer raises a risk → residual score computed → register lists it → assessment
      score agrees with the sum of its constituent risks** (Phase 8 exit criterion, by real
      HTTP request against a running dev server — see
      `docs/features/phase-8-review-risk-register-residual-scoring.md`).
- [x] **CAP task created with a past due date → overdue queue endpoint flags it `overdue`
      and sends exactly one escalation email → a second call to the same endpoint does not
      re-send** (Phase 9 exit criterion, by real HTTP request against a running dev server:
      created a CAP task owned by the vendor SPOC with `due_date: 2020-01-01`, first
      `GET /api/risks/cap-tasks/overdue` call returned `newly_escalated: true` and the dev
      console mail log showed exactly one `[mail:console]` entry addressed to the vendor's
      SPOC email; second call returned `newly_escalated: false` and the console log still
      showed exactly one entry total; closing the task via `PATCH .../cap-tasks/[taskId]`
      removed it from the overdue queue on the next call even though its due date remained
      in the past; the unauthenticated request was refused with 401 — see
      `docs/features/phase-9-cap-tracking-and-mitigation-guidance.md`).
- [x] **Offboarding checklist completes → certificates stored and verified → records
      archived** (Phase 10 exit criterion, by real HTTP request against a running dev
      server: initiated offboarding on a disposable smoke-test engagement → attempted
      `complete` at three points before it was ready, each correctly refused with 422 (no
      checklist items done; checklist done but no certificates; certificates uploaded but
      not verified) → uploaded both certificates, downloaded one back and confirmed it was
      byte-identical → verified both → `complete` succeeded → confirmed the `Offboarding`,
      `Assessment`, `Engagement`, and `Vendor` documents all landed in their correct
      terminal state (`archived`/`archived`/`closed`/`terminated`) → confirmed the archived
      assessment still renders via the review endpoint → confirmed `raiseRisk()` against it
      now returns 403 → confirmed a second `complete` call and a checklist-item mutation
      attempt both return 422 → confirmed the unauthenticated request is refused with 401 —
      see `docs/features/phase-10-offboarding-destruction-certificates-archiving.md`).
- [x] **Multi-workspace RBAC and sharing** (Phase 11 exit criteria, by real HTTP request
      against a running dev server, three fixture accounts of different roles plus one
      multi-workspace admin, no re-login between role changes): logged in as three different
      active users simultaneously (multi-user login confirmed) → listed memberships and
      switched a multi-workspace account between two real workspaces, and confirmed a
      single-workspace account is refused switching to a workspace it isn't a member of →
      confirmed a `business_owner` is refused a `template.manage`-gated write (403, names the
      missing capability) → promoted that account to `risk_analyst` mid-session and the same
      cookie immediately gained the capability, then demoted it back and the same cookie
      immediately lost it again — no re-login either direction → shared a real uploaded
      vendor document from one workspace to another, confirmed byte-identical download from
      the authorized workspace and a 403 from an unrelated one, then revoked it and confirmed
      the previously-authorized workspace was refused too → confirmed every one of these
      routes returns 401 unauthenticated. See
      `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`.
- [x] **Executive roll-up aggregates only authorized workspaces** (Phase 11 exit criterion,
      by real HTTP request against a running dev server: a user with an `admin` membership
      in the default workspace and an `admin` membership in a second (`beta`) workspace saw
      both workspaces' real counts in `GET /api/rollup`; a `risk_analyst` (one membership,
      `rollup.view` capability) saw exactly that one workspace; a `business_owner` (one
      membership, no `rollup.view` capability) saw an empty `workspaces` array with
      `authorized_workspace_count: 0` while `total_membership_count` correctly still read 1
      — see `docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`).

---

## Reporting template

```
Gates run: 0, 1, 2, 4
Skipped:   3 (no build config yet), 5 (no schema change), 6 (not a release)
Result:    Gate 2 FAILED — 1 of 34 tests failing

$ npm test
  <actual pasted output>
```
