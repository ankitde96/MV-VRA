# Feature: Reviewer experience Stage 0 — review-page decomposition

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | done                                       |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 0 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Refactor the internal assessment review client without changing visible behavior: one
reducer owns per-control verdict/note/save state, question rows and sections become separate
components, and an initially field-free URL query-state hook establishes the Stage 3
persistence boundary. No API, schema, authentication, storage, or workflow behavior changes.

## 2. Why

The existing page rendered all question markup and held four parallel state maps in one
component. With roughly 130 controls, a reviewer-note keystroke changed parent state that was
consumed inline by every row. The extraction gives each memoized row one stable state object,
making later filtering, navigation, and collapse work additive rather than another expansion
of the monolith.

## 3. Plan

Follow `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 0 exactly. Keep network orchestration,
completion/resend, and risk-dialog ownership in the page client. Move only row rendering and
per-control state. Preserve autosave payloads, delay, messages, and flush-before-transition.

## 4. Flow impact

Touches `FLOW.md` F7 step 1 only at the client-component boundary. The HTTP/service flow and
all workflow transitions are unchanged.

## 5. Data model impact

None. No migration or backfill.

## 6. Work log

| Date       | What was done                                                               | Files                                                                                        | Model         |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------- |
| 2026-08-20 | Captured rollback baseline; added reducer, memoized row, section, URL hook. | `assessment-review-client.tsx`, `components/assessments/review/*`, `use-review-url-state.ts` | Codex (GPT-5) |

## 7. What didn't work

CodeGraph's broad source query truncated the large review client before the row ended. A
second targeted query established the symbols and blast radius; the already-located tail was
then read directly. No implementation approach was abandoned.

## 8. Decisions logged

`DECISIONS.md` 046.

## 9. Verification

`npm run verify` passed on 2026-08-20:

- Prettier: all files matched.
- ESLint: zero errors; one known TanStack Table React Compiler advisory in
  `components/data-table/data-table.tsx`.
- Typecheck: Next route generation and `tsc --noEmit` passed.
- Vitest: 30 files passed, 228 tests passed (including 3 new reducer tests).
- Next production build: compiled, generated all 35 static pages, and finalized successfully.

`npx playwright test e2e/assessment-resend-loop.spec.ts` passed 2/2 (Chromium and mobile
Chromium). The unchanged journey exercised compliant/non-compliant marking, reviewer-note
autosave, saved-state rendering, request changes, and the vendor correction boundary.

The completion button was not manually clicked in a browser in this non-interactive run.
`completeReview()` remained green in the full integration suite, and its header/button/API
orchestration was not moved by this refactor. This skipped manual step is stated explicitly.

## 10. Rollback

Safe baseline: `453441ebcac2b9d33aedef1872fcc4c26f3ad717`. Restore the Stage 0 files from
that revision; there is no persisted data to reverse. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 3 will add named fields to `useReviewUrlState()` and consume it from the review client.
Stages 1 and 2 remain separate requests under `CONSTRAINTS.md` #13.
