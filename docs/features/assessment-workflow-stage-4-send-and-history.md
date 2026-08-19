# Assessment workflow Stage 4 — send, recipients, and history

> `ASSESSMENT-WORKFLOW-PLAN.md` Stage 4. Status: done (2026-08-19).

## Delivered

- `sendAssessment()` validates selected ids against active SPOCs on the assessment's own
  vendor, then transactionally sends the draft, starts the SLA, advances the engagement,
  and records `assessment.sent`.
- `POST /api/assessments/[id]/send` and the responsive send dialog select all active SPOCs by
  default, refuse zero recipients, and explain that unchecked contacts lose access.
- Portal list/detail reads enforce signed-session `spocId` membership in `recipients`, with a
  compatibility path for historical records created before recipient storage.
- `last_activity_at` moves across response, evidence, submission, risk, and review writes.
- Vendor assessment history is a four-column shared DataTable using one plain-language status
  helper also consumed by the portal and review queue.

## Verification

```text
npm run verify
Test Files  29 passed (29)
Tests       221 passed (221)
Compiled successfully; generated 35/35 pages

npm run test:e2e
21 passed, 1 skipped (56.3s)
```

The disposable HTTP walkthrough sent one draft to the primary SPOC only. The primary portal
listed it; a real OTP session for the secondary SPOC returned a hidden list and the direct
not-found boundary. Database reads confirmed the single recipient, `sent` status, 21-day
deadline, `in_assessment` engagement, and a later `last_activity_at` after answer autosave.
Cleanup deleted the response, audit event, assessment, and engagement.

## Rollback

See `docs/ROLLBACK.md`. Schema changes are additive. Sent records remain valid if UI/service
code is reverted, but recipient authorization must not be removed without an explicit data
and security decision.
