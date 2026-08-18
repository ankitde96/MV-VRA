# CONSTRAINTS.md — What the AI Must Never Do

> Guide habit 7. "Allow" should never mean "allow anything." This file turns permission
> into **scoped** permission. Read it at the start of every session.
>
> **Claude may not edit this file to widen its own permissions.** Proposing a change is
> fine; making one is not. Only the project owner relaxes a constraint.

---

## Hard stops — never without explicit approval in the current session

1. **Libraries are pre-approved project-wide.** New libraries and package upgrades may be
   added whenever they materially improve the implementation; no per-package or per-session
   approval is required. Keep versions pinned through the lockfile, prefer maintained and
   narrowly-scoped packages, document consequential additions in `DECISIONS.md`, and verify
   the resulting build/tests. This standing authorization remains in force for the entire
   project unless the project owner explicitly revokes it (`DECISIONS.md` 038).
2. **Do not touch authentication logic** — internal admin login or Vendor SPOC Email OTP —
   as a side effect of another task. Auth changes are their own request, with their own
   rollback plan.
3. **No destructive database operations.** No `dropDatabase`, `dropCollection`,
   `deleteMany`, or unguarded `updateMany`. Migrations must be reversible and reviewed.
4. **Never commit secrets.** No credentials, AWS keys, connection strings, or OTP secrets
   in code, docs, or commit messages. Environment variables only, `.env` git-ignored.
5. **Work directly on `main`.** Do not create feature branches or pull requests unless the
   project owner explicitly asks for one. Direct editing on `main` is the standing project
   workflow (`DECISIONS.md` 039). This does not independently authorize committing,
   pushing, force-pushing, or merging; those actions still require an explicit request.
6. **Do not scope-creep the MVP.** The eight parked features in
   `VRA MVP Feature Specification.md` §4 are out of scope. Do not start building an AI
   layer, SSO, discovery workers, or external integrations because they seem useful.
7. **Do not delete or rewrite the source specs.** `VRA MVP Feature Specification.md` and
   `VRA Platform Feature Research.md` are inputs, not working files.

---

## Architectural boundaries

8. **Multi-tenant isolation is non-negotiable.** Every query touching tenant data must be
   scoped by `workspace_id`. No cross-workspace read path may exist except the explicit
   Cross-Workspace Document Sharing feature. A missing tenant filter is a security bug,
   not a style issue.
9. **No direct database access from UI components.** Data access goes through the API
   route → service → repository layers. Do not import a Mongo client into a React
   component.
10. **Storage is abstracted.** Evidence file reads/writes go through one storage module
    that resolves to local filesystem in development and S3 in production. Do not call
    the S3 SDK directly from feature code.
11. **Assessment templates are versioned and immutable once in use.** Never mutate a
    template version that an active or historical assessment references — create a new
    version. Historical assessments must keep rendering exactly as they were answered.
12. **Archived records are immutable.** Offboarding archives, audit trails, and
    remediation logs are append-only. No edits, no deletes.

---

## Process boundaries

13. **One logical change per request.** If the ask fans out, stop and propose a sequence.
14. **Plan before implementing** anything non-trivial. Get agreement on the approach first.
15. **Never claim a change works without running it.** See `TEST-CHECKLIST.md`. Report
    failures and skipped steps explicitly.
16. **Don't silently reinterpret the request.** If the spec is ambiguous, state the
    assumption you're proceeding under, or ask if getting it wrong would waste the work.
17. **Don't fabricate.** No invented file paths, config keys, API responses, or test
    results. "I don't know" and "not built yet" are valid answers.

---
