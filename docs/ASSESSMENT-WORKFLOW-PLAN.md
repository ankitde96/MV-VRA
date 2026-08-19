# ASSESSMENT-WORKFLOW-PLAN.md — Assessment Workflow Revamp

> Plan of record for the six-part change to how a questionnaire is built, sent, answered and
> reviewed. Companion to `PLAN.md` (which covers the original Phases 0–11) and
> `UI-REVAMP-2-PLAN.md`. Produced with the `brainstorming` skill on 2026-08-19; decisions
> D1–D8 below were confirmed by the project owner before any design was written.
>
> **STATUS: COMPLETE (2026-08-19).** Stages 1–5 are implemented and verified; no stage
> remains. Each stage must be implemented and verified separately; a stage is not done until
> `TEST-CHECKLIST.md`'s gates pass with real pasted output.

---

## 1. Context

Six defects/gaps were reported against the shipped assessment flow. They are not independent
polish items — together they redefine the flow. Today it is: assign a published template →
it is instantly `sent` → the SPOC answers → the assessor raises risks → done. There is no
draft stage, no per-vendor tailoring, no explicit send action, one SPOC per vendor, no
per-question verdict, and no way back to the vendor after review.

### Root causes established by code reading, not assumed

1. **Evidence upload is not missing — it is data-gated.** `EvidenceUpload` is wired into
   `components/portal/assessment-answer-form.tsx:339` but renders only when
   `question.type === "file" || question.evidence`. The real 130-question seeded
   questionnaire (`scripts/seed-questionnaire-template.ts:182-199`) maps the source CSV's
   "Evidence Required" column into `evidence_hint` (a display string) and **never** emits an
   `evidence` object. So the control is invisible on all 130 questions. The server agrees:
   `lib/services/portal-assessment.ts:130` throws `"…does not accept an evidence upload"`.
2. **`assignAssessment()` creates with `status: "sent"` directly**
   (`lib/services/assessment-assignment.ts:68`) — there is no point at which a checklist
   could be tailored before the vendor sees it. `"draft"` is already the schema default and
   is currently **written by nothing**, so the stage exists in the enum and is free.
3. **Assessment history shows a version number and one date** —
   `components/domain/assessment-history-list.tsx`, fed by `getVendorScorecard()`.
4. **SPOC is a single embedded object**, `vendor.spoc` (`lib/db/models/vendor.ts`), and it is
   what portal OTP login resolves against (`lib/auth/otp-challenge.ts:17`).
5. **There is no send action and no recipient concept** — assignment _is_ the send.
6. **There is no per-question reviewer verdict.** `Response.is_failed` / `has_exception`
   exist in the schema but are **written by nothing** in the codebase; `control_status` is
   derived server-side and only ever reads `failed` because a risk exists on that control.

### Two pre-existing defects this plan folds in

- **`completeReview()` has no archived guard and no status guard at all.** It is the only
  risk-adjacent writer missing `assertAssessmentNotArchived()`, and it will happily
  "complete" a `draft` or `sent` assessment.
- **The portal assessment list has no status filter** (`app/(portal)/portal/page.tsx:41-44`).
  Harmless today only because nothing ever writes `draft`; it becomes a real leak the moment
  Stage 3 lands.

### Intended outcome

An admin adds a template to a vendor, tailors that vendor's checklist, explicitly sends it to
chosen SPOCs, the vendor answers with evidence on any question, and the assessor marks each
answer compliant/non-compliant, bounces it back for correction, and can only complete once
every non-compliant item carries a risk.

---

## 2. Decision log

Confirmed by the project owner on 2026-08-19 before design. Recorded in `DECISIONS.md` 040.

| #   | Decision                                                                                                                                          | Alternatives rejected                                                     | Why                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Per-vendor tailoring edits **that one assessment's `template_snapshot`** while it is `draft`. Frozen on send.                                     | A persistent per-vendor template variant collection                       | `template_snapshot` is already a per-assessment frozen deep clone (`DECISIONS.md` 007). No new collection, no new versioning or immutability rules. The published template is never touched, satisfying `CONSTRAINTS.md` #11 by construction.                 |
| D2  | Replace `vendor.spoc` with `vendor.spocs[]`.                                                                                                      | Keep the single SPOC and bolt on an `additional_contacts[]` array         | Cleanest end state; avoids two parallel notions of "SPOC" forever. Auth-touching, so isolated into its own stage with its own rollback plan (`CONSTRAINTS.md` #2).                                                                                            |
| D3  | `completeReview()` **hard-blocks server-side** unless every visible question is marked and every non-compliant one has a risk.                    | Warn-only in the UI                                                       | Mirrors `completeOffboarding()`'s existing readiness gates. A silently-closed un-triaged control is the exact under-assessment failure `DATA-MODEL.md` §4 exists to prevent.                                                                                  |
| D4  | Evidence upload available on **every** question; `evidence.required` still blocks submission; `evidence_hint` shown as guidance.                  | Show the control only where `evidence_hint` or `evidence.required` is set | Fixes the real seeded questionnaire without re-authoring 130 questions **and without migrating any already-frozen `template_snapshot`** — relaxing the gate is snapshot-agnostic. Also lets a vendor attach something the template author did not anticipate. |
| D5  | Unticked SPOCs lose access to **that assessment only** (404, indistinguishable from missing). They keep access to other assessments sent to them. | The tick list drives only the notification email                          | Matches "that person will only get the access" literally, without inventing per-vendor account disabling.                                                                                                                                                     |
| D6  | On resend, **only non-compliant questions re-open**; compliant ones lock read-only with their verdict shown.                                      | The whole questionnaire re-opens                                          | Stops an already-approved answer changing silently after approval, and keeps each review round bounded.                                                                                                                                                       |
| D7  | Five stages, each independently verified, each leaving the app working.                                                                           | One combined change set                                                   | `CONSTRAINTS.md` #13. A single diff touching schema, auth, portal and review at once is not reviewable or revertable.                                                                                                                                         |
| D8  | The portal session gains `spocId` in **Stage 2**, even though it is first _used_ in Stage 4.                                                      | Add it in Stage 4 alongside its first reader                              | Keeps every authentication change inside the one stage that already carries an auth rollback plan, rather than touching `lib/auth/**` twice. A deliberate, documented exception to YAGNI.                                                                     |

---

## 3. Assumptions

- **Console-only mail.** The three new emails go through `getMailer()`. `lib/mail` has two
  production call sites today and only a `console` transport; `lib/mail/console.ts` states
  the reason: _"sent emails cannot be rolled back, so nothing in this codebase points at a
  real sender yet."_ Choosing a real provider stays an open, separate decision
  (`ARCHITECTURE.md` §7). **These flows are therefore not deliverable to real vendors until
  that decision is made.**
- **Scale is unchanged** — the existing single-instance, no-HA target. Nothing here alters
  the in-memory rate limiter's known multi-instance limitation (`DECISIONS.md` 019).
- **Existing `sent` assessments keep working.** The draft-first flow is additive; records
  already in `sent`/`submitted`/`completed` are unaffected and need no migration.
- **`MailMessage` stays `{to, subject, text}`** — no HTML, no cc. Not grown for this work.
- **The upload MIME allowlist is unchanged** (`lib/uploads/constraints.ts`: pdf, doc/docx,
  xls/xlsx, png, jpeg; 10 MB). No zip, no csv, no txt. Flagged as an open question below
  rather than widened silently.

---

## 4. Stages

### Stage 1 — Evidence upload on every question _(requirement #1)_

Smallest change, unblocks vendors immediately, depends on nothing.

**Portal client** — `components/portal/assessment-answer-form.tsx`

- Drop the `question.evidence` condition at the render gate (~line 339): always render
  `EvidenceUpload`. Keep the separate `question.type !== "file"` guard that suppresses the
  normal input for file-type questions.
- Pass `accept={question.evidence?.accept}` unchanged (undefined ⇒ accept anything the
  server's `ALLOWED_MIME_TYPES` permits).
- Label the control **Optional** unless `question.evidence?.required`. `QuestionLabel`
  (`components/questionnaire/question-renderer.tsx`) already renders `evidence_hint` — no
  change needed there.

**Portal service** — `lib/services/portal-assessment.ts`

- Remove the `if (!question.evidence) throw new ValidationError(...)` guard (~line 130).
- Keep the extension check, but apply it **only when `question.evidence?.accept` is set**.
- `validateUploadedFile()` (`lib/uploads/constraints.ts`) still gates MIME and the 10 MB cap
  for every upload — that becomes the sole file-type authority for un-flagged questions.
- `submitAssessment()` is **unchanged**: `question.evidence?.required` remains the submit
  blocker. Optional uploads never block.

**New — evidence deletion** (needed by Stage 5; a real gap today — no DELETE route exists)

- `deleteEvidence(session, assessmentId, controlId, evidenceId)` — editable-status guard,
  `responseRepo.pullEvidence()`, then `storage.delete(file_key)`. Delete the record first,
  then the file, mirroring the existing fail-toward-orphan ordering (`DATA-MODEL.md` §5) so
  `scripts/sweep-orphaned-evidence.ts` remains the backstop.
- `DELETE /api/portal/assessments/[id]/responses/[controlId]/evidence/[evidenceId]`.

**Not doing:** re-authoring the seeded template, migrating existing `template_snapshot`s, or
widening `ALLOWED_MIME_TYPES`.

**Verify:** upload a PDF against a plain `single_select` WFPL question in the portal;
re-download it byte-identical; confirm submission still blocks when a question with
`evidence.required` has none; delete an upload and confirm the sweep script reports zero
orphans.

---

### Stage 2 — Multiple Vendor SPOCs _(requirement #4)_ — ⚠ AUTH-TOUCHING

Fill `ROLLBACK.md`'s Active plan **before starting** (`CONSTRAINTS.md` #2, #9).

**Model** — `lib/db/models/vendor.ts`

```ts
const spocEntrySchema = new Schema({           // { _id: true } — the id is the recipient ref
  name:   { type: String, required: true },
  email:  { type: String, required: true, lowercase: true, trim: true },
  phone:  { type: String, required: true },
  is_primary: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
});
spocs: { type: [spocEntrySchema], default: [] },
```

- Additive. Leave the legacy `spoc` object **on the schema and in the data** — do not delete
  it (`CONSTRAINTS.md` #3; `DATA-MODEL.md` §6 forbids repurposing a field in place). It
  becomes read-by-nothing after this stage; removing it is a separate later cleanup.
- Index: add `{ "spocs.email": 1 }`. Keep the existing `{ "spoc.spoc_email": 1 }` until the
  legacy field is dropped. Both are deliberate exceptions to workspace-id-first
  (`DATA-MODEL.md` §2) for the same documented reason.
- Enforce in the service layer: at least one `active` SPOC, exactly one `is_primary`.

**Migration** — new `scripts/migrate-vendor-spocs.ts`, idempotent, additive-only (no
`deleteMany`, no unguarded `updateMany`): for each vendor with an empty `spocs`, push
`{ name: spoc.spoc_name, email: spoc.spoc_email, phone: spoc.spoc_phone, is_primary: true,
status: "active" }`. Add to `package.json` and README's Getting Started sequence.

**Every reader to switch** (exhaustive — found by grep, all confirmed):

| File                                                              | Change                                                                                                                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/auth/otp-challenge.ts:17`                                    | `findVendorBySpocEmail` → match `{ spocs: { $elemMatch: { email, status: "active" } } }`; return the matched **spoc `_id`** alongside the vendor. An `inactive` SPOC can no longer log in. |
| `lib/services/portal-auth.ts:88`                                  | OTP mail `to:` → the matched SPOC's email, not the primary's                                                                                                                               |
| `lib/services/portal-auth.ts:126`                                 | dev-credential lookup → `spocs.email`                                                                                                                                                      |
| `lib/services/assessment-review.ts:752`                           | CAP vendor-owner email → the vendor's **primary** SPOC                                                                                                                                     |
| `app/(internal)/vendors/page.tsx:52`                              | table column → primary email + `+N` count                                                                                                                                                  |
| `lib/repositories/vendor-repository.ts`                           | `updateSpoc()` → `addSpoc()` / `updateSpoc(spocId, …)` / `setSpocStatus()` / `setPrimarySpoc()`                                                                                            |
| `lib/services/vendor-intake.ts:91`, `lib/services/vendor-spoc.ts` | write/read `spocs[]`                                                                                                                                                                       |
| `scripts/seed.ts:187`, `scripts/seed-demo-data.ts:169`            | seed two SPOCs on at least one vendor                                                                                                                                                      |

**Portal session (D8)** — `lib/auth/portal-session.ts`

- `PortalSessionPayload` gains `spocId: string`. `verifyPortalSessionToken()` rejects a token
  without it, so pre-existing cookies force one re-login — negligible at the 1-hour TTL, and
  strictly safer than defaulting the field.
- `spocId` is set **once at OTP-verify time from the matched challenge**, never from a
  request parameter — the same rule `vendorId` already follows (`FLOW.md` F2 gap (b)).
- Nothing reads `spocId` yet. Stage 4 does.

**UI**

- `components/spoc-edit-form.tsx` → a list with add / edit / deactivate / set-primary rows.
- `components/vendor-intake-form.tsx` → repeatable SPOC block, minimum one, first is primary.
- Routes: `POST /api/vendors/[id]/spocs`, `PATCH|DELETE /api/vendors/[id]/spocs/[spocId]`
  (`vendor.write`). Retire `PATCH /api/vendors/[id]/spoc`.

**Verify:** run the migration against seeded data; OTP-log-in as the _second_ SPOC of a
vendor and confirm the session is scoped to that vendor; confirm a deactivated SPOC's OTP
request still returns the byte-identical `{ok:true}` enumeration-safe response but issues no
code; re-run the Gate 4 portal attack-class checks in `TEST-CHECKLIST.md`.

---

### Stage 3 — Draft assessments and per-vendor checklist editing _(requirement #2)_

**`lib/services/assessment-assignment.ts`** — `assignAssessment()` now creates a **draft**:

- `status: "draft"`, `assigned_at: now`, **no `due_date`** (moves to send — the SLA should run
  from when the vendor actually receives it), and a new additive `template_name` field on the
  assessment so history can render the name without a join.
- **Move** the `engagement.status → "in_assessment"` transition out of assignment and into
  send (Stage 4) — an untouched draft must not claim the engagement is under assessment.

**New — snapshot editing**

- `AssessmentRepository.updateDraftSnapshot(id, snapshot)` — filters `status: "draft"` **in
  the query itself**, exactly as `TemplateRepository.updateDraft()` does. A stale reference to
  an already-sent assessment matches zero documents. This is the structural immutability
  mechanism, not a service-layer check.
- `updateAssessmentChecklist(ctx, actor, assessmentId, questions_schema)` — validates with the
  existing `questionsSchemaSchema` (Zod, `lib/questionnaire/schema.ts`) **and**
  `validateQuestionsSchemaStructure()` (`lib/questionnaire/validate-schema.ts`, the
  no-forward-reference rule), then writes. Audit `assessment.checklist_updated`.
- `PATCH /api/assessments/[id]/checklist`, capability `assessment.assign`.

**UI reuse — do not fork the builder.** Extract the per-question editor currently inline in
`components/templates/template-builder-form.tsx` into a shared
`components/questionnaire/question-editor.tsx`, and reuse `hydrateSchema()` /
`serializeSchema()` / `priorControlIds()` from `components/templates/builder-state.ts`
verbatim. The vendor checklist editor and the template builder must not diverge — the same
argument `DECISIONS.md` 018 made for the preview sharing one renderer.

**Portal must not see drafts** (currently it would — `app/(portal)/portal/page.tsx:41-44` has
no status filter):

- Filter the portal list to exclude `draft`.
- `getVendorAssessment()` (`lib/services/portal-assessment.ts`) throws `NotFoundError` for a
  `draft`, consistent with how cross-vendor tampering is already handled.

**Verify:** assign a template, confirm it is `draft` and invisible in the portal; add, edit
and delete a question; confirm the source `QuestionnaireTemplate.questions_schema` is
byte-identical afterwards; confirm a second assessment for the same vendor starts from the
clean published template; confirm a `PATCH …/checklist` against a sent assessment is refused.

---

### Stage 4 — Send modal, recipients, and history columns _(requirements #5, #3)_

Depends on Stages 2 and 3.

**Assessment model** — additive: `recipients: [ObjectId]` (SPOC subdoc ids), `sent_at`,
`last_activity_at`.

**`sendAssessment(ctx, actor, assessmentId, { spocIds })`** — new, in the assignment service:

- Draft-only, enforced by a `status: "draft"` query filter (same mechanism as above).
- Rejects an empty `spocIds`, and any id that is not an `active` SPOC of **that** vendor —
  never a caller-supplied vendor, the same rule `createCapTask()` applies
  (`DECISIONS.md` 022).
- One transaction: `status → "sent"`, stamp `sent_at`, compute `due_date` from
  `workspace.settings.assessment_response_sla_days`, set `recipients`, and move the engagement
  to `in_assessment`. Audit `assessment.sent`.
- Emails each selected SPOC via `getMailer()`.
- `POST /api/assessments/[id]/send`, capability `assessment.assign`.

**Recipient scoping (D5)** — `lib/services/portal-assessment.ts`

- The portal list filters `recipients: session.spocId`; `getVendorAssessment()` re-checks it
  and throws `NotFoundError` (404, **not** 403) when absent — indistinguishable from a missing
  record, matching the existing cross-vendor rule.

**`last_activity_at`** — the "last update" column. Assessment `updated_at` is useless for
this: responses are a separate collection, so a vendor answering never bumps it. Stamp
`last_activity_at` explicitly from `saveResponse`, `uploadEvidence`, `deleteEvidence`,
`submitAssessment`, `markResponseReview`, `resendQuestionnaire` and `completeReview`.

**Vendor page restructure** — `app/(internal)/vendors/[id]/page.tsx`

- New **"Questionnaires"** section: add-template → edit-checklist → **Send questionnaire**.
  This is where assignment lives. `components/assessments/assign-assessment-form.tsx` is
  reworked for the draft flow and no longer lists history inline.
- **"Assessment history"** becomes read-only and moves out of the scorecard card into its own
  section, replacing `components/domain/assessment-history-list.tsx` with a `DataTable`
  (reuse `components/data-table`) with exactly four columns:

  | Column        | Source                                    |
  | ------------- | ----------------------------------------- |
  | Questionnaire | `template_name` + `v{template_version}`   |
  | Started       | `sent_at` (null for a draft → "Not sent") |
  | Last update   | `last_activity_at`                        |
  | Status        | plain-language map below                  |

- **Plain-language status map** — one shared helper, used by the history table, the portal and
  the review queue so the three cannot drift:

  | Internal status                            | Displayed                    |
  | ------------------------------------------ | ---------------------------- |
  | `draft`                                    | Draft — not sent             |
  | `sent`, `in_progress`, `changes_requested` | Pending response from vendor |
  | `submitted`, `under_review`                | Pending review               |
  | `completed`                                | Completed                    |
  | `archived`                                 | Archived                     |

- `getVendorScorecard()` (`lib/services/analytics.ts`) must select the new fields for
  `assessment_history`.

**New modal** — `components/assessments/send-questionnaire-dialog.tsx`: lists every active
SPOC with name/email/phone, **all checked by default**, refuses submit with zero checked, and
states plainly that unchecked SPOCs will not be able to open this assessment.

**Verify:** send to one of two SPOCs; log in as each and confirm the assessment is listed for
one and 404s for the other by direct URL; confirm the history table's four columns against
direct DB reads; confirm `last_activity_at` moves when the vendor autosaves an answer.

---

### Stage 5 — Per-question compliance marking and the resend loop _(requirement #6)_

Depends on Stages 1 and 4.

**Response model** — additive: `review_status: enum ["compliant","non_compliant"] | null`
(default `null` = unmarked), `reviewer_note: String`, `reviewed_at`, `reviewed_by`,
`review_round: Number`. Leave the never-written `is_failed` / `has_exception` alone rather
than repurposing them (`DATA-MODEL.md` §6) — `getAssessmentReviewData()` prefers
`review_status` when set and falls back to today's derivation otherwise.

**Assessment** — additive `review_round: Number` (default 0), and a new `changes_requested`
status appended to the enum. `EDITABLE_STATUSES` in **both**
`lib/services/portal-assessment.ts:32` and `app/(portal)/portal/assessments/[id]/page.tsx:7`
gains it — those two are a duplicated literal today; extract to one shared constant.

**Marking, autosaved** — `markResponseReview(assessmentId, controlId, { review_status,
reviewer_note })`; `PATCH /api/assessments/[id]/responses/[controlId]/review`, capability
`assessment.review`. Advances `submitted → under_review` on the first mark (today only
`raiseRisk()` does that). Extract the portal's hand-rolled 400 ms per-control debounce
(`assessment-answer-form.tsx:145`, `saveTimers`/`pendingValues` refs) into a shared
`hooks/use-debounced-autosave.ts` and use it on both surfaces — same persistent "Saved HH:MM"
affordance required by `DESIGN-SYSTEM.md` §7 rule 1.

**Resend** — `resendQuestionnaire(assessmentId, actor)`:

- Refuses unless at least one response is `non_compliant`.
- `status → "changes_requested"`, `review_round += 1`, stamp `resent_by` / `resent_at`.
- Emails every recipient SPOC a per-question verdict summary.
- `POST /api/assessments/[id]/resend`, capability `assessment.review`.

**Vendor's correction round** — portal, when `status === "changes_requested"` (D6):

- Compliant questions render read-only with a ✓ verdict badge; non-compliant ones are
  editable, show `reviewer_note`, and allow evidence add/delete (Stage 1).
- `saveResponse` / `uploadEvidence` / `deleteEvidence` **refuse** a control whose
  `review_status` is `compliant` in the current round — enforced server-side, not by a
  disabled input, matching how the edit-lock is already enforced (`DECISIONS.md` 020).
- `submitAssessment` in a resend round validates only the non-compliant set, returns the
  assessment to `submitted`, and emails `resent_by`.

**Completion gate (D3)** — `completeReview()`:

- Add the missing `assertAssessmentNotArchived()` call — a real pre-existing gap; this is the
  only risk-adjacent writer without it.
- Add a status guard: refuse unless `submitted` or `under_review`.
- Refuse (422) listing the offending `control_id`s when any visible non-suppressed question is
  unmarked, or any `non_compliant` question has no `Risk` on that `control_id`.

**Risk register** — no change needed: `raiseRisk()` already stamps `vendor_id`, so risks
already reach both the register (`listWorkspaceRisks()`) and the vendor scorecard
(`getVendorScorecard()`). Add a per-vendor open-risk list to the vendor page for visibility.

**Also fix while here:** `getAssessmentReviewData()`'s `passedCount` only increments when
`hasAnswer`, so a non-required unanswered question is labelled `passed` but counted in no
bucket. Explicit `review_status` supersedes this; make the metrics agree.

**Verify:** mark a mix of compliant/non-compliant, confirm autosave persists across reload;
confirm resend is refused with zero non-compliant; resend and confirm the vendor sees exactly
the non-compliant set editable and is refused server-side on a compliant control; resubmit;
confirm `completeReview` 422s while a non-compliant control has no risk and succeeds once it
does; confirm the risk appears in the register and on the vendor page.

---

## 5. Cross-cutting rules

**Every stage must:** keep `workspace_id` scoping intact (`CONSTRAINTS.md` #8); go through
route → service → repository, never a model from a component (#9); leave published templates
untouched (#11) and archived records immutable (#12); fill `ROLLBACK.md`'s Active plan before
starting; and append to `DECISIONS.md` with the reasoning model recorded.

**Docs to update as the stages land:** `FLOW.md` (F3 and F4 both change shape),
`ARCHITECTURE.md` (§2 stack table, §4 module map, §5 collections), `DATA-MODEL.md` (§2
vendors/assessments/responses), `TEST-CHECKLIST.md` (new gate items), `HANDOVER.md` (the
five-line ritual), and a trace per stage in `docs/features/`.

---

## 6. Verification

Per stage, in this order — a stage is not done until all four pass and the **real** output is
pasted, not paraphrased (`CONSTRAINTS.md` #15):

1. **`npm run verify`** — format:check, lint, typecheck, test, build. Baseline is 206/206
   tests green; lint carries one known TanStack React Compiler advisory and zero errors.
2. **New automated tests**, against a real MongoDB replica set (`rs0` — `DECISIONS.md` 014):
   - S1: evidence upload accepted on a question with no `evidence` config; `evidence.required`
     still blocks submission; delete removes both record and file.
   - S2: `lib/services/__tests__/portal-auth.test.ts` extended — second SPOC logs in, inactive
     SPOC cannot, enumeration response still byte-identical.
   - S3: snapshot edit refused on a sent assessment; source template unchanged after edit.
   - S4: unticked SPOC gets `NotFoundError`; `last_activity_at` moves on autosave.
   - S5: `completeReview` 422 cases; compliant-control write refused in a resend round; resend
     refused with zero non-compliant.
3. **Real HTTP request against `npm run dev`** — the discipline every prior phase used, and the
   one that caught two real bugs in UI Revamp Round 2 that typecheck/lint/tests did not. Drive
   the full loop end to end: add template → edit checklist → send to one of two SPOCs → answer
   with evidence → submit → mark → resend → correct → resubmit → complete → confirm the risk
   in the register.
4. **`npm run test:e2e`** — the Playwright gate (desktop Chromium + Pixel 7, currently 14/14).
   Extend `e2e/` with the send-modal recipient scoping and the resend round, since those are
   the two new externally-reachable behaviours.

Use disposable fixture vendors/SPOCs/assessments and delete them afterwards, as every prior
phase did.

---

## 7. Open questions

- **Which real mail provider sends these three emails in production?** Still unanswered
  (`ARCHITECTURE.md` §7). Until it is, Stages 4 and 5 are functionally console-only.
- **Should the upload MIME allowlist widen?** Vendors may reasonably want to send `.zip`,
  `.csv` or `.txt` evidence; today all three are rejected by `lib/uploads/constraints.ts`.
  Not widened as part of this plan — its own decision.
- **When is the legacy `vendor.spoc` field dropped?** Stage 2 leaves it in place
  deliberately. Removing it, and its index, is a separate later cleanup.
- **Should a resend round be capped?** Nothing in this plan limits how many times an
  assessment can bounce between assessor and vendor. `review_round` makes a cap easy to add
  later if one is ever wanted.
