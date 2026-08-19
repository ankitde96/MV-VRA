# Feature: Assessment workflow Stage 3 — draft checklists

> `ASSESSMENT-WORKFLOW-PLAN.md` Stage 3. Verification complete.

|             |                                                               |
| ----------- | ------------------------------------------------------------- |
| **Status**  | done                                                          |
| **Started** | 2026-08-19                                                    |
| **Spec**    | `ASSESSMENT-WORKFLOW-PLAN.md` Stage 3; `DECISIONS.md` 040/043 |
| **Model**   | Codex (GPT-5)                                                 |

## Scope and design

Assignment now creates a draft, records the template name, leaves the response deadline
unset, and leaves the engagement in its prior state. The assessment's cloned snapshot can
be tailored until send. `AssessmentRepository.updateDraftSnapshot()` includes `status:
"draft"` in its workspace-scoped write filter; the snapshot update and audit event share a
MongoDB transaction. Published templates are never written.
The PATCH contract includes `expected_updated_at`; a stale concurrent editor receives a
safe error and cannot overwrite the newer snapshot. The successful response returns the new
timestamp so repeated saves from the same open editor remain valid.

The portal assessment service owns both list and detail concealment, returning no draft to
a SPOC. The template builder and assessment checklist editor share
`components/questionnaire/question-editor.tsx` plus the existing builder-state hydration,
serialization, and prior-control helpers.

## Verification so far

- `npm run typecheck` — `Generating route types...` then
  `✓ Types generated successfully`; TypeScript exited cleanly.
- `npm test -- --run lib/services/__tests__/assessment-assignment.test.ts` —
  `Test Files 1 passed (1)`, `Tests 10 passed (10)`. This covers draft semantics, sent-edit
  refusal, template/second-assignment isolation, invalid and forward-reference rejection
  before persistence, and stale concurrent-save refusal.
- `npx vitest run lib/services/__tests__/portal-assessment.test.ts -t "conceals draft"
--reporter=verbose` — `Test Files 1 passed (1)`, `Tests 1 passed | 17 skipped (18)`.
- `npm run lint` — `eslint`, exit 0. `git diff --check` — exit 0, no output.
- `npm run verify` — `All matched files use Prettier code style!`; lint reported the one
  known TanStack advisory and zero errors; typecheck passed; `Test Files 29 passed (29)`,
  `Tests 218 passed (218)`; production build reported `Compiled successfully` and generated
  all 35 static pages. Two preceding runs reproduced the known cross-file storage cleanup
  race; test cleanup now removes only its workspace directory, after which the full rerun
  passed.
- `npm run db:seed && npm run db:seed-questionnaire` refreshed the documented fixtures.
  A single clean `npm run test:e2e` then passed 17 tests in 1.4 minutes across desktop
  Chromium and Pixel 7; the one skip is the deliberate desktop copy of the mobile-only
  checklist-editor journey. That journey adds, edits, saves, deletes, reload-verifies, and
  checks for horizontal overflow on Pixel 7.
- The real HTTP walkthrough used an authenticated admin session and disposable records.
  Assignment returned `201` with `status: "draft"`, null `due_date`, and left the engagement
  `tiered`. The portal list omitted the assessment and direct access rendered the not-found
  boundary. Two checklist PATCHes exercised add/edit/delete and returned `200`. The source
  template hash remained
  `14739bec12dabcb81930e6cae8e77ca477760920fafa17c6f10fc128eb08e5ea`; a second
  assignment's snapshot matched it. Because Stage 4's send action does not exist yet, the
  fixture was transitioned to `sent` directly; its subsequent checklist PATCH returned
  `403` with `Only draft assessment checklists can be edited`. Cleanup removed two
  assessments, four audit events, and the disposable engagement.

## Compatibility finding from E2E

The vendor list crashed on a legacy document whose `spocs` field was absent: lean MongoDB
reads do not apply the Mongoose array default retroactively. Readers now treat a missing
array as empty; the list displays the legacy `spoc` email/count only as an unmigrated-record
fallback, while normal operation and every writer continue to use `spocs[]`. The portal
login failure was separate fixture state, resolved by the idempotent documented seed.

## Rollback

See `docs/ROLLBACK.md`. No migration or destructive write is involved. Drafts created while
deployed remain valid records; Stage 4 is responsible for sending them.
