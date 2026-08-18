# Feature: Questionnaire template builder and versioning

|                    |                                         |
| ------------------ | --------------------------------------- |
| **Status**         | done                                    |
| **Owner**          | Project owner (solo)                    |
| **Started**        | 2026-08-14                              |
| **Spec reference** | `VRA MVP Feature Specification.md` §2.2 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)     |

## 1. Scope

PLAN.md Phase 5, FLOW.md F3 part 1:

1. **Template CRUD** with a `draft → published → archived` lifecycle.
2. **Publishing freezes the version** — a published (or archived) version is immutable;
   editing means creating a new draft version, not mutating in place.
3. **Conditional-logic expression format and evaluator** — `show_if`/`all`/`any`, the eight
   operators, forward-reference rejection, suppression cascading — as one shared, pure,
   unit-tested module (`lib/questionnaire/`).
4. **Builder preview renders through that same module** — a form-based visual builder
   (project owner's explicit choice over a JSON editor) with an interactive preview tab
   that recomputes visibility live as you answer questions.

Does **not** include: assigning a template to an engagement, the vendor portal rendering a
real assessment, response persistence, or evidence-upload wiring — all Phase 6/7. A global
seed-template library copied into new workspaces (part of `PLAN.md`'s default answer to
"workspace-scoped or global?") was **not** built — every workspace starts with zero
templates (`ARCHITECTURE.md` §7).

## 2. Why

Spec §2.2: "Dynamic Conditional Logic," "Response Validation & Pre-Screening," and
"Version-Controlled Templates supporting versioning, draft states, control lockouts, and
backward-compatible data schemas for active historical assessments." `PLAN.md` §4 calls the
`questions_schema` format "the highest-leverage artifact in the project" — every later
consumer (portal renderer, evaluator, validator, every historical snapshot) depends on it,
so it's specified and built once, correctly, ahead of anything that needs it.

## 3. Plan (written before implementing — habit 11)

Read `DATA-MODEL.md` §3 (the format is fully specified there) before proposing anything.
One decision was genuinely open and taken to the project owner via `AskUserQuestion`:
whether the builder UI should be a JSON schema editor + live preview, or a form-based
visual builder. The project owner chose the form builder despite the larger UI surface.
Four smaller ambiguities in the spec's prose were resolved by implementation and recorded
in `DECISIONS.md` 018 rather than guessed silently: structural validation timing (every
save, not only publish), `show_if`'s `all`/`any` exclusivity, archived-immutability, and
multi_select condition semantics.

Once decided: build the shared evaluator/validator first (they're pure functions,
independently testable, and everything else depends on their contract) — then the
repository/service lifecycle — then the API routes — then the shared renderer components
— then the builder form and pages, in that order.

## 4. Flow impact

`FLOW.md` F3 — the template-lifecycle portion (steps 0a–0c, newly added) is now built and
has real file references. Steps 1–8 (assignment through submission) remain Phase 6/7,
explicitly marked not built in the same section rather than left ambiguous.

## 5. Data model impact

None — `questionnaire_templates` already existed from Phase 1 with the exact shape this
phase needed (`template_key`, `version`, `status`, `questions_schema`, etc.). No schema
change, no migration.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Files                                                                                             | Model                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Read `PLAN.md` Phase 5 and `DATA-MODEL.md` §3; surfaced the builder-UI decision via `AskUserQuestion`; filled `ROLLBACK.md`'s Active plan. Built `lib/questionnaire/{schema,evaluator,validate-schema}.ts` with unit tests first, then `TemplateRepository`/`lib/services/questionnaire-templates.ts` with the draft/publish/version/archive lifecycle, then five API routes, then the shared renderer (`components/questionnaire/`) and the form-based builder (`components/templates/`), then the three pages. Ran `npm run verify` clean. Verified the full lifecycle by real HTTP request against a running dev server: create → edit draft → publish → edit-attempt refused (403) → new version → second-new-version-while-a-draft-exists refused (422) → archive → archive-again refused (422), plus an invalid (forward-referencing) schema refused at creation. Cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH` afterward. | See `ROLLBACK.md`'s Active plan (filled before this phase, cleared after) for the full file list. | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

Nothing abandoned. No corrections mid-build this phase — the evaluator/validator were
written and unit-tested first, which caught the one subtlety (suppression cascading
independent of a child's own condition, not just "unanswered parent") before it reached the
repository/service layer.

## 8. Decisions logged

`DECISIONS.md` 018 — builder UI choice, validation timing, `show_if` exclusivity,
archived-immutability, multi_select condition semantics.

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
 Test Files  14 passed (14)
      Tests  85 passed (85)
...
✓ Compiled successfully in 1226ms
...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/templates
├ ƒ /api/templates/[id]
├ ƒ /api/templates/[id]/archive
├ ƒ /api/templates/[id]/new-version
├ ƒ /api/templates/[id]/publish
├ ƒ /api/vendors
├ ƒ /api/vendors/[id]/documents
├ ƒ /api/vendors/[id]/documents/[documentId]
├ ƒ /api/vendors/[id]/spoc
├ ƒ /dashboard
├ ○ /login
├ ƒ /templates
├ ƒ /templates/[id]
├ ○ /templates/new
├ ƒ /vendors
├ ƒ /vendors/[id]
└ ○ /vendors/new
```

**Gate 5 (template immutability) + Gate 6 (manual smoke), by real HTTP request against a
running dev server**, using the same temporary-password-then-restore pattern as prior
phases:

```
$ curl -X POST /api/auth/login ...                             → 200 {"ok":true}
$ curl -X POST /api/templates (HOST-01/HOST-02 schema) ...       → 201, draft v1
$ curl -X PATCH /api/templates/<id> ...                          → 200, draft edited in place
$ curl -X POST /api/templates/<id>/publish                       → 200, status: published
$ curl -X PATCH /api/templates/<id> ...   (against published)    → 403 forbidden, document unchanged
$ curl /templates/<id>                                           → 200, shows "can never be edited"
$ curl -X POST /api/templates/<id>/new-version                   → 201, v2 draft, schema copied
$ curl -X POST /api/templates/<id>/new-version  (again)          → 422 validation_error (draft already exists)
$ curl -X POST /api/templates/<v2id>/archive                     → 200, status: archived
$ curl -X POST /api/templates/<v2id>/archive     (again)         → 422 validation_error (already archived)
$ curl -X POST /api/templates  (no session)                      → 401
$ curl -X POST /api/templates  (forward-referencing schema)      → 422 validation_error, forward reference message
```

All ran clean; the smoke-test template and its audit events were deleted afterward
(`mongosh`), and `SUPER_ADMIN_PASSWORD_HASH` was restored to its real value and re-seeded.

**Not run:** Gate 4's vendor-portal items (not applicable — portal is Phase 6). No
component/UI test exists for the builder form itself (`components/templates/`) — consistent
with the rest of the codebase, which tests services/evaluators, not React components; the
form was verified by using it through the real HTTP API it calls, not by a rendered-DOM
test.

## 10. Rollback

Active plan filled in `ROLLBACK.md` before starting; every file this phase touched is new
(no existing files edited), so a revert is just deleting them — no git baseline exists in
this repo yet (`DECISIONS.md` 010, still deferred).

## 11. Follow-ups

- **The global seed-template library** (`PLAN.md`'s default answer to the
  workspace-scoped-vs-global question) was not built — flagged in `ARCHITECTURE.md` §7.
  Worth deciding whether new workspaces should start with any templates before Phase 6
  needs to assign one.
- Phase 6 will assign a template version to an engagement and must snapshot
  `questions_schema` verbatim into `template_snapshot` — since every structural rule is
  already enforced before a template can be published, that snapshot can be trusted
  without re-validating it.
- Phase 7's response validator needs to call `computeVisibility()` (built and tested this
  phase) to know which questions to skip — not wired to anything yet.
- No API-route-level (as opposed to service-level) cross-workspace test exists for the
  template routes, matching the same gap already noted for `/api/vendors` in
  `TEST-CHECKLIST.md` Gate 4.
