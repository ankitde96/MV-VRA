# Feature: Phase 9 — CAP tracking and mitigation guidance

|                    |                                                                |
| ------------------ | -------------------------------------------------------------- |
| **Status**         | done                                                           |
| **Owner**          | AI session, at project owner's request ("let's build phase 9") |
| **Started**        | 2026-08-16                                                     |
| **Spec reference** | `PLAN.md` Phase 9; `FLOW.md` F4 step 6                         |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)                            |

## 1. Scope

Corrective Action Plan (CAP) tasks embedded on an existing `Risk` — create, update
(description/due date/status, with `closed_at` auto-stamped on close). Request-driven
overdue detection: a task past its due date and not closed is flagged `overdue`, and gets
exactly one escalation email (dev console transport) to its owner — an internal `User` or
the risk's own vendor SPOC — no matter how many times the detection query runs. Also closes
the test-debt gap `HANDOVER.md`/`TEST-CHECKLIST.md` flagged after Phase 8 (no automated
coverage for `calculateResidualScore()` or `AssessmentReviewService`), done first as a
prerequisite. Does **not** include: a background job runner (deliberately — `PLAN.md` §1's
own stated default, `DECISIONS.md` 022), a real mail provider (still `MAIL_PROVIDER=console`
only), or a full internal-user picker UI (the CAP dialog takes a raw `User._id` — the
single-super-admin gate, `DECISIONS.md` 013, means a real multi-user picker has no data to
populate yet).

Mitigation guidance _matching_ was already built in Phase 8
(`AssessmentReviewService.getAssessmentReviewData()` matches `MitigationGuidance` by
`control_pattern` prefix and surfaces `suggested_guidance` to the reviewer). This phase
reuses that, unchanged — no new matching logic was needed.

## 2. Why

Closes the last unbuilt step of `FLOW.md` F4: a risk with no remediation tracking is a
register entry that never gets acted on. Overdue CAPs need to surface somewhere a reviewer
will actually see them without a scheduler this MVP doesn't otherwise have.

## 3. Plan

Presented to the project owner before writing code (`CONSTRAINTS.md` #14): (0) close the
Phase 8 test-debt gap first — unit tests for `calculateResidualScore()`, integration tests
for `AssessmentReviewService` — since `HANDOVER.md` explicitly named this a prerequisite;
(1) CAP task CRUD on the existing embedded `cap_tasks` array, no new collection; (2) one
additive schema field (`cap_tasks[].escalated_at`) to make one-time escalation possible
without a job runner, plus a request-driven detection method and route; (3) carry Phase 8's
existing mitigation-guidance suggestion into the CAP-creation UI as a description default.
Approved as described; no plan changes mid-flight.

## 4. Flow impact

`FLOW.md` F4 step 6, now built — see the flow file for the real function/route references.
F4 as a whole is now marked ✅ BUILT end to end (Phases 8–9).

## 5. Data model impact

One additive field: `Risk.cap_tasks[].escalated_at: Date | null` (default `null`) in
`lib/db/models/risk.ts`. No migration — existing Phase 8 risks (all with `cap_tasks: []`)
are unaffected, and any hypothetical pre-existing task would read `escalated_at` as
`undefined`/`null`, which is exactly the correct "not escalated yet" state. No new
collections.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Files                                                                                                                                                                                                                                                                                                                                                                                       | Model           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-08-16 | Read the session-start docs, drafted and got approval for the Phase 9 plan (including doing the Phase 8 test-debt prerequisite first). Filled `ROLLBACK.md`'s Active plan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `docs/ROLLBACK.md`                                                                                                                                                                                                                                                                                                                                                                          | Claude Sonnet 5 |
| 2026-08-16 | Closed the Phase 8 test-debt gap: unit-tested `calculateResidualScore()` and integration-tested `AssessmentReviewService` against a real MongoDB.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `lib/scoring/__tests__/residual-risk.test.ts` (new), `lib/services/__tests__/assessment-review.test.ts` (new)                                                                                                                                                                                                                                                                               | Claude Sonnet 5 |
| 2026-08-16 | Added `cap_tasks[].escalated_at`; `RiskRepository.pushCapTask()`/`updateCapTaskFields()`/`findRisksWithPastDueCapTasks()`; `AssessmentReviewService.createCapTask()`/`updateCapTask()`/`detectAndEscalateOverdueCaps()`; three new API routes; extended `listWorkspaceRisks()` to include each risk's `cap_tasks` with resolved owner labels; added CAP-task-integration tests to the same integration test file; built the `AddCapTaskDialog` component and wired an "Overdue Corrective Actions" queue + expandable per-risk CAP task list with a status `Select` into the Risk Register page. Ran `format`/`lint`/`typecheck`/`test`/`build` clean, then verified the exit criterion by real HTTP request (see §9). | `lib/db/models/risk.ts`, `lib/repositories/risk-repository.ts`, `lib/services/assessment-review.ts` (+ existing test file extended), `app/api/risks/[id]/cap-tasks/route.ts` (new), `app/api/risks/[id]/cap-tasks/[taskId]/route.ts` (new), `app/api/risks/cap-tasks/overdue/route.ts` (new), `components/risks/add-cap-task-dialog.tsx` (new), `components/risks/risk-register-client.tsx` | Claude Sonnet 5 |

## 7. What didn't work

Nothing abandoned. One design choice worth recording as a near-miss: the first draft let
`createCapTask()`'s `owner_ref` be used as-is for `owner_type: 'vendor'`, which would have
let a CAP task on vendor A's risk be silently assigned to vendor B's SPOC email — caught
before writing tests, fixed by forcing `owner_ref` to the risk's own `vendor_id` regardless
of the caller's input (`DECISIONS.md` 022).

## 8. Decisions logged

`DECISIONS.md` 022.

## 9. Verification

Ran `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and
`npm run build` — all exit 0.

```
 Test Files  21 passed (21)
      Tests  155 passed (155)
```

(139 before this phase's test-debt closure + CAP tests → 155: +9 residual-risk unit tests,
+7 assessment-review integration tests including the new CAP-task describe block.)

Verified the exit criterion (`PLAN.md` Phase 9: "an overdue CAP surfaces in a queue and
escalates once, without a job runner") by real HTTP request against a running dev server,
using a disposable smoke-test vendor/template/assessment/risk (created, exercised, then
deleted from the dev database; `SUPER_ADMIN_PASSWORD_HASH` was temporarily swapped for a
known test hash via `npm run hash-password` + `npm run db:seed`, then restored the same way
afterward):

1. Internal login → vendor intake → template published → assessment assigned → risk raised
   (`residual_score: 51`) — same setup pattern as the Phase 8 trace.
2. `POST /api/risks/[id]/cap-tasks` with `owner_type: "vendor"`, `due_date: "2020-01-01"` →
   `201`, `{"status":"open", ...}`.
3. `GET /api/risks/cap-tasks/overdue` (first call) → `200`,
   `{"items":[{... "status":"overdue","escalated_at":"2026-08-16T17:03:13.519Z","newly_escalated":true}]}`.
   Dev server log confirmed exactly one `[mail:console]` entry:
   `to=smoke-spoc@phase9-smoke.example subject="[MV-VRA] Overdue corrective action: ..."`.
4. `GET /api/risks/cap-tasks/overdue` (second call) → `200`, same item,
   `"newly_escalated":false`, `escalated_at` unchanged. `grep -c "mail:console"` against the
   dev server log still showed exactly **1** — the escalation did not resend.
5. `PATCH /api/risks/[id]/cap-tasks/[taskId]` with `{"status":"closed"}` → `200`,
   `closed_at` stamped. A third `GET /api/risks/cap-tasks/overdue` call returned
   `{"items":[]}` — a closed task never resurfaces, even with its due date still in the
   past.
6. `GET /api/risks` (register) showed the same task with `status: "closed"`,
   `escalated_at` and `closed_at` both preserved — the full history survives the status
   change.
7. Unauthenticated `GET /api/risks/cap-tasks/overdue` → `401 {"error":"unauthenticated"}`.
8. `GET /risks` (the actual Server Component page, not just the API) rendered — confirmed
   `Unified Risk Register` in the response HTML.

Cleaned up the smoke-test vendor/engagement/template/assessment/risk from the dev database
afterward (confirmed zero remaining via a count query) and restored the real
`SUPER_ADMIN_PASSWORD_HASH` via `npm run db:seed`.

Skipped: no test exercises the CAP surface through the actual rendered React UI (Playwright
or similar) — the queue/dialog/status-select were verified by reading the component code and
by exercising the underlying API routes they call, not by driving a browser.

## 10. Rollback

No safe commit SHA exists anywhere in this repo (`DECISIONS.md` 010, re-deferred through
every phase to date). `ROLLBACK.md`'s Active plan block (dated 2026-08-16) lists the file
set for a full phase revert; the one schema change (`cap_tasks[].escalated_at`) is additive
and safe to revert on its own even if documents were already written with it set.

## 11. Follow-ups

- The CAP dialog's internal-owner field is a raw `User._id` text input, not a picker —
  acceptable only because this MVP has exactly one authenticatable internal user
  (`DECISIONS.md` 013). Revisit once real multi-user internal auth exists.
- No UI-level (browser-driven) test exists for the overdue queue or CAP dialog — see §9's
  skipped item.
- `enterprise_risk_categories` remains the Phase 8 seeded placeholder list;
  `ARCHITECTURE.md` §7's taxonomy-ownership question is unchanged by this phase.
