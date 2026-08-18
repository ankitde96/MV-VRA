# Bug: <one-line symptom>

> Guide habit 5. Copy to `docs/bugs/<short-slug>.md` when investigation starts.
> Traces the bug start to finish: how it was found, what was tried, what worked, what
> didn't, and how the fix was verified. Fill it in **while** debugging — a trace written
> from memory afterwards loses the dead ends, which are the useful part.

|                 |                                                 |
| --------------- | ----------------------------------------------- |
| **Status**      | investigating / root-caused / fixed / won't fix |
| **Severity**    | critical / high / medium / low                  |
| **Found**       | YYYY-MM-DD                                      |
| **Found by**    | user report / test failure / review / observed  |
| **Models used** | e.g. Claude Opus 5 (`claude-opus-5[1m]`)        |

## 1. Symptom

What actually happens, observed — not inferred. Exact error text, status codes, screenshots.

## 2. Expected behaviour

What should happen, and what says so (spec section, test, `FLOW.md` path).

## 3. Reproduction

Deterministic steps. If it's intermittent, say so and record the hit rate.

```
1.
2.
3.
```

## 4. Blast radius

Who is affected. **Is tenant isolation or vendor scoping involved?** If yes, this is a
security incident path, not an ordinary bug — escalate before continuing, and check
`TEST-CHECKLIST.md` Gate 4.

## 5. Flow trace

The `FLOW.md` path being followed, and where in it the behaviour diverges. Bugs live in the
gaps between files — name the gap.

## 6. Hypotheses

| #   | Hypothesis | How tested | Result                |
| --- | ---------- | ---------- | --------------------- |
| 1   |            |            | ruled out / confirmed |

## 7. Root cause

The actual mechanism, not the symptom. If it's still unknown, say unknown — do not
substitute a plausible guess.

## 8. What didn't work

Fixes attempted and reverted, with why they failed. Keep this even after the real fix
lands.

## 9. Fix

What changed and why this is the right layer to fix it in. Files touched.

## 10. Verification

`TEST-CHECKLIST.md` gates run, with **actual pasted output**. Confirm the original repro no
longer reproduces. State plainly if the fix is unverified.

## 11. Regression guard

The test added so this cannot come back. If none was added, say so and explain why.

## 12. Related

Links to `DECISIONS.md` entries, other bug/feature traces, `HANDOVER.md` notes.
