# FLOW.md — How Execution Travels

> Guide habit 4. Bugs live in the gaps between files. This file records what calls what,
> in what order, and **which parts of that path are being modified right now**.
>
> **STATUS: PLANNED FLOWS — NO CODE EXISTS YET (2026-08-13).** The sequences below are
> intended execution paths derived from the spec, with no file paths attached because no
> files exist. As each flow is built, replace the prose steps with real
> `path/to/file.ts:function` references — a flow without file references is a sketch, not
> a trace.

---

## Currently in flight

| Flow     | Files being modified | Session | Status |
| -------- | -------------------- | ------- | ------ |
| _(none)_ | —                    | —       | —      |

Keep this table honest. An empty table means nobody is mid-change.

---

## F1 — Vendor intake → inherent risk tier ✅ BUILT (Phase 3, 2026-08-14)

Trigger: internal business owner submits the self-service intake form.

1. `components/vendor-intake-form.tsx` (`app/(internal)/vendors/new/page.tsx`) submits to
   `POST /api/vendors`.
2. `app/api/vendors/route.ts` re-derives the session via `getCurrentSession()`
   (`lib/auth/current-session.ts`) — `workspace_id` and the actor come from the session,
   never a request field — then validates the body with `intakeRequestSchema` (Zod).
3. The route calls `submitVendorIntake()` (`lib/services/vendor-intake.ts`), the only
   caller of everything below.
4. `WorkspaceRepository.findById()` (`lib/repositories/workspace-repository.ts`) resolves
   `workspace.settings.risk_weights` / `tier_thresholds`.
5. **Inherent Risk Engine** — `scoreEngagement()` (`lib/scoring/inherent-risk.ts`) sums
   weighted contributions across the four factors (data classification is multi-select and
   summed; the other three are single-value lookups).
6. **Tiering & Triage** — `tierFromScore()` / `scoreAndTierEngagement()`
   (`lib/scoring/inherent-risk.ts`) map the total to Tier 1/2/3 against
   `tier_thresholds`, or return `{ status: 'scoring_failed', reason }`.
7. `submitVendorIntake()` opens one `mongoose.startSession()` /
   `session.withTransaction()` and writes the **Vendor** (`VendorRepository.create()`) and
   **Engagement** (`EngagementRepository.create()`) atomically, both stamped with
   `workspace_id` by `TenantRepository.create()` (`lib/repositories/base.ts`). An
   `engagement.intake_submitted` audit event is recorded in the same transaction
   (`lib/audit/record-event.ts`).
8. `app/(internal)/vendors/page.tsx` (Server Component) reads both collections directly via
   their repositories and renders the inventory, tier shown as a `TierBadge`.

**Gap resolved:** steps 5→6. `scoreAndTierEngagement()` returns a discriminated union —
`{ status: 'tiered', tier }` or `{ status: 'scoring_failed', reason }` — never a bare
number-or-null, so there is no code path that could silently collapse an unscoreable input
into Tier 3. Verified by unit test at both tier boundaries and the unscoreable case
(`lib/scoring/__tests__/inherent-risk.test.ts`) and by integration test against a real
MongoDB transaction (`lib/services/__tests__/vendor-intake.test.ts`) — see
`docs/features/phase-3-vendor-intake-and-tiering.md`.

## F2 — Vendor SPOC authentication (external, highest-risk path) ✅ BUILT (Phase 6, 2026-08-14; SPOC-scoped since Stage 2, 2026-08-19)

1. SPOC enters email on the vendor portal login page —
   `components/portal-otp-login-form.tsx` (`app/(portal)/portal/login/page.tsx`) posts to
   `POST /api/portal/auth/otp/request`.
2. `requestOtp()` (`lib/services/portal-auth.ts`) rate-limits by email and IP
   (`lib/auth/rate-limit.ts`), then looks up the email against `Vendor.spocs[]`
   (`findVendorBySpocEmail()`, `lib/auth/otp-challenge.ts` — the one deliberately
   non-workspace-prefixed index, `DATA-MODEL.md` §2) — **only an `active` entry matches**;
   an `inactive` SPOC's email behaves identically to an unregistered one.
3. If matched: OTP generated (`generateOtpCode()`), hashed with `OTP_HMAC_SECRET`
   (`hashOtpCode()`, `lib/auth/otp.ts`), stored with a 10-minute expiry alongside the
   matched SPOC's own id (`issueOtpChallenge()`, `spoc_id`), and emailed to that SPOC's
   address via `lib/mail/` (console transport in dev). If unmatched (including an inactive
   SPOC): a dummy database read of comparable shape (`dummyOtpLookupForTiming()`) runs
   instead, and the route returns the exact same `{ ok: true }` body either way.
4. SPOC submits the code → `POST /api/portal/auth/otp/verify` →`verifyOtp()` re-checks
   `expires_at` explicitly (not just the TTL sweep), enforces the 5-attempt limit, compares
   the hash in constant time (`constantTimeEqual()`), and **re-verifies the matched SPOC is
   still `active`** — a SPOC deactivated between request and verify cannot complete login
   with an already-issued code.
5. On success, the challenge is consumed (`consumeOtpChallenge()` — single-use, no replay)
   and a session is signed scoped to that **one** `vendor_id` + `workspace_id` + `spocId`
   (`createPortalSessionToken()`, `lib/auth/portal-session.ts` — a structurally separate
   module from the internal session, not a shared signer). `spocId` is not read by anything
   yet — `FLOW.md` F3 step 1's Stage 4 (recipient scoping) is its first reader.
6. Every subsequent portal request re-derives the vendor scope from the session cookie
   (`getCurrentPortalSession()`, `lib/auth/current-portal-session.ts`), never from a URL or
   body parameter. `proxy.ts`'s portal branch and the internal branch share no code path.

Gaps resolved: (a) email enumeration — verified by real HTTP request, the response body
for a registered vs. unregistered email is byte-identical (best-effort timing mitigation
only, `DECISIONS.md` 019 — not a cryptographic constant-time guarantee); this now also
covers a deactivated SPOC's email, verified identically; (b) vendor scope is set once at
OTP-verify time from the challenge document and re-derived from the session on every read,
never from a client parameter — verified with two vendors coexisting, one session's
assessment list unaffected by the other's; (c) OTP replay — verified, a consumed code is
rejected on reuse. All verified by integration test
(`lib/services/__tests__/portal-auth.test.ts`) and by real HTTP request — see
`docs/features/phase-6-assessment-assignment-and-otp-portal-auth.md` and
`docs/features/assessment-workflow-stage-2-multi-spoc.md`.

## F3 — Questionnaire assignment → submission ✅ BUILT end to end (Phases 5–7, 2026-08-14)

**Template lifecycle (steps 0a–0c) ✅ BUILT (Phase 5). Assignment (steps 1–2) ✅ BUILT
(Phase 6). Portal rendering through submission (steps 3–8) ✅ BUILT (Phase 7).**

0a. Template CRUD, `draft → published → archived` lifecycle —
`lib/services/questionnaire-templates.ts`, `lib/repositories/template-repository.ts`.
0b. **Conditional-logic expression format and evaluator** — the contract in
`DATA-MODEL.md` §3, implemented as pure functions in `lib/questionnaire/evaluator.ts`
(`computeVisibility`, single-pass, declaration-order) and validated structurally
(`lib/questionnaire/validate-schema.ts` — control_id uniqueness, no forward
references) before every save, not only at publish.
0c. **Builder preview renders through that same evaluator** —
`components/questionnaire/questionnaire-preview.tsx` and `question-renderer.tsx` are
the one rendering path both the builder's preview tab and (Phase 7) the vendor portal
will use, so they cannot diverge.

1. Internal user selects a **Questionnaire Template** version and assigns an assessment
   to an engagement — `components/assessments/assign-assessment-form.tsx`
   (`app/(internal)/vendors/[id]/page.tsx`) posts to `POST /api/vendors/[id]/assessments`.
   Only a `published` template may be assigned (`assignAssessment()`,
   `lib/services/assessment-assignment.ts`).
2. **Risk Assessment** record created, pinned to `template_id` + `version`, with a
   deep-cloned `template_snapshot` and `template_name` (`DATA-MODEL.md` §3 — "why snapshot
   rather than reference"). Stage 3 creates it as `draft`, leaves `due_date` null, and does
   not advance the engagement. Internal users may tailor that snapshot through the shared
   question editor; the repository query itself permits updates only while status is draft,
   and the update/audit pair is transactional (`DECISIONS.md` 043). The send dialog selects
   active vendor SPOCs and `POST /api/assessments/[id]/send` atomically freezes the draft,
   stamps `sent_at`/`due_date`/`last_activity_at`, records recipients, audits the send, and
   advances the engagement to `in_assessment` (`DECISIONS.md` 044).
3. SPOC opens the assessment in the portal — `app/(portal)/portal/assessments/[id]/page.tsx`
   fetches via `getAssessmentForAnswering()` (`lib/services/portal-assessment.ts`,
   vendor/workspace/recipient-scoped, 404 on tampering, drafts, or an unchecked SPOC; the
   portal list applies the same recipient boundary) and renders `template_snapshot` through
   `AssessmentAnswerForm` (`components/portal/assessment-answer-form.tsx`), reusing the
   exact `question-renderer.tsx` the Phase 5 builder preview uses.
4. **Dynamic Conditional Logic** shows/suppresses follow-ups live as the SPOC answers —
   `computeVisibility()` (Phase 5) recomputed client-side on every keystroke/selection, so
   the rendered form and the eventual submission validation (step 7) can never disagree.
5. Responses persist per `control_id` as **Question / Control Response** documents —
   `saveResponse()` autosaves via `PUT /api/portal/assessments/[id]/responses/[controlId]`
   (debounced client-side), an idempotent upsert on the `{workspace_id, assessment_id,
control_id}` unique index.
6. Evidence uploads go through the storage module (✅ BUILT, Phase 4) via `uploadEvidence()`
   — `POST .../responses/[controlId]/evidence` — key namespaced
   `<workspace_id>/assessments/<assessment_id>/<control_id>/<uuid>-<filename>`, the metadata
   pushed onto the response's `evidence` array. Retrieval is an authorised proxy route
   (`GET .../evidence/[evidenceId]`), same discipline as Phase 4's vendor-document download.
7. **Response Validation & Pre-Screening** — `submitAssessment()` walks every question in
   the snapshot, skips any the freshly-recomputed `computeVisibility()` marks suppressed,
   and only then checks `required`/`evidence.required` on what's left — blocks submission
   with the specific missing `control_id`s, never a generic "incomplete."
8. On submit, `status` advances to `submitted` and `submitted_at` is stamped — writes are
   refused (`ForbiddenError`) on any assessment not in `sent`/`in_progress`, so neither
   further answers nor a second submission can land after this point.

**Gaps resolved:** step 4 vs step 7 — verified by real HTTP request with a genuinely
suppressed required question (evidence-requiring, no less) left unanswered: submission
succeeded. `Response.is_suppressed` itself is **not** how this was solved —
`DECISIONS.md` 020 records that the stored flag is never written; visibility is
recomputed fresh at submission time instead. Step 6's orphan-handling gap — verified by
`scripts/sweep-orphaned-evidence.ts` against a real deliberately-orphaned file (dry-run
reports it, `--delete` removes it).

## F4 — Review → risk register → remediation ✅ BUILT (Phases 8–9, 2026-08-16)

1. Internal reviewer opens the submitted assessment (`GET /api/assessments/[id]/review`,
   `AssessmentReviewService.getAssessmentReviewData()` — recomputes question visibility
   live via `computeVisibility()`, same as Phase 7's submission path, since
   `Response.is_suppressed` is never trustworthy — `DECISIONS.md` 020).
2. Failed or exception responses are raised as **Identified Risk** records
   (`POST /api/assessments/[id]/risks`, `raiseRisk()`).
3. **Unified Risk Register Mapping** links each `control_id` to an enterprise risk
   category and impact level — category list is a seeded placeholder
   (`DEFAULT_ENTERPRISE_RISK_CATEGORIES`), flagged `Provisional` in the UI; taxonomy
   ownership is still an open question (`ARCHITECTURE.md` §7).
4. **Residual Risk Calculation** combines inherent score with verified controls and
   compensating measures → `residual_score` (`lib/scoring/residual-risk.ts`,
   `calculateResidualScore()` — pure function, no automated test yet, see
   `TEST-CHECKLIST.md` Gate 2).
5. **Out-of-the-Box Mitigation Guidance** attaches suggested remediation for the matched
   control failure — matched by `control_pattern` prefix against the seeded
   `MitigationGuidance` library, shown to the reviewer before they raise a risk.
6. **CAP tracking and escalation ✅ BUILT (Phase 9).** `AssessmentReviewService.createCapTask()`
   (`POST /api/risks/[id]/cap-tasks`) appends a task to the risk's embedded `cap_tasks`,
   owned either by an internal `User` (existence/active-status checked at creation) or the
   risk's own vendor SPOC (`owner_ref` always forced to the risk's `vendor_id` — see
   `DECISIONS.md` 022 — never a caller-supplied vendor). `updateCapTask()`
   (`PATCH .../cap-tasks/[taskId]`) changes status/description/due date and stamps
   `closed_at` when closed. Overdue detection and escalation are **request-driven, no job
   runner** (`detectAndEscalateOverdueCaps()`, `GET /api/risks/cap-tasks/overdue`): every
   call flips any past-due, non-closed task's status to `overdue` and sends exactly one
   escalation email (via `lib/mail`, to the internal owner's `User.email` or the vendor's
   `spoc.spoc_email`) — idempotent across repeated calls because it only sends when
   `cap_tasks[].escalated_at` is still null, then stamps it (`DECISIONS.md` 022).
7. Assessment `overall_score` recomputed from constituent risks.

Gap resolved (was: "steps 4 and 7 both write scores — define which is authoritative"):
`risk.residual_score` is authoritative and computed on risk write (step 4);
`assessment.overall_score` (step 7) is **derived** — recomputed as the sum of the
assessment's own risks' `residual_score`, in the same service call that writes or updates a
risk (`raiseRisk()`/`updateRisk()`), never independently. One writer, one direction — the
register and the assessment cannot disagree by construction. Verified by real HTTP request,
not just by reading the code — see
`docs/features/phase-8-review-risk-register-residual-scoring.md` §9.

## F5 — Offboarding → data destruction → archive ✅ BUILT (Phase 10, 2026-08-17)

1. An internal user initiates offboarding from the vendor detail page —
   `components/offboarding/offboarding-panel.tsx`
   (`app/(internal)/vendors/[id]/page.tsx`) posts to
   `POST /api/vendors/[id]/engagements/[engagementId]/offboarding`, which calls
   `initiateOffboarding()` (`lib/services/offboarding.ts`). One `mongoose.startSession()` /
   `withTransaction()` (same shape as Phase 3's intake write) creates the **Offboarding**
   record with its seeded checklist and atomically moves `Engagement.status → 'offboarding'`
   and `Vendor.lifecycle_status → 'offboarding'`. Refused if offboarding was already
   initiated for that engagement (the collection's `{workspace_id, engagement_id}` unique
   index backs this, `updateChecklistItem()` also refuses once already `offboarding`/`closed`).
2. **Multi-stage checklist** — each item has an internal owner (`User._id`, same raw-id
   input pattern as Phase 9's CAP task dialog, `DECISIONS.md` 013) and a status
   (`pending`/`in_progress`/`done`). `updateChecklistItem()`
   (`PATCH /api/offboarding/[id]/checklist/[itemId]`) flips one item via
   `OffboardingRepository.updateChecklistItemFields()`'s `arrayFilters` update (same
   mechanism as Phase 9's `cap_tasks` field updates) and stamps `completed_at` when `done`.
3. **Certificate of Data Destruction and Asset Return Attestation** — uploaded through the
   Phase 4 storage module exactly like vendor documents
   (`uploadOffboardingCertificate()`/`GET|POST /api/offboarding/[id]/certificate/[kind]`,
   key namespaced `<workspace_id>/offboarding/<offboarding_id>/<kind>/<uuid>-<filename>`).
   `verifyOffboardingCertificate()` (`PATCH .../certificate/[kind]/verify`) stamps
   `verified_by`/`verified_at`, refusing an unuploaded certificate.
4. Every checklist/certificate write calls `refreshReadiness()`, which advances
   `Offboarding.status` forward-only: `initiated → in_progress → verified` once every
   checklist item is `done` **and** both certificates are verified. `completeOffboarding()`
   (`POST /api/offboarding/[id]/complete`) refuses to run unless `status === 'verified'`.
5. **On completion — the terminal, irreversible step.** One transaction:
   `OffboardingRepository.advanceStatus(..., 'archived')`, `AssessmentRepository.archive()`
   for every non-archived assessment under the engagement, `Engagement.status → 'closed'`,
   `Vendor.lifecycle_status → 'terminated'`. **Immutability is structural, not just a
   service-layer check** (`CONSTRAINTS.md` #12, `DECISIONS.md` 023): every write method on
   `OffboardingRepository` and `AssessmentRepository.archive()` filters its own query to
   exclude `status: 'archived'`, so a stale reference to an already-archived record matches
   zero documents. `AssessmentReviewService.raiseRisk()`/`updateRisk()`/`createCapTask()`/
   `updateCapTask()` gained the same guard (`assertAssessmentNotArchived()`) since risks and
   CAP tasks are "remediation logs" too.

Gap resolved: step 4 (this file's old numbering) — assessments keep their own
`template_snapshot` (Phase 6) untouched by archival, so a re-render after archiving is
identical to before it; verified by real HTTP request (`GET /api/assessments/[id]/review`
against an archived assessment still returns its full `template_snapshot`-derived question
list). See `docs/features/phase-10-offboarding-destruction-certificates-archiving.md`.

## F6 — Multi-workspace RBAC, sharing, and cross-workspace roll-up ✅ BUILT (Phase 11, 2026-08-17)

**RBAC core:**

1. `login()` (`lib/auth/login.ts`) authenticates any active `User` whose password matches —
   the Phase 2 `SUPER_ADMIN_EMAIL` gate (`DECISIONS.md` 013) is removed (`DECISIONS.md` 024).
2. Every authorization-sensitive route calls
   `requireCurrentMembershipWithCapability(capability)` (`lib/auth/require-capability.ts`),
   which resolves `getCurrentMembership()` (`lib/auth/current-membership.ts`) — a fresh
   `User.findOne()` read against the session's `userId`/`workspaceId` on **every request**,
   never a cached role in the signed cookie — then checks the resolved role against
   `lib/auth/rbac.ts`'s capability matrix (`roleHasCapability()`/`requireCapability()`).
   Applied across all pre-existing vendor/template/assessment/risk/cap/offboarding routes.
3. `POST /api/auth/switch-workspace` (`switchWorkspace()`,
   `lib/services/workspace-membership.ts`) re-derives membership from the database before
   changing the session's `workspaceId` — never trusts the caller's claim of belonging to
   the target workspace. `GET /api/auth/memberships` (`listMembershipsForUser()`) powers the
   workspace switcher UI (`components/workspace-switcher.tsx`).
4. Admin user/membership management — `lib/services/admin-users.ts` +
   `app/api/admin/users/**` (gated by `workspace.manage_users`): list, add (existing email
   gets a new membership, not a duplicate account), change role, remove membership (never
   the account itself).

**Sharing (the one sanctioned cross-tenant read path, `DATA-MODEL.md` §2):**

5. `POST /api/sharing` (`shareVendorDocument()`, `lib/services/sharing.ts`, gated by
   `sharing.manage`) grants one specific `Vendor.documents[]` entry to one or more target
   workspaces, upserting a `SharedDocument` (unused since Phase 1) keyed by
   `(owner_workspace_id, vendor_domain, document_ref)`.
6. `GET /api/sharing/available` (`listSharesAvailableToMe()`) — the one query in the
   codebase that filters on `shared_with` rather than the caller's own `workspace_id`, a
   deliberate, narrow exception to `CONSTRAINTS.md` #8.
7. `GET /api/sharing/[id]/download` (`readSharedDocument()`) re-verifies the requesting
   workspace is still in `shared_with` and not expired **from the database**, not from
   whatever list the client is looking at, before reading the file via a `VendorRepository`
   scoped to the _owner's_ workspace (the grant is the authorization here, not the session).
   Every call unconditionally writes an audit event (`sharing.document_read`).
8. `DELETE /api/sharing/[id]` (`revokeVendorDocumentShare()`) removes one target workspace
   from `shared_with`; a subsequent read from that workspace is refused immediately.

**Executive roll-up:**

9. `GET /api/rollup` (`getExecutiveRollup()`, `lib/services/executive-rollup.ts`, gated by
   `rollup.view`) takes a bare `userId`, not a `TenantContext` — it walks every membership
   the user holds and includes a workspace in the aggregated result **only if that specific
   membership's own role** has `rollup.view`, decided inside the loop, never once at the top
   for the whole request.

Gap resolved (was: "Authorization must be enforced per workspace, not once at the top"):
verified by real HTTP request with a user holding an `admin` membership in one workspace and
a `viewer` membership in a second — the roll-up response included the first workspace's
real vendor/risk counts and omitted the second entirely, and `authorized_workspace_count`
(1) was strictly less than `total_membership_count` (2). See
`docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`.

## F7 — Per-control review and correction round ✅ BUILT (Stage 5, 2026-08-19)

1. Reviewer marks every visible response compliant or non-compliant; the shared 400 ms
   autosave persists verdict and note and advances `submitted → under_review`. The client
   keeps this orchestration in `assessment-review-client.tsx`, while reducer-owned state is
   rendered through `review/ReviewSection` and memoized `review/ReviewQuestionRow` components
   (`DECISIONS.md` 046); the request and service path is unchanged.
2. Request changes refuses an empty non-compliant set, then query-guards the source status,
   increments `review_round`, stamps the reviewer, audits, emails recipients, and moves to
   `changes_requested`.
3. Portal renders compliant controls locked and only non-compliant controls editable. The
   same boundary is rechecked by answer and evidence services, so crafted requests fail.
4. Resubmit validates only the correction set, returns to `submitted`, and emails the
   reviewer who requested changes.
5. Completion refuses visible unmarked controls and non-compliant controls without a linked
   risk; after those gates pass it completes through the existing scoring/review path.
