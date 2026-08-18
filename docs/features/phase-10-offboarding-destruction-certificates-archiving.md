# Feature: Phase 10 — Offboarding, destruction certificates, archiving

|                    |                                        |
| ------------------ | -------------------------------------- |
| **Status**         | done                                   |
| **Owner**          | AI session, at project owner's request |
| **Started**        | 2026-08-17                             |
| **Spec reference** | `PLAN.md` Phase 10; `FLOW.md` F5       |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)    |

## 1. Scope

A multi-stage offboarding checklist per engagement, owner-assigned internally
(`Offboarding.checklist`), plus upload and verification of a Certificate of Data
Destruction and an Asset Return Attestation through the Phase 4 storage module. On
completion, an atomic transition archives the offboarding record and every one of the
engagement's assessments, closes the engagement, and terminates the vendor's lifecycle
status. **The archive is genuinely immutable, not just labeled so** — every write method
on the two repositories involved structurally excludes an already-archived document from
its own filter, and the Phase 8/9 risk/CAP-task write paths gained an explicit guard so an
archived assessment's remediation history can't be edited around the side either
(`DECISIONS.md` 023).

Does **not** include: a retention/expiry or hard-delete path (deliberately — `PLAN.md`
§1's own default is "indefinite, nothing is deleted"; `ARCHITECTURE.md` §7's retention
question is resolved to that default, not a real policy), a checklist-item owner picker UI
(same raw `User._id` text-input pattern as Phase 9's CAP dialog, `DECISIONS.md` 013), or
any change to `Offboarding`'s schema — the model existed unused since Phase 1 and matched
`DATA-MODEL.md` §2 exactly, so nothing needed to change there.

## 2. Why

Closes `FLOW.md` F5, the last unbuilt end-to-end flow besides the Phase 11 roll-up. Without
this, an offboarded vendor's data-destruction attestations exist only as an email
attachment somewhere, and the system of record can't answer "did we verify this vendor's
data was actually destroyed" — the exact risk `PLAN.md` §1 names as the point of the whole
project ("prevents data-retention risk at contract termination").

## 3. Plan

Presented to the project owner before writing code (`CONSTRAINTS.md` #14):

1. `OffboardingRepository` (new) — checklist push/update via `arrayFilters` (same pattern
   as Phase 9's `cap_tasks` updates), certificate upload/verify, and status-transition
   methods each filtered to their allowed _from_ status, so an archived document is
   structurally unwritable through this class — mirrors `TemplateRepository`'s
   publish-immutability mechanism.
2. `AssessmentRepository.archive()` — the sole writer of `status: 'archived'`.
3. **New, not previously needed:** a guard on `AssessmentReviewService.raiseRisk()`/
   `updateRisk()`/`createCapTask()`/`updateCapTask()` refusing once their assessment is
   archived — nothing before this phase could archive an assessment, so nothing checked.
4. `lib/services/offboarding.ts` — `initiateOffboarding()` (atomic checklist creation +
   engagement/vendor state transition), `updateChecklistItem()`, certificate upload/verify
   (reusing the Phase 4 storage module), and `completeOffboarding()` — the terminal,
   all-or-nothing archive transaction, gated on a `verified` readiness state computed from
   the checklist and both certificates.
5. API routes under `/api/offboarding/**` plus one nested under the vendor detail page's
   existing `/api/vendors/[id]/...` convention for initiate/fetch.
6. An offboarding panel added to the existing vendor detail page, per engagement.

Approved as described; no plan changes mid-flight.

## 4. Flow impact

`FLOW.md` F5, now fully built — see the flow file for real function/route references. F5
is the third (after F3, F4) fully-✅-BUILT flow in the system.

## 5. Data model impact

None. `Offboarding` (`lib/db/models/offboarding.ts`) already existed, unused, since Phase
1, and its shape already matched `DATA-MODEL.md` §2 (`checklist`, `destruction_certificate`,
`asset_return_attestation`, `status: initiated|in_progress|verified|archived`). No field
was added, changed, or migrated. `Assessment.status` already listed `'archived'` in its
enum since Phase 1; this phase is simply the first code that ever writes it.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Model           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-08-17 | Read the session-start docs, drafted and got approval for the Phase 10 plan. Filled `ROLLBACK.md`'s Active plan.                                                                                                                                                                                                                                                                                                                                                                                                          | `docs/ROLLBACK.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Claude Sonnet 5 |
| 2026-08-17 | Built `OffboardingRepository` and `AssessmentRepository.archive()`, both with status-scoped write filters. Added the archived-assessment guard to `AssessmentReviewService`'s four risk/CAP-task write methods. Built `lib/services/offboarding.ts` (initiate/checklist/certificate upload+verify/complete, plus a `refreshReadiness()` helper that advances `initiated → in_progress → verified` forward-only). Added five API routes and the vendor-detail-page offboarding panel.                                      | `lib/repositories/offboarding-repository.ts` (new), `lib/repositories/assessment-repository.ts`, `lib/services/offboarding.ts` (new), `lib/services/assessment-review.ts`, `app/api/vendors/[id]/engagements/[engagementId]/offboarding/route.ts` (new), `app/api/offboarding/[id]/checklist/[itemId]/route.ts` (new), `app/api/offboarding/[id]/certificate/[kind]/route.ts` (new), `app/api/offboarding/[id]/certificate/[kind]/verify/route.ts` (new), `app/api/offboarding/[id]/complete/route.ts` (new), `components/offboarding/offboarding-panel.tsx` (new), `app/(internal)/vendors/[id]/page.tsx` | Claude Sonnet 5 |
| 2026-08-17 | Wrote `lib/services/__tests__/offboarding.test.ts` (integration, full lifecycle + repository-level immutability check) and a new `describe` block in `lib/services/__tests__/assessment-review.test.ts` covering the archived-assessment guard on all four risk/CAP methods. Ran `format`/`lint`/`typecheck`/`test`/`build` clean, then verified the exit criterion by real HTTP request against a running dev server (see §9). Updated `DECISIONS.md`, `FLOW.md`, `ARCHITECTURE.md`, `TEST-CHECKLIST.md`, `HANDOVER.md`. | `lib/services/__tests__/offboarding.test.ts` (new), `lib/services/__tests__/assessment-review.test.ts`, `docs/DECISIONS.md` (023), `docs/FLOW.md`, `docs/ARCHITECTURE.md`, `docs/TEST-CHECKLIST.md`, `docs/HANDOVER.md`                                                                                                                                                                                                                                                                                                                                                                                    | Claude Sonnet 5 |

## 7. What didn't work

Nothing abandoned. One design choice worth recording as a near-miss: the first draft of
`completeOffboarding()` took an `engagementId` parameter (matching `getOffboardingView()`),
but every route that reaches it has an `offboardingId` in scope, not an `engagementId` —
caught while wiring the API routes, fixed by re-keying `completeOffboarding()` on
`offboardingId` via `OffboardingRepository.findById()` instead of `findByEngagement()`.

## 8. Decisions logged

`DECISIONS.md` 023.

## 9. Verification

Ran `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and
`npm run build` — all exit 0.

```
 Test Files  22 passed (22)
      Tests  159 passed (159)
```

(155 before this phase → 159: +4 new tests — the offboarding lifecycle integration test's
single large `it()` covering the full state machine plus the repository-level immutability
check, and the archived-assessment-guard test added to `assessment-review.test.ts`.)

Verified the exit criterion (`PLAN.md` Phase 10: "an archived assessment renders
byte-identically to how it was answered, and no code path exists that can mutate it") by
real HTTP request against a running dev server, using a disposable smoke-test vendor/
engagement/assessment/offboarding record (created, exercised, then deleted from the dev
database; `SUPER_ADMIN_PASSWORD_HASH` was temporarily swapped for a known test hash via
`npm run hash-password` + `npm run db:seed`, then restored the same way afterward):

1. Internal login → vendor intake (tiered) → an `Assessment` inserted directly at
   `status: 'completed'` (equivalent to a reviewed assessment, without re-running the full
   Phase 5–8 template/assignment/answer/review chain those phases already verified).
2. `POST /api/vendors/[id]/engagements/[engagementId]/offboarding` with two checklist items
   → `201`. Confirmed `Engagement.status → 'offboarding'` and
   `Vendor.lifecycle_status → 'offboarding'` by direct query. A second `POST` for the same
   engagement → `422 "Engagement is already offboarding"`.
3. `POST /api/offboarding/[id]/complete` while nothing was done yet → `422` ("not ready to
   archive"). Marked both checklist items `done` via `PATCH .../checklist/[itemId]` → status
   advanced to `in_progress` then, confirmed by direct query. `complete` retried → still
   `422` (checklist done, no certificates yet).
4. Uploaded both certificates via `POST .../certificate/[kind]` (multipart) → `201` each.
   `complete` retried → still `422` (uploaded, not verified). Downloaded the destruction
   certificate via `GET .../certificate/destruction_certificate` and `diff`'d it against the
   uploaded file — byte-identical. Verified both via `PATCH .../certificate/[kind]/verify` →
   `200` each; `Offboarding.status` confirmed `verified` by direct query.
5. `POST .../complete` → `200 {"status":"archived"}`. Direct query confirmed all four
   documents in their terminal state in one pass: `offboarding.status=archived`,
   `assessment.status=archived`, `engagement.status=closed`,
   `vendor.lifecycle_status=terminated`.
6. A second `complete` call → `422 "already completed offboarding"`. A checklist-item
   `PATCH` against the now-archived record → `422 "archived and cannot be modified"`.
7. `GET /api/assessments/[id]/review` against the archived assessment → `200`, full
   `template_snapshot`-derived question list still present — archiving doesn't touch
   rendering.
8. `POST /api/assessments/[id]/risks` against the archived assessment → `403 "This
assessment is archived and its risks can no longer be modified"` — the new guard added
   in this phase, not a pre-existing check.
9. Unauthenticated `POST /api/offboarding/[id]/complete` → `401 {"error":"unauthenticated"}`.

Cleaned up the smoke-test vendor/engagement/assessment/offboarding documents and the
uploaded certificate files under `.storage-local/` afterward (confirmed zero remaining via
count queries) and restored the real `SUPER_ADMIN_PASSWORD_HASH` via `npm run db:seed`.

Skipped: no test exercises the offboarding panel through the actual rendered React UI
(Playwright or similar) — verified by reading the component and by exercising the API
routes it calls directly, same discipline as every prior phase's UI verification.

## 10. Rollback

No safe commit SHA exists anywhere in this repo (`DECISIONS.md` 010, re-deferred through
every phase to date). `ROLLBACK.md`'s Active plan block (dated 2026-08-17) lists the file
set for a full phase revert. No schema change was made — the only "schema-adjacent" change
is a new throw path in an existing service, not a model field — so a revert is a clean
file-level `git restore`.

## 11. Follow-ups

- The offboarding checklist's owner field is a raw `User._id` text input, not a picker —
  same reasoning and same deferral as Phase 9's CAP dialog (`DECISIONS.md` 013).
- No UI-level (browser-driven) test exists for the offboarding panel — see §9's skipped
  item.
- No retention/expiry policy exists for archived records — deliberate, `PLAN.md`'s own
  default (`ARCHITECTURE.md` §7).
- Phase 11 (multi-workspace RBAC, sharing, executive roll-up) is next per `PLAN.md`.
