# Feature: Reviewer experience Stage 4 — evidence review experience

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | complete and verified                      |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 4 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Give internal reviewers an authorized single-file download, complete evidence metadata,
advisory insufficient-evidence annotations, and a bounded ZIP export with a manifest. Feed
insufficient annotations into Stage 3's missing-evidence facet. Keep portal/internal
sessions isolated and keep every object read behind the storage abstraction.

## 2. Why

The internal review service currently emits portal-only evidence URLs. Browser reproduction
confirmed that an authenticated internal admin receives 401 from those links, so the
reviewer cannot inspect the evidence on which a verdict depends. Bulk export and advisory
annotations must build on a corrected internal authorization boundary.

## 3. Plan

Add tenant-scoped internal evidence lookup and annotation methods behind
`AssessmentReviewService` and `ResponseRepository`. Add an internal download route and a
streamed archive route that preflights metadata against a configured byte ceiling, reads
objects through `getStorageDriver()`, sanitizes entry paths, resolves collisions, and adds a
CSV manifest. Render evidence through a dedicated row-local component using existing
Button/Badge/Dialog primitives, with explicit loading/error states for annotations. Keep
annotations advisory and absent from review completion logic.

## 4. Flow impact

Extends F7's internal review surface. Portal evidence upload/download behavior and all
review completion, resend, and verdict routes remain unchanged.

## 5. Data model impact

No schema change: Stage 1 already added `Response.evidence_flags[]`. Stage 4 becomes its
first production writer.

## 6. Work log

| Date       | What was done                                                                    | Files                | Model         |
| ---------- | -------------------------------------------------------------------------------- | -------------------- | ------------- |
| 2026-08-20 | Confirmed the portal-only evidence-link defect with an internal browser session. | Plan/repro/bug trace | Codex (GPT-5) |
| 2026-08-20 | Mapped service, repository, storage, authorization, and reviewer UI boundaries.  | CodeGraph/plan       | Codex (GPT-5) |
| 2026-08-20 | Added tenant-scoped download, annotation, and bounded archive service/routes.    | Service/API/repo     | Codex (GPT-5) |
| 2026-08-20 | Added evidence metadata/actions, ZIP export, and insufficiency facet behavior.   | Review UI            | Codex (GPT-5) |
| 2026-08-20 | Added service and browser regression gates and ran full repository verification. | Tests/docs           | Codex (GPT-5) |

## 7. What didn't work

The first browser probe searched review-queue anchors, but the DataTable uses row
navigation rather than links. The deterministic repro now clicks the Apex row, opens the
review page, and exercises the rendered evidence URL from that page.

Wrapping the first attachment click in `waitForResponse()` did not observe a navigation;
the rendered same-origin URL was exercised directly to establish the original 401. The
first Playwright implementation also treated Base UI anchor-backed buttons as links, but
their accessible role is `button`; using that role plus the download event fixed the
journey. Repeated UI logins encountered the in-memory rate limiter, so the endpoint-
isolation test now injects production-signed internal and portal cookies and leaves login
behavior to the existing authentication suite. The first unquoted shell paths containing
Next.js brackets were expanded by zsh before ESLint ran; quoting them fixed the command.

Installing `archiver` emitted an indirect `jsdom` engine warning because the local Node
24.14.0 is just below that package's declared `^24.15.0`; installation and all verification
still completed with zero vulnerabilities.

## 8. Decisions logged

`DECISIONS.md` 050 records the separate internal evidence boundary, atomic advisory flag,
and metadata-bounded archive design.

## 9. Verification

- Focused Vitest: 3 files, 31 tests passed.
- Playwright: desktop and mobile evidence journey passed 2/2.
- `21st review`: 11 files reviewed, 0 findings.
- `npm run verify`: format, lint, typecheck, 35 files/254 tests, and 35-page production build
  passed. Lint retains only the known TanStack Table compiler advisory.

## 10. Rollback

Safe baseline: `04b77cc71d75947b884ef93626cd25932bbd1db1`. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 5 builds risk and remediation actions on the evidence-aware control surface.
