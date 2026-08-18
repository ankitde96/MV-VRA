# Feature: Questionnaire answering, evidence upload, validation

|                    |                                         |
| ------------------ | --------------------------------------- |
| **Status**         | done                                    |
| **Owner**          | Project owner (solo)                    |
| **Started**        | 2026-08-14                              |
| **Spec reference** | `VRA MVP Feature Specification.md` §2.2 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)     |

## 1. Scope

PLAN.md Phase 7, FLOW.md F3 steps 3–8 (the rest of F3, which Phases 5–6 built the first
half of):

1. Portal renders `template_snapshot` through the same shared evaluator/renderer the Phase
   5 builder preview uses (`question-renderer.tsx`).
2. Conditional logic shows/suppresses follow-ups live as the SPOC answers.
3. Autosave per `control_id` — an idempotent upsert on the existing unique index.
4. Evidence upload bound to a specific control, through the Phase 4 storage module.
5. **Pre-submission validation that skips suppressed questions** — the named exit
   criterion, verified directly by both integration test and real HTTP request with an
   evidence-requiring suppressed question deliberately left unanswered.
6. **Orphaned-upload handling** — evidence upload follows `DATA-MODEL.md` §5's ordering
   (record shell → file → metadata patch), and `scripts/sweep-orphaned-evidence.ts`
   (dry-run by default) reconciles storage against what's actually referenced.

Does **not** include: reviewer-side reading of submitted responses (Phase 8); anything
about risk register, residual scoring, or CAPs.

## 2. Why

Spec §2.2: "Once logged in, they can answer questionnaires and directly upload compliance
evidence," "Dynamic Conditional Logic," "Response Validation & Pre-Screening." `FLOW.md`
F3's own named gap — a suppressed required question must never be flagged "empty and
missing," or submission deadlocks permanently for that assessment — is the single most
important correctness property in this phase; everything else is comparatively low-risk
plumbing once that's right.

## 3. Plan (written before implementing — habit 11)

Read `PLAN.md` Phase 7, `DATA-MODEL.md`'s `responses` section (both the field table and §5's
evidence-upload-ordering rule), and re-read `FLOW.md` F3's gap note before writing anything.
No decision rose to the level of a stop-and-ask — every open point (file-type answer
semantics, the edit-lock boundary, evidence key namespacing, the sweep script's scope, and
`is_suppressed` being left unwritten in favor of recomputing visibility) is an
implementation choice within the phase's stated scope, recorded in `DECISIONS.md` 020
rather than asked about.

Build order: extract the shared upload-constraints module first (Phase 4's vendor-document
upload and this phase's evidence upload need the identical MIME/size rule — the second real
call site is exactly when that's worth factoring out, not before) → add `list()`/`delete()`
to the storage driver interface (needed by the sweep script, and by nothing else) →
`ResponseRepository` → `lib/services/portal-assessment.ts` (the core: answer, upload,
retrieve, submit) → five API routes → the shared renderer's `disabled` prop (needed once a
submitted assessment must render read-only) → the answer form and evidence-upload
components → the sweep script last, once there was real evidence data to reconcile against.

## 4. Flow impact

`FLOW.md` F3 is now **fully built end to end** — steps 0a through 8, spanning Phases 5, 6,
and 7. This closes out the flow entirely; no further work is expected on F3 itself, only on
what F4 (review) does with a submitted assessment's responses.

## 5. Data model impact

- `Response.evidence`'s subdocument schema changed `{ _id: false }` → `{ _id: true }`
  (additive, no data existed yet to migrate) — needed to address one evidence item within
  the array for the download route, the same need Phase 4 solved identically for
  `Vendor.documents`.
- `Response.is_suppressed` exists on the schema but **is never written** by this phase —
  `DECISIONS.md` 020. Do not trust it; call `computeVisibility()` if you need to know.
- No other schema change — `responses` already existed from Phase 1 with the field shapes
  this phase needed otherwise.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Files                                                                                             | Model                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Read `PLAN.md` Phase 7 and `DATA-MODEL.md`'s `responses`/§5. Filled `ROLLBACK.md`'s Active plan. Extracted `lib/uploads/constraints.ts` from Phase 4's vendor-documents service; added `list()`/`delete()` to the storage driver interface (both drivers, S3 mock-tested); built `ResponseRepository`, `lib/services/portal-assessment.ts`, five API routes, the answer form + evidence-upload components, the per-assessment portal page, and `scripts/sweep-orphaned-evidence.ts`. Ran `npm run verify` clean. Verified the full SPOC round trip by real HTTP request: OTP login, live conditional branching, a blocked submission naming the specific missing control, evidence upload, a successful submission, byte-identical evidence retrieval, the post-submission edit lock, cross-vendor tampering refusal, and the sweep script detecting and removing a deliberately-created orphan. Cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH` afterward. | See `ROLLBACK.md`'s Active plan (filled before this phase, cleared after) for the full file list. | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

Nothing abandoned. One false alarm during manual verification: a `grep` for "Which cloud
provider" matched a fresh, unanswered assessment page even though the question should have
been suppressed. Investigating the raw HTML showed the match was inside the serialized RSC
flight-data payload (the full schema passed as a client-component prop, needed for
client-side re-evaluation as the user answers) — not inside the actually-rendered DOM, which
correctly contained only the one visible question. Confirmed by inspecting the rendered
`<body>` directly rather than trusting a substring match against the whole HTTP response.

## 8. Decisions logged

`DECISIONS.md` 020 — file-type answer semantics, edit-lock boundary, evidence namespacing,
sweep script scope, `is_suppressed` left unwritten in favor of recomputing visibility.

## 9. Verification

**Gate 1 + Gate 2 + Gate 3 — via `npm run verify`:**

```
$ npm run verify
...
Checking formatting...
All matched files use Prettier code style!
...
✓ Types generated successfully
...
 Test Files  19 passed (19)
      Tests  131 passed (131)
...
✓ Compiled successfully in 1089ms
...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/portal/assessments/[id]/responses/[controlId]
├ ƒ /api/portal/assessments/[id]/responses/[controlId]/evidence
├ ƒ /api/portal/assessments/[id]/responses/[controlId]/evidence/[evidenceId]
├ ƒ /api/portal/assessments/[id]/submit
├ ƒ /api/portal/auth/logout
├ ƒ /api/portal/auth/otp/request
├ ƒ /api/portal/auth/otp/verify
├ ƒ /api/templates
├ ƒ /api/templates/[id]
├ ƒ /api/templates/[id]/archive
├ ƒ /api/templates/[id]/new-version
├ ƒ /api/templates/[id]/publish
├ ƒ /api/vendors
├ ƒ /api/vendors/[id]/assessments
├ ƒ /api/vendors/[id]/documents
├ ƒ /api/vendors/[id]/documents/[documentId]
├ ƒ /api/vendors/[id]/spoc
├ ƒ /dashboard
├ ○ /login
├ ƒ /portal
├ ƒ /portal/assessments/[id]
├ ○ /portal/login
├ ƒ /templates
├ ƒ /templates/[id]
├ ○ /templates/new
├ ƒ /vendors
├ ƒ /vendors/[id]
└ ○ /vendors/new
```

**Gate 4/5/6, by real HTTP request against a running dev server**, using the same
temporary-password-then-restore pattern as prior phases:

```
$ (vendor + published template with a Cloud/On-premise branch, HOST-02 requiring PDF evidence)
$ curl -X POST /api/vendors/<id>/assessments ...                       → 201, status "sent"
$ (OTP login as the SPOC)

$ curl -X PUT .../responses/HOST-01 {value: "On-premise"}              → 200
$ curl -X POST .../submit  (HOST-02 correctly suppressed)               → 200, "submitted"

$ (fresh assessment) curl /portal/assessments/<id>                      → body has only HOST-01, not HOST-02
$ curl -X PUT .../responses/HOST-01 {value: "Cloud"}                    → 200
$ curl /portal/assessments/<id>                                         → body now includes HOST-02
$ curl -X POST .../submit  (HOST-02 unanswered, no evidence)             → 422 "missing: HOST-02 (unanswered), HOST-02 (missing required evidence)"
$ curl -X PUT .../responses/HOST-02 {value: "AWS"}                      → 200
$ curl -X POST .../responses/HOST-02/evidence -F file=@evidence.pdf     → 201
$ curl -X POST .../submit                                                → 200, "submitted"
$ curl .../evidence/<id>  →  byte-identical to the uploaded file

$ curl -X PUT .../responses/HOST-01  (against the now-submitted assessment) → 403 forbidden
$ curl -X POST .../submit  (again)                                      → 403 forbidden

$ (second vendor's session) curl /portal/assessments/<vendor-1's-id>    → 404
$ (second vendor's session) curl -X PUT .../responses/HOST-01           → 404

$ npm run sweep:evidence                                                 → 0 orphans (1 file, fully referenced)
$ (deleted the DB reference by hand, leaving the file)
$ npm run sweep:evidence                                                 → reports 1 orphan, dry run
$ npm run sweep:evidence -- --delete                                    → deletes it; confirmed gone from disk
```

All ran clean; smoke-test vendors, engagements, assessments, responses, the template, OTP
challenges, and audit events were deleted afterward (`mongosh`), `.storage-local` was
cleared, and `SUPER_ADMIN_PASSWORD_HASH` was restored to its real value and re-seeded.

**Not run:** nothing relevant to this phase was skipped.

## 10. Rollback

Active plan filled in `ROLLBACK.md` before starting. New files can be deleted outright; the
storage-interface (`list()`/`delete()`) and vendor-documents constraints-extraction edits
are both additive/mechanical. No git baseline exists in this repo yet (`DECISIONS.md` 010,
still deferred).

## 11. Follow-ups

- **`Response.is_suppressed` must not be trusted by any future reader** — it is always
  `false` in the database. Phase 8's reviewer view, or any future export/roll-up, must call
  `computeVisibility()` itself if it needs to know whether a question was suppressed.
- Phase 8 (review, risk register) will read submitted `Response` documents as the record of
  what the vendor said — the edit lock this phase added is what makes that record
  trustworthy.
- No API-route-level (as opposed to service-level) test exists for the portal-assessment
  routes' error responses (only the service functions are integration-tested directly) —
  consistent with the same gap already noted for other routes, and covered instead by the
  real-HTTP-request smoke test above.
- The evidence-upload accept-list check is by file extension (case-insensitive), not by
  inspecting file content — a renamed file with the wrong extension for its true content
  would pass; consistent with the MIME-based check already accepted in Phase 4, not a new
  gap introduced here.
