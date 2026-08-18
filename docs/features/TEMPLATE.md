# Feature: <name>

> Guide habit 5. Copy to `docs/features/<short-slug>.md` when work starts.
> Anyone — human or AI — should be able to read this cold and know exactly how to pick up
> where it left off. Update it **as you go**, not at the end.

|                    |                                          |
| ------------------ | ---------------------------------------- |
| **Status**         | scoping / in progress / blocked / done   |
| **Owner**          |                                          |
| **Started**        | YYYY-MM-DD                               |
| **Spec reference** | `VRA MVP Feature Specification.md` §     |
| **Models used**    | e.g. Claude Opus 5 (`claude-opus-5[1m]`) |

## 1. Scope

What this feature does, in plain words. What it explicitly does **not** do.

## 2. Why

The problem it solves and who for (internal risk team / business owner / Vendor SPOC).

## 3. Plan (written before implementing — habit 11)

The approach, agreed before code. If the plan changed mid-flight, note what changed and why.

## 4. Flow impact

Which `FLOW.md` paths this creates or touches. Add the flow there too; don't leave it only
here.

## 5. Data model impact

New collections/fields, migrations, backfills. `none` is a valid answer.

## 6. Work log

| Date | What was done | Files | Model |
| ---- | ------------- | ----- | ----- |
|      |               |       |       |

## 7. What didn't work

Approaches tried and abandoned, with the reason. This is the most valuable section in the
file — it's what stops the next session from repeating the dead end.

## 8. Decisions logged

Links to `DECISIONS.md` entry numbers raised by this work.

## 9. Verification

Which `TEST-CHECKLIST.md` gates were run, with **actual pasted output**. Note anything
skipped and why. Untested paths named explicitly.

## 10. Rollback

Safe commit SHA and revert steps while this is in flight (see `ROLLBACK.md`).

## 11. Follow-ups

Known gaps, deferred work, tech debt accepted.
