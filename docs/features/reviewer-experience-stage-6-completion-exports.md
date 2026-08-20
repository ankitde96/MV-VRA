# Feature: Reviewer experience Stage 6 — completion workflow and exports

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | complete                                   |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 6 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Compute one authoritative completion summary, require a confirmation dialog before review
completion, and add internal-only CSV and PDF assessment exports derived from the frozen
assessment snapshot.

## 2. Why

Completion currently jumps directly from a button to the mutation route, making blockers,
warnings, evidence concerns, risk distribution, and the next review date hard to verify at
the decision point. Reviewers also lack portable control-level and executive assessment
records.

## 3. Plan

Create one tenant-scoped report model that joins the assessment snapshot, responses,
evidence flags, risks/CAPs, vendor, workspace cadence, and reviewer identity. Expose its
completion summary through `AssessmentReviewService`, reuse the same readiness calculation
inside `completeReview()`, and serialize that model to exact CSV and an internal-watermarked
PDF. Add capability-protected read routes and a project-native dialog/download surface.

## 4. Flow impact

Extends F7's completion decision and adds read-only exports. The completion mutation and its
Stage 5 hard/advisory gates remain authoritative.

## 5. Data model impact

No schema or migration. Exports read the assessment's embedded `template_snapshot`; they do
not query or mutate the live template.

## 6. Work log

| Date       | What was done                                                                                               | Files               | Model         |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------- | ------------- |
| 2026-08-20 | Mapped completion, reviewer data, export, authorization, and UI paths.                                      | CodeGraph/plan      | Codex (GPT-5) |
| 2026-08-20 | Added the shared tenant-scoped report model and completion summary.                                         | Service/review gate | Codex (GPT-5) |
| 2026-08-20 | Added protected CSV/PDF routes, frozen-snapshot serialization, and a pinned PDF renderer.                   | API/dependency      | Codex (GPT-5) |
| 2026-08-20 | Added the completion confirmation dialog and report actions using the established review UI system.         | Review UI           | Codex (GPT-5) |
| 2026-08-20 | Added golden CSV, PDF generation/text, snapshot immutability, summary, and desktop/mobile journey coverage. | Tests/E2E           | Codex (GPT-5) |

## 7. What didn't work

- An initial install pinned an older renderer release. It was corrected immediately to
  exact `@react-pdf/renderer@4.6.1`; the final dependency tree contains no `crypto-js`.
- The first golden CSV expected unnecessary quotes around plain fields. The fixture was
  corrected while retaining comma, embedded-quote, BOM, and spreadsheet-formula coverage.
- The first browser assertion looked for export actions as links. The project's Base UI
  button primitive intentionally exposes rendered download anchors as buttons, matching the
  existing evidence export, so the assertion was aligned to that established semantic.

## 8. Decisions logged

- `AssessmentReportService` is the sole owner of readiness, CAP completeness, evidence,
  severity distribution, and next-review calculations. The confirmation summary and
  `completeReview()` therefore cannot drift independently.
- CSV and PDF exports include every frozen-snapshot control, including suppressed controls;
  completion readiness and section metrics count only controls visible under the frozen
  response state.
- CSV is UTF-8 BOM/CRLF, quotes fields only when required, doubles embedded quotes, and
  neutralizes spreadsheet-formula prefixes.
- PDF colors are local print-document constants because `@react-pdf/renderer` cannot consume
  browser CSS variables. The document is explicitly watermarked `INTERNAL`.

## 9. Verification

- Focused service/export tests: 2 files, 25 tests passed.
- Full Vitest suite: 37 files, 264 tests passed.
- Disposable desktop/mobile reviewer remediation journey: 2/2 passed, including authenticated
  CSV/PDF responses, completion summary, CAP acknowledgement, completion, and audit record.
- Production build completed successfully.
- `21st review` reported no finding in the new browser UI. Its repository-wide output retained
  pre-existing primitive focus/motion findings and informational print-PDF color notices.
- Final `npm run verify` passed formatting, lint, typecheck, all 37 files/264 tests,
  and the production build.

## 10. Rollback

Safe baseline: `a78784873258c2e4001f0cbf3458f29a60fedb14`. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 7 builds reporting dashboards over the now-exportable review data.
