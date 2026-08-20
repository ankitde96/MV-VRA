# REVIEWER-EXPERIENCE-PLAN.md — Reviewer Experience & Reporting Upgrade

> **Status: Stages 0–4 complete and verified on 2026-08-20. Stages 5–7 remain plan-only.**
> Produced through the brainstorming workflow on 2026-08-20. Supersedes nothing; extends
> the completed work in `docs/ASSESSMENT-WORKFLOW-PLAN.md` (Stages 1–5, all shipped).
>
> Read `docs/HANDOVER.md`, `docs/CONSTRAINTS.md`, and this file before starting any stage.
> Nothing here is approved for implementation merely because it is written down — confirm
> scope and priority per stage, and fill `docs/ROLLBACK.md` before Stage 0.

---

## 1. Understanding summary

- **What.** Seven requested improvement areas covering bulk review tooling, the evidence
  review experience, assessment completion, realistic demo data, reviewer productivity,
  risk/remediation integration, and reporting dashboards.
- **Why.** The shipped review flow is correct but unpleasant at real volume: the seeded WFPL
  questionnaire is 130 questions and the review page renders every one of them in a flat
  list with no filter, no search, no progress indicator, and no way to skip to what still
  needs a verdict.
- **Who for.** Internal reviewers first; secondarily anyone demonstrating the product, which
  is why the demo-data work is in scope rather than a throwaway database operation.
- **Key constraints.** Multi-tenant scoping on every new query (`CONSTRAINTS.md` #8), no
  direct database access from components (#9), evidence I/O only through the storage
  abstraction (#10), template snapshots immutable (#11), archives append-only (#12), and no
  auth changes as a side effect (#2).
- **Non-goals.** No AI evidence analysis, no SSO, no external integrations, no background
  job runner, no virus scanning. Those stay in `docs/FUTURE-IDEAS.md`.
- **Shape.** Eight dependency-ordered stages, each independently shippable and verified. No
  priority ordering is asserted — the project owner picks which stages run and when.

## 2. Current state the plan builds on

Verified by reading the code on 2026-08-20:

| Thing               | Where                                                 | State                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review page         | `components/assessments/assessment-review-client.tsx` | 670 lines, 9 `useState` hooks, sections grouped in a `Map`, no filter/search/progress/collapse                                                                                                                            |
| Review service      | `lib/services/assessment-review.ts`                   | 1159 lines; `getAssessmentReviewData`, `markResponseReview`, `resendQuestionnaire`, `raiseRisk`, `createCapTask`, `detectAndEscalateOverdueCaps`, `completeReview`, `listWorkspaceRisks`                                  |
| Reviewer item shape | same file, `ReviewerQuestionItem`                     | already carries `review_status`, `evidence[]`, `associated_risks[]`, `control_status`, `suggested_guidance` — most Stage 3 filters need no new data                                                                       |
| Note autosave       | `hooks/use-debounced-autosave`                        | exists and is wired; only the _visible_ progress is missing                                                                                                                                                               |
| Analytics           | `lib/services/analytics.ts`                           | 957 lines; `getWorkspaceAnalytics`, `getRollupAnalyticsSummary`, `getVendorScorecard`                                                                                                                                     |
| Demo seed           | `scripts/seed-demo-data.ts`                           | Repeatable `.demo.mv-vra.local` dataset with a 25-control snapshot, deterministic response profiles, four storage-backed evidence types, linked service-created risks/CAPs, and one correction round (`DECISIONS.md` 048) |
| Upload rules        | `lib/uploads/constraints.ts`                          | PDF, DOC, DOCX, XLS, XLSX, PNG, JPEG; 10 MB cap. CSV and TXT rejected                                                                                                                                                     |
| CAP task shape      | `lib/db/models/risk.ts`, `cap_tasks[]`                | `owner_type`, `owner_ref`, `due_date`, `status` all already required at the schema level                                                                                                                                  |

**Correction to a working assumption made during brainstorming:** XLSX is already allowed.
Stage 1's allowlist change is CSV and TXT only.

### 2.1 Defect found while mapping Stage 4 — read before starting it

`lib/services/assessment-review.ts:299` builds every reviewer-facing evidence link as:

```
/api/portal/assessments/${assessmentId}/responses/${q.control_id}/evidence/${evidenceId}
```

That route (`app/api/portal/.../evidence/[evidenceId]/route.ts`) authenticates with
`getCurrentPortalSession()` and returns 401 without one. Internal and portal sessions are
deliberately isolated — the e2e suite asserts that isolation. **Code reading therefore
indicates an internal reviewer cannot download evidence from the review page at all.** This
was not reproduced in a browser during planning; confirm it by clicking one evidence link as
an internal reviewer before building on top of it. If confirmed, it is a bug with its own
`docs/bugs/` trace, and Stage 4 should open by fixing it (an internal-session evidence
download route) rather than layering ZIP export over a broken single-file download.

## 3. Decisions taken during brainstorming

| #   | Decision                                                                                  | Alternatives considered                                                                               | Why                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Plan document only; staged sequencing, no priority call                                   | Demo-first, usability-first, full-MVP-closure                                                         | Owner wants the map before committing an order                                                                                                                |
| R2  | Widen the evidence MIME allowlist to CSV and TXT                                          | Keep the allowlist and restrict demo data to accepted types; widen to ZIP as well                     | Vendors genuinely export control listings as CSV; ZIP stays rejected because archives hide payloads and there is no virus scanning yet (`FUTURE-IDEAS.md` §1) |
| R3  | Server-side PDF via `@react-pdf/renderer`                                                 | Print-styled route + browser print (zero deps); headless Chromium via the existing Playwright install | Produces a real file that works headless, so scheduled or emailed reports stay possible later. Cost accepted: a report component tree separate from the UI    |
| R4  | Mitigation owner + due date is a **warning with audit-logged override**, not a hard block | Hard server block; hard block for Tier 1/2 only                                                       | Keeps `completeReview()`'s existing hard gates meaningful while not trapping reviewers behind data they may not have yet                                      |
| R5  | Evidence "insufficient" flag is **advisory only**                                         | Blocks completion                                                                                     | It is a reviewer's working note, not a verdict; it becomes a filter facet instead of a gate                                                                   |
| R6  | The exported report is **internal-only**                                                  | Vendor-shareable                                                                                      | Avoids designing redaction rules in this plan; a vendor-facing variant is a separate decision                                                                 |
| R7  | Stage-sliced by journey                                                                   | Layer-sliced; two parallel tracks                                                                     | Each stage stays independently verifiable, matching how Stages 1–5 ran; parallel tracks would force rework of the demo seed once `evidence_flags` lands       |
| R8  | Decompose the review page before adding features                                          | Extend in place; move filtering server-side                                                           | 130 rows and a growing hook count make in-place growth a re-render problem; server-side filtering adds a round-trip to work that is trivially client-side     |
| R9  | Filter/search/collapse state lives in URL query params                                    | `localStorage`; component state only                                                                  | Survives refresh, is shareable and linkable, and needs no persistence layer                                                                                   |
| R10 | Requested areas #1 and #5 merge into one stage                                            | Ship separately                                                                                       | They share one sticky toolbar and one URL-state model; splitting builds the toolbar twice                                                                     |

## 4. Assumptions

Stated explicitly so they can be corrected rather than discovered:

- Volume per assessment stays around 130 questions; client-side filtering and search are
  adequate and virtualization is not needed yet.
- Total evidence for one assessment stays comfortably under ~100 MB, so a ZIP can be
  streamed in a single request without a job runner.
- Report PDF generation completes synchronously within a request timeout.
- All new fields are additive and null-safe; no migration of existing documents is required
  and no reader may treat absence as a meaningful value.
- New libraries remain pre-approved (`CONSTRAINTS.md` #1, `DECISIONS.md` 038), still pinned
  and documented.
- Analytics continues to treat `due_date` and `next_review_due` as nullable "unknown" and
  never defaults them (`lib/db/models/assessment.ts` comment).
- No authentication logic is touched. The Stage 4 evidence-download fix adds an
  internal-session route; it must not modify session issuance, OTP, or login behavior.

## 5. Stage map

| #   | Stage                                      | Depends on | Requested area     |
| --- | ------------------------------------------ | ---------- | ------------------ |
| 0   | Review-page decompose (no behavior change) | —          | enabler            |
| 1   | Schema & upload foundations                | —          | enabler for #2, #4 |
| 2   | Demo data v2                               | 1          | #4                 |
| 3   | Bulk review + reviewer productivity        | 0, 2       | #1, #5             |
| 4   | Evidence review experience                 | 1, 3       | #2                 |
| 5   | Risk & remediation integration             | 2          | #6                 |
| 6   | Completion workflow + exports              | 4, 5       | #3                 |
| 7   | Reporting & dashboards                     | 2, 5, 6    | #8                 |

---

## Stage 0 — Review-page decompose

**Status: ✅ Complete (2026-08-20).** See
`docs/features/reviewer-experience-stage-0-decomposition.md` and `DECISIONS.md` 046.

**Goal.** Restructure `assessment-review-client.tsx` so later stages are cheap. **Zero
user-visible change.**

**Scope.**

- Replace the verdict/note/save-state `useState` cluster with one `useReducer` over a
  `Record<controlId, {verdict, note, savedAt, error}>` map.
- Extract `<ReviewQuestionRow>` as a `memo`-ised component so a keystroke in one note
  re-renders one row, not 130.
- Extract `<ReviewSection>` for the section grouping that currently happens inline.
- Introduce a `useReviewUrlState()` hook wrapping `useSearchParams` / `router.replace` for
  state that Stage 3 will populate. Ships in Stage 0 with no fields yet.

**Files.** `components/assessments/assessment-review-client.tsx`,
new `components/assessments/review/` directory, new `hooks/use-review-url-state.ts`.

**Verification.** `npm run verify`, plus the existing Playwright correction journey re-run
**unchanged** — it is the proof that behavior did not move. Manual click-through of verdict
marking, note autosave, resend, and completion.

**Risk.** Highest-regression stage in the plan against a flow that is currently verified and
working. Requires a filled-in `docs/ROLLBACK.md` active-plan section with the pre-stage SHA
before the first edit.

---

## Stage 1 — Schema & upload foundations

**Status: ✅ Complete (2026-08-20).** See
`docs/features/reviewer-experience-stage-1-foundations.md` and `DECISIONS.md` 047.

**Goal.** Land every additive data change the later stages read, in one reviewable diff.

**Scope.**

1. **`Response.evidence_flags[]`** — additive subdocument array on
   `lib/db/models/response.ts`: `{ evidence_id, flag: "insufficient", note, flagged_at,
flagged_by }`. Advisory (decision R5); nothing gates on it. Defaults to `[]`, so existing
   documents need no migration.
2. **Widen the upload allowlist** — add `text/csv` and `text/plain` to `ALLOWED_MIME_TYPES`
   in `lib/uploads/constraints.ts`. Because both are permissive types, add an
   extension-agreement check so a declared `text/csv` must arrive as `.csv`. Update the
   `FUTURE-IDEAS.md` §3 entry to record that CSV/TXT are now accepted and ZIP is still not.
3. **Uploader identity** — `ReviewerQuestionItem.evidence[]` exposes `uploaded_at` and an
   `uploaded_by` ObjectId today but no name. Resolve SPOC/user names in
   `getAssessmentReviewData()` with one batched lookup, not per-item queries, and expose
   `uploaded_by_label`.

**Files.** `lib/db/models/response.ts`, `lib/uploads/constraints.ts`,
`lib/services/assessment-review.ts`, `lib/repositories/response-repository.ts`.

**Verification.** Unit tests for the widened allowlist including the rejection cases
(`application/zip`, MIME/extension mismatch, empty file, over-limit). Unit test that
`evidence_flags` defaults to `[]` on documents written before the change.

---

## Stage 2 — Demo data v2

**Status: ✅ Complete (2026-08-20).** See
`docs/features/reviewer-experience-stage-2-demo-data.md` and `DECISIONS.md` 048.

**Goal.** A single repeatable command produces a demo environment that looks like real use.

**Scope.** Extend `scripts/seed-demo-data.ts` — it is already idempotent by the
`.demo.mv-vra.local` suffix, so this is extension, not replacement, and the existing
delete-then-recreate guard already scopes cleanup to demo records only
(`CONSTRAINTS.md` #3 — no unguarded `deleteMany`).

- **Mixed verdicts.** Deterministic per-vendor compliance profile (e.g. a strong vendor at
  ~92% compliant, a weak one at ~60%) rather than random, so screenshots are reproducible
  and the analytics in Stage 7 have a known expected answer.
- **Evidence fixtures.** Four small committed files under `scripts/fixtures/` — PDF, PNG,
  CSV, TXT — written through the storage abstraction, never the S3 SDK
  (`CONSTRAINTS.md` #10). Depends on Stage 1's allowlist for the CSV and TXT ones.
- **Linked risks + CAP tasks.** Several non-compliant controls get a real `raiseRisk` +
  `createCapTask` pair, including at least one CAP task with a past due date so the overdue
  path in Stage 5 and the KRI in Stage 7 have something to show.
- **A complete correction round.** One assessment seeded at `review_round: 1` with a
  populated `changes_requested` history, some controls corrected and re-submitted, showing
  the compliant-control lock behaviour Stage 5 of the previous plan shipped.
- **Command.** Keep `npm run db:seed-demo`. Add a `--reset` flag documented in the README.

**Verification.** Run the script twice; assert record counts are identical after the second
run and that no non-demo record was touched.

---

## Stage 3 — Bulk review + reviewer productivity

**Status: ✅ Complete and verified on 2026-08-20.** See
`docs/features/reviewer-experience-stage-3-productivity.md` and `DECISIONS.md` 049.

**Goal.** Make 130 controls navigable. Requested areas #1 and #5 (decision R10).

**Scope.**

- **Sticky toolbar** at the top of the review page holding everything below.
- **Progress** — `72 / 130 reviewed`, counting only _visible_ controls, using the same
  `computeVisibility()` the server uses so the denominator matches what `completeReview()`
  enforces. Suppressed controls are excluded from both.
- **Filter facets** — unmarked, non-compliant, missing evidence, risk raised. All four are
  computable from `ReviewerQuestionItem` as it already exists. Facets are additive (OR
  within a facet, AND across facets) with per-facet counts shown.
- **Search** by control ID or question text, case-insensitive substring, debounced.
- **Collapsible sections**, with a collapse-all/expand-all control and auto-expansion of any
  section containing a filter match.
- **Keyboard shortcuts** — `j`/`k` move between visible controls, `c` mark compliant, `x`
  mark non-compliant, `n` focus the note, `/` focus search, `?` show a shortcut sheet.
  Disabled while a text input has focus. The shortcut sheet is the discoverability
  mechanism; without it the shortcuts do not exist for anyone.
- **Visible autosave progress** for reviewer notes — the autosave already works; surface
  saving / saved-at / failed-with-retry per row.
- **Persistence** — filters, search, collapse state, and the last-focused control all live
  in URL query params (decision R9). Scroll position restores by scrolling the focused
  control into view on mount, which is more reliable than restoring a pixel offset.

**Files.** `components/assessments/review/*`, `hooks/use-review-url-state.ts`,
plus a new keyboard-shortcut hook.

**Verification.** Unit tests for the filter and progress logic as pure functions over
`ReviewerQuestionItem[]` — including the suppressed-control exclusion. A Playwright journey
that filters to unmarked, marks one via keyboard, refreshes, and asserts the filter and
position survived.

**Accessibility.** The sticky toolbar must not trap focus; shortcuts must not shadow
assistive-technology keys; every filter chip is a real toggle button with `aria-pressed`.

---

## Stage 4 — Evidence review experience

**Status: ✅ Complete and verified on 2026-08-20.** See
`docs/features/reviewer-experience-stage-4-evidence-review.md` and `DECISIONS.md` 050.

**Goal.** Requested area #2. **Open by confirming and fixing the defect in §2.1.**

**Scope.**

1. **Internal evidence download** — an internal-session route
   (`/api/assessments/[id]/responses/[controlId]/evidence/[evidenceId]`) that re-derives
   authorization from the internal session's workspace and the response's own evidence
   array, mirroring the portal route's discipline. `ReviewerQuestionItem.download_url`
   points here instead of at the portal route. This adds a route; it does not touch session
   issuance (`CONSTRAINTS.md` #2).
2. **Evidence metadata display** — filename, size, type icon, upload time, and the
   `uploaded_by_label` from Stage 1, on every evidence item.
3. **ZIP download of all evidence** for an assessment. Streamed from a new internal route
   using an archiver dependency, pulling each object through `lib/storage` only. Entry paths
   are `<section>/<control_id>/<sanitized-filename>`, with a collision suffix. Include a
   generated `manifest.csv` listing control ID, filename, uploader, upload time, and any
   insufficiency flag. Reject the request above a configured total-bytes ceiling with a
   clear message rather than timing out.
4. **Flag evidence as insufficient** — writes `evidence_flags` from Stage 1 with an optional
   note. Advisory (R5): it does not set `review_status` and does not block completion. It
   surfaces as a badge on the evidence item, feeds the "missing evidence" filter facet from
   Stage 3, and appears in the Stage 6 confirmation summary as an informational line.

**Verification.** Service tests for ZIP assembly against the local-fs storage driver,
including the empty-evidence case and the size-ceiling rejection. An authorization test
asserting a portal session cannot reach the internal route and vice versa.

---

## Stage 5 — Risk & remediation integration

**Goal.** Requested area #6.

**Scope.**

- **Prefilled risk from a non-compliant verdict** — marking a control non-compliant offers
  "raise risk", with title, description, `control_id`, and category prefilled from the
  question and its `suggested_guidance` where one exists. The reviewer edits before saving;
  nothing is created silently.
- **Has-risk indicator per control** — `associated_risks[]` is already on
  `ReviewerQuestionItem`, so this is presentation plus the Stage 3 filter facet. Every
  non-compliant control without a risk is visually distinct, because that set is exactly
  what `completeReview()` hard-blocks on.
- **Owner and due date before completion** — surfaced as a warning, overridable, with the
  override recorded as an audit event (decision R4). The existing hard gates on unmarked
  controls and non-compliant-without-risk are unchanged. `cap_tasks[]` already requires
  `owner_type`, `owner_ref`, and `due_date` at the schema level, so this is a completeness
  check across an assessment's risks, not a new field.
- **Overdue remediation on the vendor page** — surface `detectAndEscalateOverdueCaps()`'s
  `OverdueCapQueueItem[]` on `app/(internal)/vendors/[id]/page.tsx`, scoped to that vendor,
  with counts by age bucket and a link into the risk.

**Verification.** Service tests for the override path asserting the audit event is written
and completion still succeeds; tests asserting the existing hard gates did not weaken.

---

## Stage 6 — Completion workflow + exports

**Goal.** Requested area #3.

**Scope.**

- **Confirmation summary dialog** before `completeReview()`, showing: controls reviewed vs
  total, compliant/non-compliant split, risks raised with severity distribution, CAP tasks
  missing owner or due date (warning, overridable), evidence flagged insufficient
  (informational), and the computed `next_review_due`. Blocking problems and warnings are
  visually distinct — a reviewer must be able to tell in one glance which of the two they
  are looking at.
- **The summary is computed server-side** by a new read-only
  `getCompletionSummary(assessmentId)` on the review service, so the dialog and the gate
  agree by construction rather than by two implementations happening to match.
- **CSV export** — one row per control: control ID, section, question, response, verdict,
  reviewer note, evidence count, insufficiency flags, linked risk ID and severity. Built
  server-side with correct quoting and a UTF-8 BOM for Excel.
- **PDF export** via `@react-pdf/renderer` (decision R3), internal-only (R6): cover page
  with vendor, tier, assessment version, review round, dates and reviewer; the summary
  statistics; a section-by-section compliance breakdown; a full non-compliant-control
  appendix with reviewer notes and linked risks. Watermark it as internal.
- Both exports are generated from the assessment's own `template_snapshot`, never the live
  template (`CONSTRAINTS.md` #11), so a historical export stays faithful.

**Verification.** A golden-file test for CSV output. A PDF test asserting the document
generates and contains expected text, not a pixel comparison. A test that the export of a
completed historical assessment is unaffected by a later template version.

---

## Stage 7 — Reporting & dashboards

**Goal.** Requested area #8. Six metrics extending `lib/services/analytics.ts`.

| Metric                                   | Derivation                                                                                            | Trap                                                                                                                                            |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Assessment turnaround time               | `reviewed_at − sent_at`, median and p90                                                               | `sent_at` is null on pre-Stage-4 assessments; exclude, never default                                                                            |
| Review-round count                       | `assessment.review_round` distribution                                                                | Round 0 means "never corrected", not missing data                                                                                               |
| Compliance % by section                  | Responses grouped by the snapshot's section titles                                                    | Section titles are per-snapshot; do not join across template versions by title alone                                                            |
| Frequent failing controls across vendors | `control_id` grouped where `review_status = non_compliant`                                            | Only comparable across assessments sharing a template lineage; scope the aggregation accordingly                                                |
| Evidence completeness rate               | Responses with evidence ÷ responses requiring it                                                      | `FUTURE-IDEAS.md` §4 records that today's KRI approximates this; this is the chance to make it exact using the snapshot's evidence requirements |
| Vendor risk trend between versions       | Per-vendor completed assessments ordered by `reviewed_at`, comparing `overall_score` and compliance % | Needs ≥2 completed assessments; show an explicit "insufficient history" state, not a flat line                                                  |

All aggregations are `workspace_id`-scoped (`CONSTRAINTS.md` #8) and go through the
repository layer (#9). Charts follow the existing `components/charts` conventions and the
locked severity palette in `docs/DESIGN-SYSTEM.md` — that palette is not up for revision
here (`DECISIONS.md` 028).

**Verification.** Service tests against seeded fixtures with hand-computed expected values.
Because Stage 2 makes the demo data deterministic, the demo environment doubles as a
sanity check on every number.

---

## 6. Cross-cutting risks

| Risk                                                                                 | Mitigation                                                                                                                   |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Stage 0 regresses a verified, working review flow                                    | Rollback entry before the first edit; unchanged Playwright journey as the acceptance proof                                   |
| §2.1 evidence defect is worse or wider than described                                | Confirm in a browser first; give it a `docs/bugs/` trace before building Stage 4 on top                                      |
| Widening the MIME allowlist expands the upload attack surface with no virus scanning | CSV/TXT only, ZIP still rejected, extension-agreement check, 10 MB cap unchanged; scanning stays a `FUTURE-IDEAS.md` §1 item |
| ZIP or PDF generation blocking a request thread at real volume                       | Size ceiling with a clear rejection; revisit with a job runner only if the ceiling is actually hit                           |
| Analytics silently defaulting nullable dates and producing confident wrong numbers   | Every metric above names its null case; tests assert exclusion rather than substitution                                      |
| Scope creep across seven areas in one session                                        | One stage per request (`CONSTRAINTS.md` #13); each stage ends with `npm run verify` and its own feature trace                |

## 7. Definition of done, per stage

1. `npm run verify` green, real output pasted, failures and skips stated explicitly
   (`CONSTRAINTS.md` #15).
2. Playwright green where the stage touches a covered journey.
3. A `docs/features/*.md` trace following `docs/features/TEMPLATE.md`.
4. `docs/DECISIONS.md` entries for any decision in §3 that the stage actually implements,
   version-pinned with the model that reasoned through it.
5. `docs/FLOW.md` and `docs/ARCHITECTURE.md` updated when execution paths or module
   boundaries move.
6. `docs/HANDOVER.md` updated with the five-line ritual.

## 8. Open questions for the owner

- Is a vendor-facing variant of the report wanted later? If so, redaction rules (reviewer
  notes especially) need designing before the PDF layout hardens.
- Should the "insufficient evidence" flag notify the vendor, or stay an internal note until
  the reviewer requests corrections through the existing resend flow?
- Is 10 MB per evidence file still the right cap now that CSV exports of control listings
  are in scope?

---

**Model:** Claude Opus 5 (`claude-opus-5`), 2026-08-20.
