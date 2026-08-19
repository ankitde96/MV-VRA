# Assessment workflow Stage 5 — review and resend

Status: implemented and verified on 2026-08-19.

## Outcome

Reviewers can mark each visible response compliant or non-compliant, leave an autosaved
instruction, and return only the failed controls to the vendor. Compliant answers remain
locked in both the UI and portal write services. Completion requires a verdict for every
visible control and a linked risk for every accepted non-compliance.

## Implementation trace

- `Response` stores verdict, note, reviewer, timestamp, and review round.
- `Assessment` stores `changes_requested`, round, and resend attribution.
- `AssessmentReviewService` owns mark, resend, and completion gates; portal services own
  per-control correction authorization.
- `PATCH /api/assessments/[id]/responses/[controlId]/review` and
  `POST /api/assessments/[id]/resend` require `assessment.review`.
- `hooks/use-debounced-autosave.ts` is shared by reviewer and vendor forms and flushes before
  workflow actions.
- Vendor scorecards expose their open risks, closing the review-to-register visibility loop.

## Verification evidence

`npm run verify` passed: Prettier clean; ESLint 0 errors with the known TanStack advisory;
route type generation and TypeScript passed; Vitest passed 29 files and 225 tests; the Next
production build compiled and generated 35/35 static pages.

`npm run test:e2e` passed 23 tests across desktop Chromium and Pixel 7, with one intentional
desktop skip for the mobile-only checklist test. The correction journey proved reviewer
verdict/note persistence, request-changes transition, portal reviewer-note visibility,
compliant-control locking, and non-compliant-control editing on both projects.

Focused service evidence: `assessment-review.test.ts` passed 20/20 and the combined review
plus portal suites passed 39/39. Tests cover zero-failure resend refusal, compliant-control
write refusal, unmarked completion refusal, risk-required completion, and success after a
risk is created.

No migration, branch, pull request, or destructive data operation was used.
