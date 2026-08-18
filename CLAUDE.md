# CLAUDE.md — Operating Instructions for AI Sessions on VRA

This project runs on the **AI Collaboration Field Guide** discipline. The rule is simple:
**no blind "Allow."** Every change is traceable before, during, and after it happens.

Habits 1–9 of the guide (Core Documentation + Guardrails) are implemented as the files
below. Maintaining them is not optional housekeeping — it is part of the definition of
"done" for every task.

---

## Session start — read before touching anything

In this order, every session:

1. `docs/HANDOVER.md` — where things stand right now
2. `docs/CONSTRAINTS.md` — what you are not allowed to do
3. `docs/ARCHITECTURE.md` — the system map
4. `docs/FLOW.md` — execution paths, and which ones are in flight
5. The relevant `docs/features/*.md` or `docs/bugs/*.md` trace, if the task has one

Do not ask the user to re-explain the project before reading these. If they contradict
the code, the code wins — then fix the doc and note it in `docs/DECISIONS.md`.

---

## The nine artifacts

| #   | Habit             | File                           | Rule                                                           |
| --- | ----------------- | ------------------------------ | -------------------------------------------------------------- |
| 1   | Handover          | `docs/HANDOVER.md`             | Update at the end of every session. Living state, not a dump.  |
| 2   | Rationale         | `docs/DECISIONS.md`            | Append an entry for every meaningful decision, with the _why_. |
| 3   | Explicit comments | _(in code)_                    | Comment non-obvious logic as you write it. See rules below.    |
| 4   | Traceability      | `docs/FLOW.md`                 | Update when you add or change an execution path.               |
| 5   | Full trace        | `docs/features/`, `docs/bugs/` | One file per feature/bug, start to finish.                     |
| 6   | Big picture       | `docs/ARCHITECTURE.md`         | Update when modules, services, or data movement change.        |
| 7   | Boundaries        | `docs/CONSTRAINTS.md`          | Read every session. Never edit to widen your own permissions.  |
| 8   | Verification      | `docs/TEST-CHECKLIST.md`       | Run it before claiming done. Paste real output.                |
| 9   | Safety net        | `docs/ROLLBACK.md`             | Fill in _before_ starting any large or risky edit.             |

---

## Habit 3 — explicit comments (code-level rule)

Comment the **flow and intent**, never restate the syntax.

```js
// ✗ Bad — restates the code
// loop over vendors and push to array

// ✓ Good — explains flow, callers, and assumptions
// Called by the tiering worker after intake submit. Assumes inherent_risk_tier is
// already set — engagements with a null tier are skipped here, not defaulted, so a
// scoring bug surfaces as a missing record instead of a silent Tier 3.
```

Required wherever:

- a block's purpose is not obvious from its name,
- something **calls into** this code that isn't visible locally,
- the code **assumes** something exists (a field, a prior migration, an env var),
- a non-obvious tradeoff was made (then also log it in `DECISIONS.md`).

---

## Habit 2 — what counts as a "meaningful decision"

Append to `docs/DECISIONS.md` when you: pick a library or pattern, change a schema,
accept a tradeoff, reject an approach the user suggested, or work around something.
Routine mechanical edits don't need an entry.

Every entry is **version-pinned** (guide habit 14): record the model that reasoned
through it, because behaviour shifts between versions and that matters when debugging
the decision later.

---

## Habit 8 — "done" means verified

Never report success on the strength of your own summary. Before saying a task is done:

1. Run the applicable commands in `docs/TEST-CHECKLIST.md`.
2. Paste the **actual** output, not a paraphrase.
3. If something fails or you skipped a step, say so explicitly.

"The code should work" is not a result. If no test exists for the path you changed,
say that plainly rather than implying coverage.

---

## Habit 9 — before risky edits

Fill in the "Active plan" section of `docs/ROLLBACK.md` _before_ starting anything that
touches multiple modules, changes a schema, or alters auth. Record the safe commit SHA,
the files being touched, and what to re-check after reverting.

---

## Session end — the handoff ritual

Before the session closes, update `docs/HANDOVER.md` with five lines:

1. **What we did** — the change, not the conversation
2. **What's left** — next concrete step
3. **What to watch out for** — traps, half-states, known breakage
4. **Files touched**
5. **Model** — which AI version did this work

Then append any new `DECISIONS.md` entries and update `FLOW.md` / `ARCHITECTURE.md` if
the shape of the system changed. Takes ~30 seconds; it's the highest-leverage habit here.

---

## Scope discipline

One logical change per request (guide habit 12). If the user asks for something that
fans out into several independent changes, say so and propose the sequence rather than
producing one large diff. Large vague diffs don't get reviewed properly — by anyone.

Explain the plan before implementing anything non-trivial (guide habit 11). It is
cheaper to correct a paragraph than to unwind 200 lines.

---

## Not implemented here

Guide habits 10 (read every diff), 11–12 (partially reflected above), and 15 (own the
mental model) are **human** habits. No file can enforce them. They stay with the
reviewer.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
