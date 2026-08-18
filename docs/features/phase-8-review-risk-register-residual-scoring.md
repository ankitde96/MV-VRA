# Feature: Phase 8 — review, risk register, residual scoring

|                    |                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | done                                                                                                                            |
| **Owner**          | AI session, verified by project owner request                                                                                   |
| **Started**        | 2026-08-14 (code), 2026-08-16 (typecheck fixes + verification)                                                                  |
| **Spec reference** | `PLAN.md` Phase 8; `FLOW.md` F4                                                                                                 |
| **Models used**    | initial build: Gemini 3.6 Flash (per `ROLLBACK.md`); this session's fixes and verification: Claude Sonnet 5 (`claude-sonnet-5`) |

## 1. Scope

Internal reviewer view of a submitted assessment, response by response; raising an
**Identified Risk** against a failed/exception control; mapping `control_id` → enterprise
risk category + impact level; **Residual Risk Calculation** (severity × impact ×
inherent-score blend, discounted by compensating controls); the score-authority rule
(`risk.residual_score` is authoritative and computed on write, `assessment.overall_score`
is derived as the sum of the assessment's risks and recomputed in the same write); and the
workspace-wide Risk Register page with filters. Does **not** include CAP task
tracking/escalation (Phase 9) or a taxonomy editor (`enterprise_risk_categories` stays a
seeded/provisional list, flagged as such in the UI — `ARCHITECTURE.md` §7's open question).

## 2. Why

Closes `FLOW.md` F4: turns a submitted questionnaire into an auditable register entry with
a reproducible score, which is the input the (not-yet-built) CAP and executive roll-up
phases depend on.

## 3. Plan

Code for this phase (service, repository, scoring function, routes, pages, components) was
already written in a prior session (per `ROLLBACK.md`'s Active plan, dated 2026-08-14,
attributed to Gemini 3.6 Flash) but never verified against a running dev server, never
typechecked, and never committed. This session's plan: read the existing code, run the
real gates (`npm run typecheck`/`lint`/`test`/`build`), fix whatever they surface, then
verify the actual exit criterion by real HTTP request before marking it done.

## 4. Flow impact

`FLOW.md` F4 (steps 1–4; step 5, mitigation guidance _suggestion_, is wired — matching is
done by `control_pattern` prefix against the seeded `MitigationGuidance` library; CAP task
creation itself is Phase 9, not this phase).

## 5. Data model impact

First writer to the `risks` collection (model existed since Phase 1, unused until now).
Adds `assessment.overall_score` writes (field existed, never set before this phase) and
`assessment.status` transitions `submitted → under_review` (on first risk raised) and
`under_review/submitted → completed` (on review completion). No schema changes.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Files                                                                                                                                                                                                                                                                                                                            | Model            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 2026-08-14 | Built the reviewer view, risk raise/update, residual scoring, and the register page (uncommitted, unverified).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `lib/scoring/residual-risk.ts`, `lib/repositories/risk-repository.ts`, `lib/services/assessment-review.ts`, five API routes, `app/(internal)/assessments/[id]/page.tsx`, `app/(internal)/risks/page.tsx`, `components/assessments/assessment-review-client.tsx`, `components/risks/{raise-risk-dialog,risk-register-client}.tsx` | Gemini 3.6 Flash |
| 2026-08-16 | Fixed five identical `throw new UnauthorizedError()` call sites (constructor requires a `message` argument — every other route in the codebase passes one); fixed three `workspace_id: this.ctx.workspaceId` audit-event writes (`TenantContext.workspaceId` is `string \| Types.ObjectId`, `AuditEventInput.workspace_id` requires a real `Types.ObjectId` — every other service passes a document's own `workspace_id` field instead, so switched to `toObjectId(this.ctx.workspaceId)`, already imported); ran `format`/`lint`/`typecheck`/`test`/`build` clean; verified the full Phase 8 exit criterion by real HTTP request against a running dev server (see §9). | `app/api/assessments/[id]/{complete-review,review,risks}/route.ts`, `app/api/risks/{route,[id]/route}.ts`, `lib/services/assessment-review.ts`                                                                                                                                                                                   | Claude Sonnet 5  |

## 7. What didn't work

Nothing abandoned. The two bug classes above (missing constructor arg, tenant-context vs.
document `workspace_id` type mismatch) were mechanical fixes, not design changes — see
`DECISIONS.md` 021 for why they exist and how to avoid repeating them.

## 8. Decisions logged

`DECISIONS.md` 021.

## 9. Verification

Ran `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and
`npm run build` — all exit 0. `npm test` output:

```
 Test Files  21 passed (21)
      Tests  139 passed (139)
```

No new automated test coverage was added for the Residual Risk Calculation or
`AssessmentReviewService` this session (still an open item — see §11). Verified the exit
criterion (`PLAN.md` Phase 8: "raise a risk → residual computed → register lists it →
assessment score agrees with the sum of its constituent risks") by real HTTP request
against a running dev server, using a disposable smoke-test vendor/template/assessment
(created, exercised, then deleted from the dev database; the real
`SUPER_ADMIN_PASSWORD_HASH` was temporarily swapped for a known test hash via
`npm run hash-password` + `npm run db:seed`, then restored the same way afterward):

1. Internal login → vendor intake (Tier 1, inherent score 100) → template created and
   published (two controls, `HOST-02` conditional on `HOST-01`) → assessment assigned
   (`status: sent`).
2. Vendor OTP login (code read from the dev console mail transport) → answered `HOST-01 =
false` → submitted. `HOST-02` correctly suppressed (its `show_if` condition wasn't met)
   and did **not** block submission — confirms Phase 7's suppression rule still holds
   through this phase's reviewer read path.
3. `GET /api/assessments/[id]/review` (internal session) returned the submitted response,
   `HOST-02` marked `is_suppressed: true`/`control_status: "suppressed"`, `overall_score:
null` (no risks yet).
4. `POST /api/assessments/[id]/risks` with `severity: high`, `impact_level: high`, no
   compensating controls → `residual_score: 51`. Hand-verified against
   `lib/scoring/residual-risk.ts`: `severity_base(30) × impact_multiplier(1.0) = 30`;
   blended with `inherent_score(100)` at 70/30 → `30×0.7 + 100×0.3 = 51`; no discount → `51`.
   Response also returned `overall_score: 51`, matching (this is the assessment's only
   risk).
5. Re-fetched the review: `assessment.status` had auto-transitioned `submitted →
under_review`; `overall_score: 51`; `risks` array contained the new risk;
   `HOST-01`'s `control_status` was now `"failed"` (a risk is attached to it).
6. `GET /api/risks` (workspace-wide register) listed the same risk with the same
   `residual_score`.
7. `PATCH /api/risks/[id]` adding one compensating control (`"IP Whitelisting"`) →
   `residual_score: 43`. Hand-verified: `51 × (1 − 0.15) = 43.35 → round → 43`. Assessment
   `overall_score` recomputed to `43` in the same call (confirmed by the response body).
8. `POST /api/assessments/[id]/complete-review` → `{"ok":true,"status":"completed"}`.
9. Rendered `GET /assessments/[id]` (the actual Server Component page, not just the API)
   and `GET /risks` as HTML — confirmed the vendor name, "Review Completed" button state,
   and the risk's title all appear in the rendered markup.
10. **Auth boundaries** (Gate 4 discipline, since this touches session-derived scoping):
    unauthenticated requests to `/api/assessments/[id]/review` and `/api/risks` both
    returned 401; a **vendor portal session cookie** presented to the internal
    `/api/assessments/[id]/review` route also returned 401 — the two session types remain
    structurally unable to satisfy each other's routes, consistent with Phase 2/6's design.

Skipped: no test exercises two different workspaces raising risks against each other's
assessments (Gate 4's tenant-isolation item) — every query in `AssessmentReviewService`
routes through a `TenantRepository`, which is the same mechanism already proven in Phases
1/3/6, but this phase adds no new test of its own for it.

## 10. Rollback

No safe commit SHA exists anywhere in this repo (`DECISIONS.md` 010, re-deferred through
every phase to date). The mechanical fixes in this session are two-line diffs, individually
revertible with `git diff`/`git restore` once a git baseline exists. `ROLLBACK.md`'s Active
plan block (dated 2026-08-14) documents the original file list for a full phase revert.

## 11. Follow-ups

- No unit tests exist yet for `calculateResidualScore()` (pure function, cheap to test) or
  integration tests for `AssessmentReviewService` (`raiseRisk`/`updateRisk`/
  `completeReview`/`listWorkspaceRisks`) against a real MongoDB. `TEST-CHECKLIST.md` Gate 2
  still lists Residual Risk Calculation as unchecked — this phase's manual HTTP
  verification is real but is not a substitute for automated coverage; add it before
  Phase 9 builds CAP tracking on top of this.
- `enterprise_risk_categories` is still the seeded placeholder list, flagged `Provisional`
  in both the reviewer and register UI. `ARCHITECTURE.md` §7's open taxonomy-ownership
  question is unchanged by this phase.
- No tenant-isolation test exists at the API-route level for the new risk routes (see §9).
