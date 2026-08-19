# Feature: Assessment workflow Stage 1 — evidence upload on every question

> `ASSESSMENT-WORKFLOW-PLAN.md` Stage 1. Guide habit 5.

|                    |                                                              |
| ------------------ | ------------------------------------------------------------ |
| **Status**         | done                                                         |
| **Owner**          | Project owner                                                |
| **Started**        | 2026-08-19                                                   |
| **Spec reference** | `ASSESSMENT-WORKFLOW-PLAN.md` §4 Stage 1, `DECISIONS.md` 040 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)                          |

## 1. Scope

Evidence upload is offered on every question in the vendor portal, not only ones whose
template schema carries an `evidence` object. `evidence.required` still blocks submission
where set; an upload on a question with no `evidence` config is optional and never blocks.
Adds evidence deletion (previously no route existed at all). Does **not** re-author the
seeded WFPL template, migrate any existing `template_snapshot`, or widen the upload MIME
allowlist.

## 2. Why

The real 130-question seeded questionnaire (`scripts/seed-questionnaire-template.ts`) maps
its source CSV's "Evidence Required" column into `evidence_hint` (a display string) only —
it never sets an `evidence` object. The portal's render gate and the server's upload guard
both keyed on that object, so the control was invisible and the upload was rejected on all
130 questions. Reported by the project owner as "the vendor portal doesn't have the option
for evidence upload."

## 3. Plan (written before implementing — habit 11)

Relax both gates instead of re-authoring the template: this fixes every already-frozen
`template_snapshot` at once, where re-authoring the template would fix none of them (a
frozen snapshot outlives any later template edit — `DECISIONS.md` 007). Agreed with the
project owner as decision D4 in `ASSESSMENT-WORKFLOW-PLAN.md` before any code was written.

## 4. Flow impact

`FLOW.md` F3 step 6 ("Evidence uploads go through the storage module") is unchanged in
shape — evidence still lands the same way, namespaced the same way. The only behavioral
change is which questions may carry it, and that a vendor may now remove one before
submitting. `FLOW.md` not updated with a new numbered step for this — the existing step 6
description already covers the mechanism; only the gate condition moved from the service
docstring to this trace.

## 5. Data model impact

None. No schema field added or changed. `Response.evidence[]` gained no new subdocument
shape — deletion uses `$pull` against the existing `_id`.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Files                                                                                                                                                                                                                                                                                                                                                                                          | Model                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-19 | Filled `ROLLBACK.md`'s Active plan. Dropped the `question.evidence` render gate in `assessment-answer-form.tsx` — `EvidenceUpload` always renders, labeled "(required)"/"(optional)" from `question.evidence?.required`. Removed the `"does not accept an evidence upload"` throw in `uploadEvidence()`; the accept-list extension check now only runs when the template set one. Added `deleteEvidence()`, `ResponseRepository.pullEvidence()`, a `DELETE` route, and a delete affordance in `EvidenceUpload`. Extended the integration test suite (net +3 tests). Ran the full gate suite and a real-HTTP-driven manual walkthrough against a disposable fixture assessment (dev vendor, `npm run dev`). | `components/portal/assessment-answer-form.tsx`, `components/portal/evidence-upload.tsx`, `lib/services/portal-assessment.ts`, `lib/repositories/response-repository.ts`, `lib/storage/types.ts` (comment only), `app/api/portal/assessments/[id]/responses/[controlId]/evidence/[evidenceId]/route.ts` (adds `DELETE`), `lib/services/__tests__/portal-assessment.test.ts`, `docs/ROLLBACK.md` | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

Nothing abandoned. One environment gap surfaced and was worked around, not a design
dead-end: `node_modules` was missing `@playwright/test` and its Chromium binary at session
start (unrelated to this change — confirmed by reproducing the same failure on `git stash`).
`npm install` restored the package; the Chromium binary download itself is blocked by this
sandbox's TLS interception (`self-signed certificate in certificate chain`), so `npm run
test:e2e` could not be run for this stage — see §9.

## 8. Decisions logged

`DECISIONS.md` 040 (D4, decided before this stage started — planning session).

## 9. Verification

**`npm run verify` components, actual output:**

- `format:check` — `All matched files use Prettier code style!`
- `lint` — 0 errors, 1 pre-existing TanStack React Compiler advisory (unrelated to this
  change, present on the baseline tree too).
- `typecheck` — clean, after `npm install` restored `@playwright/test`'s type declarations
  (confirmed the failure reproduced identically on `git stash` before the install, so it was
  an environment gap, not caused by this change).
- `test` — `Test Files 29 passed (29)`, `Tests 209 passed (209)` (baseline 206 + 3 net new:
  replaced "rejects an evidence upload for a question with no evidence config" with an
  "accepts" test plus a MIME-still-rejected test, and added two delete tests).
- `build` — `next build` requires `SESSION_SECRET`/`OTP_HMAC_SECRET` once it runs with
  production semantics; `.env.local` has never set either (confirmed identical failure on
  `git stash` — pre-existing, not caused by this change). Re-ran with disposable throwaway
  values passed via the shell environment only (never written to `.env.local` or committed)
  and the build completed, producing the full route manifest with no errors.

**Real HTTP request against `npm run dev`**, using the seeded dev-vendor OTP shortcut
(`vendor@mv-vra.local` / `123456`, `lib/auth/dev-vendor-credentials.ts` — development-only)
and a disposable engagement + `sent` assessment inserted directly for that vendor
(`PLAIN-01`: `single_select`, no `evidence` config; `EVID-01`: `text`, `evidence.required:
true`):

- `POST .../responses/PLAIN-01/evidence` with a PDF → `201`, `{"evidence":{"filename":
"proof.pdf", ...}}` — succeeds on a question with **no** `evidence` config, the exact
  reported defect.
- `GET .../evidence/{id}` → byte-identical to the uploaded file (`diff` reported no
  difference).
- `DELETE .../evidence/{id}` → `{"ok":true}`, `200`; a subsequent `GET` on the same id →
  `404 not_found`.
- `POST .../submit` with `EVID-01` still unanswered/no evidence → `422`,
  `"Cannot submit — missing: EVID-01 (missing required evidence)"` — the required-evidence
  blocker is unchanged.
- Attached evidence to `EVID-01`, then `POST .../submit` → `200`,
  `{"assessment":{"status":"submitted"}}`.
- `npm run sweep:evidence` (dry run) → `Orphaned files (no owning record): 0` both
  immediately after the delete and again after the fixture assessment/engagement/response
  documents were removed (one orphan appeared at that point, as expected — deleting a
  document doesn't delete its file — then removed with `--delete` and reverified clean).

**Not run:** `npm run test:e2e` (Playwright browser gate) — blocked in this sandbox by a TLS
interception error on the Chromium binary download (`self-signed certificate in certificate
chain`), not a code regression. The externally-reachable behavior it would have covered for
this stage (portal evidence upload/download/delete) was instead verified above by direct
HTTP request against a real running server. Flagged in `HANDOVER.md` for a session with
network access to actually run the browser gate.

## 10. Rollback

Safe baseline: `2b72d13d914386fd977c44e44180ca72ecb17c69`. See `ROLLBACK.md`'s Active plan
for the full file list; `git restore` per file is sufficient — no schema, auth, or
destructive write in this stage.

## 11. Follow-ups

- The upload MIME allowlist (`lib/uploads/constraints.ts`) is unchanged — no zip/csv/txt.
  Flagged as an open question in `ASSESSMENT-WORKFLOW-PLAN.md` §7, not resolved here.
- `npm run test:e2e` should be run for real in an environment with network access before
  this stage is considered fully proven end-to-end; the manual HTTP walkthrough above covers
  the same surface but isn't part of the automated regression suite.
- Stage 2 (multiple Vendor SPOCs) is next, and is auth-touching per `CONSTRAINTS.md` #2.
