# Feature: Reviewer experience Stage 2 — demo data v2

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | done                                       |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 2 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Extend the opt-in demo seeder with deterministic questionnaire responses, PDF/PNG/CSV/TXT
evidence, linked risks and corrective-action tasks, and one re-submitted correction round.
Keep the existing 12 fictional demo vendors and the `.demo.mv-vra.local` cleanup boundary.
This stage does not change production schemas, APIs, authentication, or UI.

## 2. Why

Reviewer productivity, evidence review, remediation, and reporting stages need one
repeatable environment whose expected compliance and overdue-remediation answers are known.

## 3. Plan

Use a 25-control frozen demo snapshot so strong and weak profiles resolve exactly to 92%
(23/25) and 60% (15/25). Store four committed fixtures through `getStorageDriver()` under
stable demo-only keys. Create review responses directly as fixtures, but create linked risks
and CAP tasks through `AssessmentReviewService` so demo records follow production scoring,
ownership, and audit behavior. Keep ordinary reruns delete-and-recreate idempotent; make
`--reset` additionally clear the dedicated demo storage prefix before rebuilding it.

## 4. Flow impact

Adds realistic fixture coverage for F3 (answer/evidence/submission), F4 (review → risk →
remediation), and F7 (correction round). Runtime application flows are unchanged.

## 5. Data model impact

None. The script populates existing `Assessment`, `Response`, `Risk.cap_tasks[]`, and storage
shapes. No migration or backfill runs.

## 6. Work log

| Date       | What was done                                                                | Files                   | Model         |
| ---------- | ---------------------------------------------------------------------------- | ----------------------- | ------------- |
| 2026-08-20 | Mapped seed/storage/review paths and recorded safe scope.                    | Plan and trace docs     | Codex (GPT-5) |
| 2026-08-20 | Added deterministic responses, evidence, risks/CAPs, and correction history. | Seeder, fixtures, tests | Codex (GPT-5) |
| 2026-08-20 | Proved two-pass idempotency and completed the full repository gate.          | Database, storage, docs | Codex (GPT-5) |

## 7. What didn't work

The first live run used Mongoose's deprecated `findOneAndUpdate({ new: true })` option and
printed one warning per created risk. The result was correct, but the seeder was changed to
the current `returnDocument: "after"` form before the second clean run. An initial
verification query also chose a deliberately stalled 60% vendor and correctly found no
responses; the asserted weak profile is the seeded Pinecone assessment instead.

## 8. Decisions logged

`DECISIONS.md` 048.

## 9. Verification

Focused fixture/spec test:

- `npm test -- --run scripts/__tests__/demo-data-spec.test.ts`
- Result: 1 file passed, 5 tests passed.
- `npm run typecheck` passed.

Real seed/storage verification:

- Captured non-demo baseline: 1 vendor, 1 engagement, zero assessments/responses/risks/
  offboarding records; vendor-document SHA-256
  `7741c26ae87ac8b7b321af691be1a65ef2f73e43b0ae3de724772e35f8fdacc6`.
- `npm run db:seed-demo -- --reset` produced 12 vendors, 11 assessments, 225 responses,
  36 evidence records (9 each PDF/PNG/CSV/TXT), 17 linked risks, 8 CAP tasks, 5 past-due
  open CAPs, and one submitted correction round.
- A second `npm run db:seed-demo` reproduced the same database counts and exactly 36 stable
  storage keys. Strong/weak profiles were 23/25 and 15/25. The non-demo counts and hash were
  unchanged after both destructive demo-only passes.

Full `npm run verify` passed on 2026-08-20:

- Prettier: all files matched.
- ESLint: zero errors; one existing TanStack Table React Compiler advisory.
- Typecheck: Next route generation and `tsc --noEmit` passed.
- Vitest: 33 files passed, 244 tests passed.
- Next production build: compiled and generated all 35 static pages successfully.

No Playwright run: Stage 2 changes no UI or runtime request path. The stage-specific
integration proof is the real MongoDB plus storage-driver two-pass seed run above.

## 10. Rollback

Safe baseline: `2ae938cef144`. See `docs/ROLLBACK.md`. Demo records remain isolated by the
domain suffix and dedicated storage prefix; no production data migration is involved.

## 11. Follow-ups

Stage 3 consumes these fixtures for bulk-review and reviewer-productivity UI work. Global
audit-event counts intentionally grow across rebuilds because service-created risk/CAP
events are append-only; demo-domain record counts are the idempotency boundary.
