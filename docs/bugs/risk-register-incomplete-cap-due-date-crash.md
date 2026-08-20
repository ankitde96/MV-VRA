# Bug: Risk register crashes on incomplete legacy CAP due dates

|                 |                     |
| --------------- | ------------------- |
| **Status**      | fixed and verified  |
| **Severity**    | medium              |
| **Found**       | 2026-08-20          |
| **Found by**    | Stage 5 browser E2E |
| **Models used** | Codex (GPT-5)       |

## 1. Symptom

Navigating from a vendor overdue-remediation item into `/risks` rendered the row but logged
`RangeError: Invalid time value` from `listWorkspaceRisks()` when another legacy CAP task on
the same risk had no `due_date`.

## 2. Expected behaviour

The risk register must render incomplete CAP records so a reviewer can identify and repair
the missing owner or due date. Stage 5 intentionally treats this as an advisory warning.

## 3. Root cause

The risk-register serializer called `new Date(t.due_date).toISOString()` unconditionally.
Current schema-backed writes require a date, but legacy or external records can lack it—the
exact compatibility case introduced into the Stage 5 regression fixture.

## 4. Fix

Validate the date before serialization, return `null` for absent/invalid dates, widen the
client item type, and render `Not set`. The completion-readiness warning and risk register
now agree on how incomplete records are represented.

## 5. Verification

The service regression asserts a malformed task serializes with `due_date: null`. The
desktop/mobile remediation journey now follows the vendor deep link and finds the exact
anchored risk row. Focused tests passed 28/28 and full verification passed 261/261.

## 6. Related

`docs/features/reviewer-experience-stage-5-risk-remediation.md`; `DECISIONS.md` 051.
