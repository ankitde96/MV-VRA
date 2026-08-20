# Feature: Reviewer experience Stage 3 — bulk review and productivity

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | complete and verified                      |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 3 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Make long assessment reviews navigable with visible progress, URL-persisted filter/search/
collapse/focus state, collapsible sections, keyboard-first review actions, a discoverable
shortcut sheet, and explicit per-row saving/saved/error-with-retry feedback. This stage does
not change response schemas, API contracts, authorization, or server-side completion rules.

## 2. Why

The real questionnaire has 130 controls. Correct per-control review exists, but the current
page renders one undifferentiated list and makes reviewers manually scan for unfinished or
failed work.

## 3. Plan

Keep filtering/progress as pure functions over `ReviewerQuestionItem[]` plus reducer state.
Group unmarked/non-compliant as one OR status facet and AND it with the missing-evidence and
risk-raised facets. Exclude suppressed controls from counts, progress, filtering, and
keyboard navigation. Persist state through typed helpers in `use-review-url-state`; use
section indexes for compact collapse state and control IDs for focus restoration. Reuse the
project's existing Button/Input/Dialog/Progress primitives and tokens.

## 4. Flow impact

Improves the client-side orchestration and presentation of F7. Existing PATCH autosave,
resend, risk, and completion routes remain unchanged.

## 5. Data model impact

None.

## 6. Work log

| Date       | What was done                                                          | Files               | Model         |
| ---------- | ---------------------------------------------------------------------- | ------------------- | ------------- |
| 2026-08-20 | Mapped Stage 3, review components, URL hook, tests, and design supply. | Plan/trace/rollback | Codex (GPT-5) |
| 2026-08-20 | Added pure progress/facet/filter and defensive URL-state helpers.      | Review logic        | Codex (GPT-5) |
| 2026-08-20 | Built the sticky toolbar, section disclosure, shortcuts, and save UI.  | Components/hooks    | Codex (GPT-5) |
| 2026-08-20 | Extracted productivity orchestration to preserve the Stage 0 boundary. | Client/hook         | Codex (GPT-5) |
| 2026-08-20 | Added unit and disposable desktop/mobile browser coverage.             | Unit/Playwright     | Codex (GPT-5) |

## 7. What didn't work

- The first browser fixture assumed the fixed base-seed vendor existed. The Stage 3 journey
  now resolves a demo vendor by its dedicated domain and creates/cleans only its disposable
  assessment records; the base seed was rerun to restore the older correction fixture.
- The initial progress assertion used visible copy as the progressbar's accessible name.
  The rendered semantics were correct; the test now checks the actual `Review progress`
  label and `aria-valuenow`.
- The correction regression selected rows by presentation classes, which the new section
  shell changed. Stable `data-review-control` identifiers now express that contract.
- Empty `collapsed` query state initially parsed as section zero because `Number("")` is
  zero. The parser now removes empty tokens before numeric conversion, with a regression
  test.

## 8. Decisions logged

`DECISIONS.md` 049 records the bounded client computation, facet semantics, suppressed
exclusion, URL persistence, and orchestration boundary.

## 9. Verification

- Pure productivity and reducer tests: 2 files, 7 tests passed.
- Playwright: productivity persistence and correction-round regression passed on desktop
  Chromium and Pixel 7 projects, 4/4 tests.
- `21st review` on the changed review UI and hooks: 0 findings.
- Focused TypeScript and ESLint gates passed after the orchestration extraction.
- Full `npm run verify`: format, lint, typecheck, 34 files/248 tests, and the 35-page
  production build passed. The existing TanStack Table React Compiler compatibility warning
  remains warning-only and outside this stage.

## 10. Rollback

Safe baseline: `8aa27a0c2fe353af3721b08435f0cfbaae227c8d`. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 4 builds evidence-review actions on top of these filters and row affordances.
