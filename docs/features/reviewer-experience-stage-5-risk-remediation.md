# Feature: Reviewer experience Stage 5 — risk and remediation integration

|                    |                                            |
| ------------------ | ------------------------------------------ |
| **Status**         | complete and verified                      |
| **Owner**          | Project owner                              |
| **Started**        | 2026-08-20                                 |
| **Spec reference** | `docs/REVIEWER-EXPERIENCE-PLAN.md` Stage 5 |
| **Models used**    | Codex (GPT-5)                              |

## 1. Scope

Make the non-compliant-to-risk path explicit at the control row, distinguish controls with
and without risks, warn when an assessment's CAP tasks lack owner or due-date data while
allowing an audited override, and surface overdue remediation on the owning vendor page.

## 2. Why

The service already hard-blocks completion when a non-compliant control has no risk, but the
review row does not clearly expose that state or provide the risk action at the point of
decision. Existing CAP escalation is visible only in the global risk register, and legacy
or externally written incomplete CAP tasks need an advisory completion path rather than a
new hard gate.

## 3. Plan

Reuse `RaiseRiskDialog`, the current assessment risk endpoint, `associated_risks[]`, and the
request-driven overdue detector. Add a pure CAP-completeness calculation to the review
service, include its result in reviewer data, accept an explicit override at completion,
and audit only when incomplete tasks are overridden. Filter the overdue queue to the
workspace-scoped vendor and render a compact age-bucket surface linking to the risk register.

## 4. Flow impact

Extends F4 and F7. Existing unmarked-control and non-compliant-without-risk completion gates
remain hard failures. CAP completeness is advisory exactly as specified by plan decision R4.

## 5. Data model impact

No schema or migration. Existing risk, embedded CAP task, reviewer item, and audit models are
used unchanged.

## 6. Work log

| Date       | What was done                                                                  | Files          | Model         |
| ---------- | ------------------------------------------------------------------------------ | -------------- | ------------- |
| 2026-08-20 | Mapped risk creation, completion, CAP escalation, reviewer, and vendor paths.  | CodeGraph/plan | Codex (GPT-5) |
| 2026-08-20 | Added risk-required/linked row states and prefilled creation at the control.   | Reviewer UI    | Codex (GPT-5) |
| 2026-08-20 | Added advisory CAP completeness, explicit override, and append-only audit.     | Service/API/UI | Codex (GPT-5) |
| 2026-08-20 | Added vendor-filtered overdue detection, age buckets, and register deep links. | Vendor/risk UI | Codex (GPT-5) |
| 2026-08-20 | Added service/browser gates, fixed legacy-date rendering, and ran full verify. | Tests/docs     | Codex (GPT-5) |

## 7. What didn't work

The first age-bucket fixture treated May 21 to August 20 as 90 days, but it is 91; moving
the boundary fixture to May 22 corrected the test, while the production classifier was
already right. The first stronger deep-link assertion used CSS `:target`, which Playwright
did not match after the client navigation even though the row was rendered; resolving the
URL hash and locating the exact id verifies the destination directly.

The first browser run also exposed that `listWorkspaceRisks()` unconditionally serialized
every CAP `due_date`. A deliberately incomplete legacy task therefore crashed the risk
register with `RangeError: Invalid time value`. The register serializer now returns null and
the UI renders “Not set,” allowing the advisory record to be repaired. See the linked bug
trace.

## 8. Decisions logged

`DECISIONS.md` 051 records the retained hard gates, explicit advisory override, vendor-
filtered request-driven detector, and in-context risk interaction.

## 9. Verification

- Focused Vitest: 2 files, 28 tests passed.
- Playwright: desktop and mobile remediation journey passed 2/2.
- `21st review`: 5 files reviewed, 0 findings.
- `npm run verify`: format, lint, typecheck, 36 files/261 tests, and 35-page production build
  passed. Lint retains only the known TanStack Table compiler advisory.

## 10. Rollback

Safe baseline: `1c76c4413716dc39449cc2d2d18f8c72ce161916`. See `docs/ROLLBACK.md`.

## 11. Follow-ups

Stage 6 adds the full server-computed completion summary and exports.
