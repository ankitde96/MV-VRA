# Bug: Internal reviewers cannot download assessment evidence

|                 |                         |
| --------------- | ----------------------- |
| **Status**      | fixed and verified      |
| **Severity**    | high                    |
| **Found**       | 2026-08-20              |
| **Found by**    | review, then reproduced |
| **Models used** | Codex (GPT-5)           |

## 1. Symptom

From the Apex Cloud Systems internal assessment review page, the first attached evidence
link targets `/api/portal/assessments/.../evidence/...`. Exercising that rendered link while
authenticated only as the internal admin returns HTTP 401 with
`{"error":"unauthenticated"}`.

## 2. Expected behaviour

An authenticated internal workspace member who can open the assessment review page can
download evidence belonging to that workspace-scoped assessment. Reviewer Experience Plan
§2.1 and Stage 4 require a distinct internal-session route.

## 3. Reproduction

```text
1. Sign in at /login as admin@mv-vra.local.
2. Open Review queue and select Apex Cloud Systems.
3. Exercise the first rendered attached-evidence link.
4. Observe HTTP 401 from the portal evidence route.
```

Observed review assessment: `6a86ccd1caa7ffed4008c051`; observed control:
`DEMO-CTRL-01`. IDs are seed-local; the route/session mismatch is deterministic.

## 4. Blast radius

Every internal reviewer evidence link is affected. Tenant isolation is involved, but there
is no cross-tenant disclosure: the failure is closed (401), not open. The fix must preserve
that posture by deriving workspace scope from the internal session and resolving the file
key from the response evidence array rather than request input.

## 5. Flow trace

F7 review data → `AssessmentReviewService.getAssessmentReviewData()` → reviewer row link →
portal evidence route. The divergence is at URL construction: the internal service points
at an endpoint that accepts only the separate portal cookie.

## 6. Hypotheses

| #   | Hypothesis                                               | How tested                                      | Result    |
| --- | -------------------------------------------------------- | ----------------------------------------------- | --------- |
| 1   | Internal and portal sessions are intentionally isolated. | Internal browser request to rendered portal URL | Confirmed |
| 2   | The seeded evidence object is missing from storage.      | Route response is auth 401 before object lookup | Ruled out |

## 7. Root cause

`getAssessmentReviewData()` hardcodes reviewer-facing `download_url` values to the portal
route. That route calls `getCurrentPortalSession()` and correctly rejects the internal
cookie. No internal evidence route currently exists.

## 8. What didn't work

The initial automated probe looked for assessment anchors, but the review queue navigates
through clickable DataTable rows. Selecting the seeded vendor row provided the stable repro.

## 9. Fix

`AssessmentReviewService` now emits the dedicated internal evidence URL. That route derives
workspace scope from `requireCurrentMembership()`, resolves the storage key from the
workspace-scoped assessment response and evidence record, and reads only through the
configured storage driver. The portal route remains portal-session-only.

## 10. Verification

The desktop and mobile Playwright journey passed 2/2. It validates the rendered metadata,
internal single-file download, persisted insufficient flag and missing-evidence facet, ZIP
download, internal-cookie rejection at the portal route, portal-cookie rejection at the
internal route, and successful portal download through the portal route. The focused
service suite passed 31/31 and full `npm run verify` passed 35 files/254 tests plus the
production build.

## 11. Regression guard

`e2e/reviewer-evidence.spec.ts` creates disposable tenant-scoped evidence and asserts both
directions of session isolation against a real Next.js server.

## 12. Related

`docs/REVIEWER-EXPERIENCE-PLAN.md` §2.1 and Stage 4;
`docs/features/reviewer-experience-stage-4-evidence-review.md`.
