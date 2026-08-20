# OPPORTUNITY-MAP.md — Ranked "what else can we do here"

> **Status: research artifact. Nothing here is approved work.** Produced 2026-08-20 through
> the brainstorming workflow at the project owner's request ("understand the whole project
> and tell me what else we can do — UI, performance, vendor-risk features, anything").
>
> Relationship to other docs:
>
> - `docs/FUTURE-IDEAS.md` stays the **canonical holding area** — the unranked inventory of
>   deferred items. This file does not replace it; it **ranks and argues**, and points back
>   into it. Where an item already exists there, it is cited rather than restated.
> - `docs/REVIEWER-EXPERIENCE-PLAN.md` Stages 6–7 are **already planned and still unbuilt**.
>   They are listed here for sequencing only; their design lives in that file.
> - Items tagged **[PARKED]** touch `VRA MVP Feature Specification.md` §4 and are blocked by
>   `CONSTRAINTS.md` #6. They are described here because the owner asked for the full
>   landscape. Starting one requires explicit owner approval in-session.

---

## 1. Understanding summary

- **What this is.** A ranked opportunity map across four axes: reviewer/product features,
  UI, performance and scale, and operational readiness.
- **Why now.** Phases 0–11 plus assessment-workflow Stages 1–5 and reviewer-experience
  Stages 0–5 are complete and verified. The workflow engine is functionally whole; the next
  wins are in throughput, evidence quality, and closing the loop after review.
- **Who it is for.** The project owner deciding what to fund next, and any future session
  looking for a defensible starting point.
- **Key constraints.** Multi-tenant scoping (#8), no direct DB access from components (#9),
  storage abstraction only (#10), immutable template snapshots (#11), append-only archives
  (#12), no side-effect auth changes (#2), MVP scope discipline (#6), one logical change per
  request (#13).
- **Explicit non-goals of this document.** No implementation, no schema changes, no
  estimates presented as commitments.

## 2. Assumptions

Marked explicitly because they were not confirmed by the owner:

1. **A1 — Volume.** Target stays tens of workspaces, low thousands of vendors, low tens of
   thousands of assessments (`PLAN.md` A1). Perf items are ranked against that, not against
   a hypothetical enterprise load.
2. **A2 — Single instance.** The app still runs as one Node process in production. This is
   load-bearing for the in-memory OTP limiter and for anything that would add a scheduler.
3. **A3 — Internal reviewers are the scarce resource.** The 130-question WFPL questionnaire
   is representative, so reviewer minutes-per-assessment is the primary product metric.
4. **A4 — No PII/PHI** flows through evidence today (`FUTURE-IDEAS.md` §7).
5. **A5 — Advisory posture.** This is an internal system of record, not a system that blocks
   procurement automatically.

## 3. What the codebase actually looks like today

Verified by reading the code on 2026-08-20, not from memory:

| Area             | Observation                                                                                                                                                               | Consequence                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer service | `lib/services/assessment-review.ts` — 1232 lines, ~8 exported operations                                                                                                  | Largest single risk surface; further growth should split by concern, not add methods                                                     |
| Analytics        | `lib/services/analytics.ts` — 957 lines, 13 `Risk`/`Response`/`Vendor`/`Assessment` aggregations across 3 exported functions                                              | Aggregation-based already; the dashboard fires `getDashboardSummary` + `getWorkspaceAnalytics` in parallel per page load with no caching |
| List pages       | `app/(internal)/vendors/page.tsx` loads **all** vendors and **all** engagements and joins them in memory; `sharing/page.tsx` and `assessments/page.tsx` do the same shape | Fine at A1 volumes, and the file says so honestly. Becomes the first thing to break if A1 breaks                                         |
| Streaming        | Only route-level `loading.tsx`; no per-section `<Suspense>` anywhere in `(internal)`                                                                                      | Dashboard is a single blocking render — slowest aggregation gates the whole page                                                         |
| `next.config.ts` | Completely empty                                                                                                                                                          | No caching, no image config, no build-level tuning enabled                                                                               |
| Client surface   | 81 files carry `"use client"`                                                                                                                                             | Worth an audit; several are likely server-renderable                                                                                     |
| Mail             | `lib/mail/console.ts` is the only transport                                                                                                                               | No real notification exists in production terms                                                                                          |
| Scheduling       | CAP overdue escalation is **request-driven** (`detectAndEscalateOverdueCaps`)                                                                                             | Nothing happens unless a reviewer opens a page. Reassessment cadence (`next_review_due`) is computed but never _acts_                    |
| Audit            | `lib/audit/record-event.ts` writes events; no viewer UI exists                                                                                                            | Data is being collected that nobody can read                                                                                             |
| Evidence         | Storage-abstracted, MIME+extension checked, 10 MB cap, ZIP rejected, no payload inspection                                                                                | Safe-by-refusal, not safe-by-inspection                                                                                                  |

---

## 4. Ranked shortlist — the eight I would fund first

Ranking blends **reviewer minutes saved**, **risk of the thing going wrong**, and **cost**.
Effort: **S** ≈ one focused session, **M** ≈ a staged change across service + UI, **L** ≈
multi-stage with schema or infrastructure implications.

### #1 — Reviewer Stage 6: completion workflow + exports — M, already designed

The loop currently ends at `completeReview()` with nothing to hand anybody. An assessment
that is reviewed but not _reportable_ has not delivered its value: the audience for vendor
risk work is a committee, a regulator, or a business owner, none of whom log into the tool.
`lib/services/assessment-report.ts` and the `@react-pdf/renderer` dependency already exist,
so the gap is workflow and export surface, not rendering capability.
**Why first:** designed, unblocked, and it is the only item that converts finished review
work into something that leaves the system. See `REVIEWER-EXPERIENCE-PLAN.md` Stage 6.

### #2 — Reassessment cadence that actually fires — M

`next_review_due` is derived on completion and read by analytics, but nothing acts on it.
For a risk function, "annual reassessment of Tier 1 vendors" is the core recurring
obligation, and today it is a number in a dashboard that a human must notice. Options in
increasing cost: (a) a manual "start reassessment" action pre-filled from the last
assessment, (b) a due-soon queue with explicit owner assignment, (c) real scheduled
generation once a job runner exists.
**Recommendation:** (a) then (b). Both stay request-driven, so A2 holds and no scheduler is
needed. Reuses the frozen `template_snapshot` as the starting point — respecting #11 by
copying, never mutating.

### #3 — Real notification transport + a notification model — M, part [PARKED-adjacent]

Every workflow that depends on someone outside the tab is currently mute: OTP, questionnaire
send, correction rounds, CAP escalation. `FUTURE-IDEAS.md` §1 lists the provider selection;
the part _not_ listed is that there is no notion of a **notification record** — no delivery
state, no retry, no "was this actually seen". That matters for audit defensibility more than
for convenience: "we notified the vendor" is a claim the system currently cannot evidence.
**Caution:** touching OTP delivery is auth-adjacent (#2). Split it: notification
infrastructure first, OTP migrated as its own request.

### #4 — Audit-log viewer — S

Events are being written and are unreadable. This is the cheapest credibility win in the
codebase: one tenant-scoped read surface with filters by actor, entity, and date, over data
that already exists. It also directly supports the append-only guarantee in #12 by making
violations visible.
**Why it ranks above bigger features:** near-zero design risk, no schema change, and it
turns an existing invisible investment into a visible one.

### #5 — Dashboard performance: Suspense boundaries + short-TTL analytics cache — S/M

The dashboard awaits two service calls in `Promise.all` before rendering anything, and the
heavier one runs 8+ aggregations. Two independent fixes:

- **Streaming:** wrap each KRI card / chart in `<Suspense>` so headline counters paint
  immediately and slow aggregations arrive late. Pure UI-layer change, no service edits.
- **Caching:** analytics are workspace-scoped and tolerate staleness measured in minutes.
  A short TTL cache keyed by `workspace_id` is safe _for analytics only_ — `FUTURE-IDEAS.md`
  §5 and §7 are explicit that authorization must never be cached.
  **Sequence note:** profile before caching (§7 of `FUTURE-IDEAS.md`). Streaming is worth doing
  regardless because it improves perceived latency even when queries are fast.

### #6 — Evidence quality: payload inspection, then formats — M

Today the system is safe because it _refuses_ — ZIP is rejected, 10 MB cap, MIME must agree
with extension. That is the right call while nothing inspects payloads, but it pushes work
onto vendors, who then send evidence out-of-band. Antivirus/content scanning is the unlock
that makes archive support, larger artifacts, and eventually any AI extraction defensible.
**Ranking rationale:** it is a prerequisite for several higher-ceiling items (#9, [PARKED]
AI evidence analysis), so its value is partly optionality.

### #7 — Reviewer Stage 7: reporting & dashboards — M, already designed

Vendor scorecards and KRI trends already have service-level interfaces
(`getVendorScorecard`, `getRollupAnalyticsSummary`). Ranks below #1 because reporting on a
loop that does not yet close (#2) reports on a partial picture.

### #8 — Accessibility pass + automated a11y gate — S

`FUTURE-IDEAS.md` §6 already records a **known contrast defect** in the light-mode
critical/high risk pair. A risk product that renders severity in a colour a reviewer cannot
distinguish is failing at its one job. Add axe to the existing Playwright run so it cannot
regress silently. Cheap, and the defect is already documented rather than hypothetical.

---

## 5. UI and interaction ideas

Beyond the accessibility item above.

- **U1 — Saved views / filter presets on list surfaces (S/M).** Reviewers repeat the same
  queries ("Tier 1 with open critical risks", "assessments overdue > 30 days"). The URL-state
  hook pattern from reviewer Stage 3 (`hooks/use-review-url-state.ts`) generalizes cleanly —
  shareable URLs first, persisted named views only if asked for.
- **U2 — Global command palette (S).** `cmdk` is **already a dependency** and appears
  unused for navigation. Jump-to-vendor / jump-to-assessment across a growing dataset.
- **U3 — Vendor detail as the real hub (M).** The page already loads engagements,
  assessments, and risks; it could carry a single timeline (intake → tiering → assessment →
  review → risks → CAPs → offboarding) rather than parallel sections. This is the screen a
  business owner would actually be shown.
- **U4 — Density modes (S).** `DESIGN-SYSTEM.md` proposed compact/comfortable and neither
  was built. Meaningful specifically on 130-row review and register tables.
- **U5 — Bulk actions on the register (M).** Reviewer Stage 3 brought bulk thinking to the
  review page; the risk register at `components/risks/risk-register-client.tsx` (496 lines)
  still works one row at a time for owner assignment and due dates.
- **U6 — Empty and first-run states (S).** New workspaces start with no template library
  (`FUTURE-IDEAS.md` §3). The first-run experience is currently a set of empty tables.
- **U7 — Vendor portal progress and expectations (S).** The portal is the only surface an
  external user sees; a visible completion meter, an explicit "what happens next", and a
  clear correction-round explanation reduce inbound support and correction cycles.

## 6. Performance and scale ideas

Ranked against **A1**. Nothing here is urgent at current volumes — the point is to know the
trigger for each.

- **P1 — Streaming + analytics TTL cache.** See #5. The only perf item worth doing now.
- **P2 — Pagination and server-side filtering on list pages.** Trigger: any workspace past
  ~500 vendors, or a list page over ~1s server render. Today's in-memory join in
  `vendors/page.tsx` is a documented, deliberate choice — keep it until the trigger fires.
- **P3 — Client bundle audit.** 81 `"use client"` files. Some are certainly necessary
  (forms, tables, charts); a sweep for components that only need server rendering is a
  low-risk win, and `recharts` is heavy enough to be worth loading lazily below the fold.
- **P4 — Index coverage review against real query shapes.** `npm run db:indexes` syncs
  declared indexes, but the analytics aggregations added since (`Response` grouping,
  `next_review_due` range scans) deserve an `explain()` pass. Cheap, and mis-indexed
  aggregations are the most likely first real slowdown.
- **P5 — Shared session/rate-limit state.** Strictly conditional on A2 breaking. Deploying a
  second instance today silently weakens the OTP limiter — that is a **security**
  consequence, not a perf one, and belongs on the deployment checklist.
- **P6 — Evidence ZIP streaming ceiling.** Stage 4 introduced `EVIDENCE_ZIP_MAX_BYTES`
  preflight. Worth revisiting alongside multipart upload if artifact sizes grow.

## 7. Vendor-risk domain features

The product-shaped ideas. External research below informed the framing; the tagging against
this codebase is mine.

### In-scope under current constraints

- **V1 — Concentration risk view (M).** "How much of our critical operations sit with one
  vendor, one business unit, or one category?" The data exists — `tier1_concentration` is
  already a KRI. What is missing is the _view_ that turns it into a decision. This is a
  first-class regulatory expectation under DORA-style regimes and is buildable from data
  already in the register.
- **V2 — Exit / exception register (M).** Offboarding exists as an end-state. What does not
  exist is the middle: an accepted-risk exception with an owner, an expiry, and a review
  date. Real programs run on exceptions, and undocumented ones are how risk actually
  materializes. Complements #12's immutability rather than fighting it — exceptions are
  append-only records.
- **V3 — Questionnaire tiering by risk tier (M).** One 130-question template is applied
  broadly. Short-form paths for Tier 3 vendors cut both reviewer and vendor effort. The
  versioned template model and per-vendor tailoring from Stage 3 already support this; it is
  a content and routing decision more than an engineering one.
- **V4 — Risk acceptance workflow with approval (M).** Today a risk is raised and remediated.
  A formal accept path with an approver and an expiry closes the third branch, and pairs
  directly with V2.
- **V5 — Vendor self-service evidence library (M).** Vendors re-upload the same SOC 2 report
  per assessment. A vendor-scoped document library with expiry dates would cut vendor effort
  materially. Note: `lib/services/vendor-documents.ts` and cross-workspace sharing already
  exist — this may be closer than it looks.
- **V6 — Reassessment triggers beyond time (S/M).** Cadence is date-based. Scope changes
  (new data class, new integration, tier upgrade) should also trigger review. Cheap version:
  a manual "material change" flag that moves `next_review_due` forward and records why.

### [PARKED] — owner approval required (CONSTRAINTS #6)

Listed for landscape completeness, in the order I would unpark them:

1. **[PARKED] AI-assisted evidence analysis.** External research puts this as _the_ 2026
   differentiator — platforms that analyze vendor documents rather than merely collecting
   them. Highest reviewer-time ceiling of anything in this document. Prerequisites in this
   codebase: payload inspection (#6), and a citation model so every extracted claim points
   back at a page in a stored artifact. Do not build it without the citation requirement —
   an unciteable AI verdict is worse than no verdict in an audit.
2. **[PARKED] Continuous monitoring feeds.** Security ratings, breach signals, sanctions
   screening. Turns point-in-time assessment into ongoing posture and is explicitly what
   DORA/NIS2-style continuous-visibility expectations ask for. Cost is ongoing vendor data
   spend, not just build.
3. **[PARKED] Control-framework library and crosswalks.** SOC 2 / ISO 27001 / NIST CSF
   mappings. Would let one piece of evidence satisfy many controls, and unblocks the
   control-domain coverage analytics already noted in `FUTURE-IDEAS.md` §4.
4. **[PARKED] Fourth-party / nth-party visibility.** Asking vendors to declare their own
   critical subprocessors. Low engineering cost (a questionnaire section plus a graph view),
   disproportionate risk insight, and increasingly a regulatory expectation. **This is the
   cheapest parked item and I would unpark it first if forced to pick one.**
5. **[PARKED] Contract and SLA tracking.** Renewal dates, cure periods, exit clauses.
   Pairs with V2 — an exit strategy is only real if the contract permits it.
6. **[PARKED] Ticketing integration (Jira/ADO).** CAP tasks currently live only here, so
   remediation owners must visit a tool they do not otherwise use. This is the single
   biggest reason CAPs go stale in practice.
7. **[PARKED] SSO, automated inventory discovery, GRC copilot.** Genuine value, but each is
   a platform-scale commitment rather than a feature.

## 8. Operational readiness

Not features, but the difference between "works" and "can be run". All are already in
`FUTURE-IDEAS.md` §1; ranked here by what would hurt most on day one of production:

1. Real email transport (blocks every external workflow).
2. Backup and **tested** restore (untested backups are not backups).
3. Production S3 with object versioning before the first write (evidence is the one class of
   data that cannot be regenerated).
4. Secrets management, HTTPS, security headers, explicit CORS.
5. Evidence retention and deletion policy — currently indefinite retention by default, which
   is a decision nobody has actually made.
6. Audit-event completeness sweep over every mutating service.

## 9. What I would explicitly _not_ do next

Stated so a future session does not relitigate:

- **Do not add pagination yet.** The in-memory joins are deliberate and documented, and A1
  has not broken. Adding it now spends a session on a problem that does not exist.
- **Do not cache authorization.** Called out repeatedly across the docs; the DB read per
  request is the security authority.
- **Do not add a background job runner just for CAP escalation.** Request-driven detection
  works at A1. The runner becomes justified when notifications + reassessment + escalation
  all need it — three reasons, one decision.
- **Do not widen evidence formats before payload inspection.** The current refusal posture is
  correct while nothing looks inside files.
- **Do not split `assessment-review.ts` as its own project.** It is large, but it is tested
  (1004-line test file) and stable. Split it when the next feature makes it necessary, along
  the seam that feature reveals.

## 10. Decision log

| #   | Decision                                                              | Alternatives considered                                     | Why                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O1  | New file `OPPORTUNITY-MAP.md` rather than expanding `FUTURE-IDEAS.md` | Append everything to `FUTURE-IDEAS.md`; put it in `PLAN.md` | `FUTURE-IDEAS.md` is deliberately an _unranked, unapproved_ inventory. Mixing ranked opinion into it would blur the "listed ≠ approved" rule it states in its own header |
| O2  | Include parked §4 items, clearly tagged                               | Omit them entirely to respect #6                            | Owner explicitly asked for the full landscape. #6 bans _building_, not _describing_. Tagging preserves the constraint                                                    |
| O3  | Rank by reviewer-minutes-saved and risk, not by novelty               | Rank by technical interest; rank by external market trends  | A3 — reviewer capacity is the binding constraint. Market trends inform the parked section only                                                                           |
| O4  | Reviewer Stage 6 ranked #1                                            | Start something new; do Stage 7 first                       | It is designed, unblocked, and it is the only item that gets finished work out of the system to its actual audience                                                      |
| O5  | Fourth-party visibility named as the first item to unpark             | AI evidence analysis first (higher ceiling)                 | Lowest cost-to-value of the parked set and no infrastructure prerequisites; AI analysis needs payload inspection and a citation model first                              |
| O6  | Perf items given explicit _triggers_ rather than priorities           | List them as backlog                                        | A1 says they are not problems yet. A trigger tells a future session when to act without re-deriving the volume argument                                                  |
| O7  | Streaming (`<Suspense>`) recommended before caching                   | Cache first                                                 | Streaming has no correctness risk and helps regardless of query speed; caching should follow profiling per `FUTURE-IDEAS.md` §7                                          |
| O8  | Notification _records_ called out separately from email transport     | Treat as one item                                           | Delivery state is an audit-defensibility requirement, not a delivery detail, and `FUTURE-IDEAS.md` §1 covers only the transport half                                     |

## 11. Open questions for the owner

1. **Does A1 still hold?** Every perf ranking depends on it. If real deployment targets are
   materially larger, P2 and P4 move up sharply.
2. **Is there a compliance regime this must satisfy by name** (RBI/DPDP, SOC 2, ISO 27001,
   DORA-style)? A named regime would reorder §7 substantially — concentration risk and exit
   registers become obligations rather than good ideas.
3. **Is any parked item actually funded?** If AI evidence analysis is coming, payload
   inspection (#6) should be sequenced now rather than later.
4. **Who is the report audience?** Stage 6's export format depends on whether it is read by a
   risk committee, an external auditor, or the business owner who requested the vendor.

## 12. External research consulted

Market framing for §7's parked items only; none of it was used to assess this codebase.

- [2026 Guide to Third Party Risk Management — Safe Security](https://safe.security/resources/blog/2026-guide-to-third-party-risk-management-tprm/)
- [NIS2 and DORA Compliance: Requirements for Third-Party Risk Management — Brandefense](https://brandefense.io/blog/nis2-dora-third-party-risk-management/)
- [Continuous Compliance Monitoring for NIS2 and DORA — Clarysec](https://blog.clarysec.com/posts/continuous-compliance-monitoring-nis2-dora/)
- [Third-Party Risk Management: Top 10 Trends — Mitratech](https://mitratech.com/resource-hub/blog/third-party-risk-management-the-top-10-predictions-for-2024/)
- [What Is AI-Driven TPRM? A Complete Guide for 2026 — Atlas Systems](https://www.atlassystems.com/complyscore/ai-tprm/introduction)

Key external themes: continuous monitoring with live KRI dashboards is replacing
point-in-time assessment; AI-assisted **evidence analysis** (not just collection) is named as
the 2026 differentiator; AI vendors themselves have become a top-ranked risk category; and
DORA/NIS2 push concentration risk, exit strategy, and supply-chain visibility from optional
to expected.

---

**Model:** Claude Opus 5 (`claude-opus-5`), 2026-08-20.
