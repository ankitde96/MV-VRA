# ROLLBACK.md — The Way Back Out

> Guide habit 9. The confidence to let AI make bigger changes comes from knowing exactly
> how to reverse them. Fill in the **Active plan** section _before_ starting a large or
> risky edit — not after it breaks.

---

## ✅ Current status: rollback baseline exists (established 2026-08-18)

Baseline SHA: `0ea5688` (`origin/main`) — `DECISIONS.md` 027. Every prior "no revert path"
caveat in this file and in `DECISIONS.md` (010, 011, 014, 025) is resolved as of this commit.

---

## When a rollback plan is mandatory

Before any change that:

- touches more than one module,
- changes a MongoDB schema or runs a migration,
- modifies authentication (admin login or Vendor SPOC Email OTP),
- alters tenant isolation or `workspace_id` scoping,
- changes questionnaire template versioning or the archive path,
- adds or upgrades a dependency,
- rewrites more than ~100 lines.

For anything smaller, `git diff` and `git restore` are sufficient.

---

## Active plan

Overwrite this block at the start of each risky change. One at a time.

```
UI Revamp Round 2 — glassmorphism visual layer + KPI/KRI analytics (2026-08-18, in
progress). See docs/UI-REVAMP-2-PLAN.md and DECISIONS.md 028.

Safe baseline: commit 0ea5688 (origin/main) — first real rollback point this project has
ever had. `git diff 0ea5688` / `git restore --source=0ea5688 -- <file>` both work now.

Phase A (design tokens, in progress) — app/globals.css, app/layout.tsx (adds Lexend
--font-display). No schema, auth, or repository/service-layer changes. Low risk: additive
CSS custom properties + utility classes, nothing removed from the existing token set.

Phase B (next, SCHEMA-TOUCHING) will add six nullable Date fields to Assessment/Risk
models — its own Active-plan block goes here before that phase starts, per CONSTRAINTS.md
#2's spirit (not auth, but still "changes a MongoDB schema").

Dependencies: CONSTRAINTS.md #1's per-package ask is pre-approved for this round only
(DECISIONS.md 028) — each package actually added still gets its own DECISIONS.md entry.

Re-check after any revert attempt: npm run verify all green, 190 tests still pass, risk
badges/table cells render identically to pre-Round-2 (flat, no glass — the one thing that
must not visually change).
```

_UI Revamp Round 1 (full frontend redesign, Phases 0–8) was built and verified 2026-08-17 —
see `docs/features/ui-revamp.md`. Its Active plan is kept below for reference; closed out._

**Closed: UI Revamp Round 1 (2026-08-17).**

```
UI Revamp — full frontend redesign of internal console + vendor portal (2026-08-17).
Touches every module under app/ and components/ except app/api/**. No schema, auth, or
repository/service-layer changes — see docs/UI-REVAMP-PLAN.md's "Guardrails that survive
the revamp" section for the load-bearing data-fetching chain that must not move.

No git baseline existed at the time (project owner's choice that session). New
dependencies: recharts, @tanstack/react-table, motion — added that session (CONSTRAINTS.md
#1, approved per-package). A git baseline now exists (commit 0ea5688) as of 2026-08-18.
```

_Phase 11 (multi-workspace RBAC, sharing, executive roll-up) was built and verified
2026-08-17 — see
`docs/features/phase-11-multi-workspace-rbac-sharing-and-executive-rollup.md`. The plan
filled in before starting it is kept below for reference; it is closed out, nothing is
currently mid-change._

**Closed: Phase 11 — multi-workspace RBAC, sharing, executive roll-up (2026-08-17).**

```
Phase 11 — multi-workspace RBAC, sharing, executive roll-up (2026-08-17, in progress).
AUTH-TOUCHING (CONSTRAINTS.md #2) — this is its own request, with its own plan below.

- Safe baseline: no git commit exists anywhere in this repo (carried-forward gap,
  DECISIONS.md 010) — no SHA to record; only lever is git diff/manual revert per file.
- Files being touched (auth core): lib/auth/login.ts (removes the single-email gate —
  login() now authenticates any active User whose password matches, not just
  SUPER_ADMIN_EMAIL), lib/auth/rbac.ts (new — role capability matrix),
  lib/auth/current-membership.ts (new — resolves a session's role fresh from the DB per
  request, never cached in the signed cookie so a role change takes effect without
  re-login), new routes app/api/auth/switch-workspace/route.ts,
  app/api/auth/memberships/route.ts, app/api/admin/users/**, then capability checks added
  to every existing internal-facing route (vendor/template/assessment/risk/cap/offboarding).
  New: lib/services/sharing.ts + app/api/sharing/** (uses the pre-existing, previously
  unused SharedDocument model). New: lib/services/executive-rollup.ts +
  app/api/rollup/route.ts. UI: components/workspace-switcher.tsx,
  app/(internal)/admin/users/page.tsx, app/(internal)/sharing/page.tsx,
  app/(internal)/rollup/page.tsx. scripts/seed.ts extended with a second workspace and
  users of varied roles.
- What to re-check if reverting: SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD_HASH remain valid
  as a bootstrap admin account even after login.ts's gate is removed (they just stop being
  the *only* account that can authenticate) — reverting login.ts alone restores the
  single-email gate without affecting seeded data. The session cookie format
  (`SessionPayload: {userId, workspaceId}`) is unchanged — no signed-token migration
  needed either direction. No destructive writes anywhere in this phase; SharedDocument
  reads are additive audit-logged reads, not mutations of the underlying vendor data.
- Reversible? Yes for code, by git restore per file. Any new seeded workspace/users are
  disposable dev-only fixtures, not production data.
```

_Phase 10 (offboarding, destruction certificates, archiving) was built and verified
2026-08-17 — see
`docs/features/phase-10-offboarding-destruction-certificates-archiving.md`. The plan filled
in before starting it is kept below for reference; it is closed out, nothing is currently
mid-change._

**Closed: Phase 10 — offboarding, destruction certificates, archiving (2026-08-17).**

```
Phase 10 — offboarding, destruction certificates, archiving (2026-08-17, in progress).

- Safe baseline: no git commit exists anywhere in this repo (carried-forward gap,
  DECISIONS.md 010) — no SHA to record; only lever is git diff/manual revert per file.
- Files being touched: lib/repositories/offboarding-repository.ts (new),
  lib/repositories/assessment-repository.ts (adds archive()),
  lib/services/offboarding.ts (new), lib/services/assessment-review.ts (adds an
  archived-assessment guard to raiseRisk/updateRisk/createCapTask/updateCapTask — no
  schema change, just an early throw), new routes under app/api/offboarding/** and
  app/api/vendors/[id]/engagements/[engagementId]/offboarding/route.ts, a new
  components/offboarding/offboarding-panel.tsx wired into
  app/(internal)/vendors/[id]/page.tsx.
- What to re-check if reverting: no auth/tenancy code touched. The only "schema-adjacent"
  change is behavioral (a new throw path in an existing service), not a model field —
  reverting is a clean file-level git restore. The terminal step
  (completeOffboarding()) writes Offboarding.status/Assessment.status/Engagement.status/
  Vendor.lifecycle_status in one transaction; if this needs undoing on a real document
  that already archived, it is a manual, reasoned document edit (not a script) per
  CONSTRAINTS.md #12 — archives are supposed to be append-only, so "undo" here means
  correcting a mistake by hand, not restoring a delete path.
- Reversible? Yes for code. Not applicable for data — this session uses disposable
  smoke-test vendors/engagements only, cleaned up afterward, same pattern as every prior
  phase's verification.
```

_Phase 9 (CAP tracking and mitigation guidance) was built and verified 2026-08-16 — see
`docs/features/phase-9-cap-tracking-and-mitigation-guidance.md`. The plan filled in before
starting it is kept below for reference; it is closed out, nothing is currently mid-change._

**Closed: Phase 9 — CAP tracking and mitigation guidance (2026-08-16).**

- **Safe commit / baseline:** no git commit exists anywhere in this repo (carried-forward
  gap, `DECISIONS.md` 010). There is no SHA to record; the only rollback mechanism
  available is `git diff`/manual revert of the specific files below.
- **Files being touched:** `lib/db/models/risk.ts` (adds `cap_tasks.escalated_at: Date?`
  — additive, no migration, existing documents read `undefined`/`null`), `lib/services/
assessment-review.ts` (adds `createCapTask`/`updateCapTask`/`detectAndEscalateOverdueCaps`),
  new routes `app/api/risks/[id]/cap-tasks/route.ts`,
  `app/api/risks/[id]/cap-tasks/[taskId]/route.ts`,
  `app/api/risks/cap-tasks/overdue/route.ts`, UI additions to the risk register/detail
  views. Also, first: `lib/scoring/__tests__/residual-risk.test.ts` and `lib/services/
__tests__/assessment-review.test.ts` (test-only, closing Phase 8's flagged gap before
  building on it).
- **What to re-check if this needs reverting:** no auth or tenancy code is touched; the
  one schema change is additive (new optional field), so reverting the model edit alone is
  safe even if documents were already written with `escalated_at` set — the field is just
  ignored by older code. No data migration, no destructive write, no email provider swap
  (still `MAIL_PROVIDER=console`, `ROLLBACK.md`'s "emails cannot be rolled back" rule is
  therefore inert for this phase — nothing leaves the dev console log).
- **Reversible?** Yes, by `git restore`/manual file revert — no schema drop, no
  cross-collection write, no auth change.

---

## Standard recovery recipes

**Uncommitted work, single file**

```bash
git diff -- <file>            # read it first — always
git restore -- <file>
```

**Uncommitted work, everything** — destructive, confirm with the owner first

```bash
git stash push -u -m "wip before discard"   # prefer stashing over discarding
```

**Committed but not pushed — keep the changes as edits**

```bash
git reset --soft HEAD~1
```

**Committed but not pushed — discard entirely** — destructive

```bash
git reset --hard <safe-SHA>
```

**Already pushed / shared** — never rewrite shared history

```bash
git revert <bad-SHA>          # a new commit that undoes it, history intact
```

**Recover a lost commit after a bad reset**

```bash
git reflog                    # find the SHA, then: git reset --hard <SHA>
```

---

## What git cannot roll back

Code reverts are the easy half. These need their own plan, and they are the reason the
"Data changes" and "Reversible?" lines above are not optional:

1. **MongoDB writes.** Reverting code does not un-write documents. Any migration needs a
   tested down-path, or a dump taken first:
   `mongodump --uri="<uri>" --out=./backup-<date>`
2. **Deleted or overwritten evidence files** in S3 or local storage. Confirm S3 versioning
   is enabled before touching storage code; local dev folders have no undo.
3. **Emails already sent** — OTPs, CAP escalations, vendor notifications. Once out, out.
   Prefer a dry-run flag over "just test it against the real sender."
4. **Immutable archives.** Offboarding records and audit trails are append-only by design.
   Corrupting them is not reversible in-band and is a compliance issue, not a bug.
5. **Leaked secrets.** A revert does not unleak a committed credential. Rotate it, then
   purge history.

## Post-rollback duties

- [ ] Note the rollback and its cause in `HANDOVER.md`
- [ ] Log _why_ the approach failed in `DECISIONS.md` — a rejected approach is a decision
      worth keeping, so the next session doesn't retry it
- [ ] Update the relevant `docs/bugs/` or `docs/features/` trace with what didn't work
