# Feature: Reviewer experience Stage 1 — schema and upload foundations

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | done                                       |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 1 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Add advisory `Response.evidence_flags[]`, accept CSV and TXT through the shared upload
validator with MIME/extension agreement, and expose evidence upload time plus a human
uploader label to internal reviewers. ZIP remains rejected and the 10 MB limit is unchanged.

The code audit found that existing portal evidence stores `vendorId`, not `spocId`, in
`uploaded_by`. New evidence will use the already-authenticated session `spocId`; legacy
vendor-ID records resolve to the vendor legal name. This does not alter authentication.

## 2. Why

Later evidence-review work needs a durable advisory flag, realistic CSV/TXT evidence, and
reviewer-readable provenance without issuing one database query per evidence item.

## 3. Plan

Follow `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 1. Keep all fields additive and null-safe,
apply filename agreement only to the newly permitted permissive text MIME types, pass the
filename from all shared-validator callers, and resolve uploader IDs in one batched,
workspace-scoped lookup after loading assessment responses.

## 4. Flow impact

Touches F3 evidence upload validation and F7 reviewer data assembly. Upload authorization,
storage ordering, assessment visibility, and review writes remain unchanged.

## 5. Data model impact

Additive `Response.evidence_flags[]`: `evidence_id`, literal `insufficient`, optional note,
flag timestamp, and internal actor ID. Defaults to `[]`; no migration or backfill.

## 6. Work log

| Date       | What was done                                                               | Files                   | Model         |
| ---------- | --------------------------------------------------------------------------- | ----------------------- | ------------- |
| 2026-08-20 | Captured baseline and mapped schema/upload/uploader paths.                  | Stage 1 scope docs      | Codex (GPT-5) |
| 2026-08-20 | Added flag schema, text validation, precise provenance, and batched labels. | Models, services, tests | Codex (GPT-5) |

## 7. What didn't work

The plan assumed `evidence.uploaded_by` already identified either a SPOC or internal user.
The only evidence writer actually stored `vendorId`, so a SPOC name could not be derived.
New writes now use the signed session's existing `spocId`; legacy vendor IDs intentionally
resolve to the vendor legal name because no trustworthy historical SPOC backfill exists.

## 8. Decisions logged

`DECISIONS.md` 047.

## 9. Verification

Focused gate:

- `npm test -- --run lib/uploads/__tests__/constraints.test.ts lib/db/models/__tests__/response.test.ts lib/services/__tests__/portal-assessment.test.ts lib/services/__tests__/assessment-review.test.ts`
- Result: 4 files passed, 51 tests passed.
- `npm run typecheck` passed.

Full `npm run verify` passed on 2026-08-20:

- Prettier: all files matched.
- ESLint: zero errors; one existing TanStack Table React Compiler advisory.
- Typecheck: Next route generation and `tsc --noEmit` passed.
- Vitest: 32 files passed, 239 tests passed.
- Next production build: compiled and generated all 35 static pages successfully.

No Playwright test was run: Stage 1 changes schema/service serialization and shared upload
validation without changing UI. The service integration suite writes CSV/TXT through the real
local-fs storage driver and verifies precise uploader IDs/labels.

## 10. Rollback

Safe baseline: `94500144363457d1c34e33e819523cbeca31b2b5`. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 4 will add the evidence-flag write endpoint and reviewer UI. This stage only creates
the schema and read foundations.
