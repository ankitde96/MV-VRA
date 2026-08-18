# Feature: Phase 11 — Multi-workspace RBAC, sharing, executive roll-up

|                    |                                        |
| ------------------ | -------------------------------------- |
| **Status**         | done                                   |
| **Owner**          | AI session, at project owner's request |
| **Started**        | 2026-08-17                             |
| **Spec reference** | `PLAN.md` Phase 11; `FLOW.md` F6       |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)    |

## 1. Scope

Four things, built together because they share one dependency chain (real multi-user login
must exist before roles mean anything):

1. **Multi-user internal login.** Removes the Phase 2 `SUPER_ADMIN_EMAIL` gate
   (`DECISIONS.md` 013, 024) — `login()` now authenticates any active `User` whose password
   matches, not just one static account.
2. **RBAC.** A four-role capability matrix (`lib/auth/rbac.ts`) enforced on every
   authorization-sensitive route via `requireCurrentMembershipWithCapability()`, backed by
   membership resolved fresh from the database on every request
   (`lib/auth/current-membership.ts`) — never cached in the signed session cookie, so a role
   change (or removal) takes effect on the very next request, not at next login.
3. **Cross-Workspace Document Sharing.** A manual, explicit per-document grant
   (`lib/services/sharing.ts`) on the previously-unused `SharedDocument` model, scoped to
   vendor-uploaded documents (Phase 4). The one sanctioned exception to tenant isolation
   (`DATA-MODEL.md` §2, `CONSTRAINTS.md` #8), and every read through it is unconditionally
   audit-logged.
4. **Executive roll-up.** `getExecutiveRollup()` aggregates vendor-tier/risk-severity/
   overdue-CAP counts across every workspace a user is authorized for, deciding
   authorization **inside** its per-membership loop, not once at the top.

Does **not** include: server-side session revocation beyond what Phase 2 already has
(rotating `SESSION_SECRET` is still the only global-revoke lever); an invite-email flow for
new users (an admin sets the initial password directly, `DECISIONS.md` 024); a workspace
self-registration flow (workspaces are still created only by direct database access / a
future admin surface, same as every prior phase); any UI for the `viewer` role beyond what
read-only routes already expose (there is no separate `viewer`-specific screen — the role
simply has zero write capabilities).

## 2. Why

`PLAN.md` sequences this phase last deliberately (`DECISIONS.md` 009) — every collection has
carried `workspace_id` since Phase 1, so this phase adds authorization and UI on top of
isolation that already exists, rather than retrofitting isolation itself. Without it, the
system has exactly one authenticatable account total, no way for one workspace to
legitimately see another's data (even when that's the point — an executive overseeing
multiple business units, or a shared vendor's documents), and no record of who changed
whose access. `FLOW.md` F6 named the roll-up's per-workspace-authorization requirement in
prose since Phase 0, before any code existed to satisfy it.

## 3. Plan

Presented to the project owner before writing code; approved to proceed through all four
steps without pausing for per-step review, using subagents for parallelizable pieces:

1. **Auth core.** Remove the `SUPER_ADMIN_EMAIL` gate from `login()`. Build the capability
   matrix (`lib/auth/rbac.ts`) and the fresh-per-request membership resolver
   (`lib/auth/current-membership.ts`), plus a route-level helper
   (`lib/auth/require-capability.ts`) wrapping both. Build workspace-switching
   (`lib/services/workspace-membership.ts` + two new routes) as the one place a session's
   `workspaceId` legitimately changes post-login.
2. **RBAC applied everywhere.** Admin user/membership management
   (`lib/services/admin-users.ts` + `app/api/admin/users/**`), then retrofit every existing
   internal-facing route (vendor/template/assessment/risk/cap/offboarding — 22 routes) to
   call `requireCurrentMembershipWithCapability()` instead of the bare
   `getCurrentSession()` those routes used before.
3. **Sharing.** `lib/services/sharing.ts` + `app/api/sharing/**`, exercising the
   `SharedDocument` model for the first time since Phase 1.
4. **Roll-up.** `lib/services/executive-rollup.ts` + `app/api/rollup/route.ts`.
5. **Seed + UI.** Extend `scripts/seed.ts` with a second workspace and fixture users of
   every role (so there's something real to click through locally). Build the workspace
   switcher, admin user-management page, sharing page, and roll-up dashboard.
6. **Tests + verification.** Unit/integration tests for every new service and auth module,
   full `npm run verify`, then a real-HTTP-request smoke pass covering every named exit
   criterion.

No plan changes mid-flight. The four steps were built by parallel subagents per the
project owner's instruction, then integrated and verified as one pass in this session.

## 4. Flow impact

`FLOW.md` F6 — now fully built, replacing the three-line sketch that existed since Phase 0
with real file/function references. See the flow file for the complete numbered trace.

## 5. Data model impact

No schema changes. `SharedDocument` (`lib/db/models/shared-document.ts`) and
`User.memberships[].role` (`lib/db/models/user.ts`) both existed, unused for their intended
purpose, since Phase 1 — this phase is the first code that reads or writes either for real.
`scripts/seed.ts` gained a second `Workspace` document (`slug: 'beta'`) and three additional
`User` fixtures (`risk_analyst`, `business_owner`, and one `admin`-in-both-workspaces
account) — dev-only, idempotent, same pattern as the existing super-admin seed.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                              | Files                                                                                                                                                                                                                                                                                                                                              | Model           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-08-17 | Filled `ROLLBACK.md`'s Active plan (auth-touching, its own request per `CONSTRAINTS.md` #2). Removed the `SUPER_ADMIN_EMAIL` gate from `login()`. Built `rbac.ts`, `current-membership.ts`, `require-capability.ts`, `workspace-membership.ts`, and the two new auth routes.                                                                                                                                                                               | `lib/auth/login.ts`, `lib/auth/rbac.ts` (new), `lib/auth/current-membership.ts` (new), `lib/auth/require-capability.ts` (new), `lib/services/workspace-membership.ts` (new), `app/api/auth/memberships/route.ts` (new), `app/api/auth/switch-workspace/route.ts` (new)                                                                             | Claude Sonnet 5 |
| 2026-08-17 | Built admin user/membership management, then retrofitted RBAC capability checks onto all 22 pre-existing internal-facing routes (vendor/template/assessment/risk/cap/offboarding).                                                                                                                                                                                                                                                                         | `lib/services/admin-users.ts` (new), `app/api/admin/users/route.ts` (new), `app/api/admin/users/[id]/route.ts` (new), 22 existing route files edited to call `requireCurrentMembership()`/`requireCurrentMembershipWithCapability()`                                                                                                               | Claude Sonnet 5 |
| 2026-08-17 | Built sharing and the executive roll-up.                                                                                                                                                                                                                                                                                                                                                                                                                   | `lib/services/sharing.ts` (new), `app/api/sharing/route.ts` (new), `app/api/sharing/granted/route.ts` (new), `app/api/sharing/available/route.ts` (new), `app/api/sharing/[id]/route.ts` (new), `app/api/sharing/[id]/download/route.ts` (new), `lib/services/executive-rollup.ts` (new), `app/api/rollup/route.ts` (new)                          | Claude Sonnet 5 |
| 2026-08-17 | Extended the seed script; built the workspace switcher, admin users page, sharing page, and roll-up dashboard; wired all four into the internal layout's navigation.                                                                                                                                                                                                                                                                                       | `scripts/seed.ts`, `components/workspace-switcher.tsx` (new), `app/(internal)/admin/users/page.tsx` (new), `components/admin/admin-users-client.tsx` (new), `app/(internal)/sharing/page.tsx` (new), `components/sharing/sharing-client.tsx` (new), `app/(internal)/rollup/page.tsx` (new), `app/(internal)/layout.tsx`                            | Claude Sonnet 5 |
| 2026-08-17 | Fixed TypeScript/Mongoose/ESLint issues surfaced by `npm run verify` (see §7). Wrote unit/integration tests for every new auth module and service. Ran the full gate suite clean, then verified every named exit criterion by real HTTP request against a running dev server using disposable fixture accounts and a disposable smoke-test vendor/document (see §9). Updated `DECISIONS.md`, `FLOW.md`, `TEST-CHECKLIST.md`, `HANDOVER.md`, `ROLLBACK.md`. | `lib/auth/__tests__/{rbac,current-membership}.test.ts` (new), `lib/auth/__tests__/login.test.ts` (extended), `lib/services/__tests__/{workspace-membership,admin-users,sharing,executive-rollup}.test.ts` (new), `docs/DECISIONS.md` (024), `docs/FLOW.md` (F6), `docs/TEST-CHECKLIST.md`, `docs/HANDOVER.md`, `docs/ROLLBACK.md`, this file (new) | Claude Sonnet 5 |

## 7. What didn't work

- **`components/workspace-switcher.tsx`'s `onValueChange` handler** was first written to
  accept only `(workspaceId: string) => Promise<void>`, but the underlying `Select`
  component's `onValueChange` prop can pass `null` (e.g. on a cleared selection) — `tsc`
  caught the mismatch; fixed by widening the handler's parameter to `string | null`.
- **`admin-users.ts`'s `removeWorkspaceUser()`** first tried
  `user.memberships = user.memberships.filter(...)` to drop one membership subdocument —
  Mongoose's `DocumentArray` isn't a plain array and rejects a bare reassignment at the type
  level (`DocumentArray` methods carry document-tracking state a plain array literal
  doesn't have). Fixed with `user.memberships.pull({ workspace_id: workspaceId })`, the
  Mongoose-idiomatic subdocument-array removal method.
- **`components/sharing/sharing-client.tsx`**'s download link first used shadcn's `Button`
  with an `asChild` prop (the pattern from an older shadcn/Radix version) to wrap an anchor
  tag — this codebase's `Button` (base-ui-derived) uses a `render` prop instead. Fixed by
  passing `render={<a href="..." />}`.

## 8. Decisions logged

`DECISIONS.md` 024 (supersedes 013).

## 9. Verification

Ran `npm run verify` (format:check → lint → typecheck → test → build) — all exit 0:

```
Test Files  28 passed (28)
     Tests  190 passed (190)
```

(161 before this phase → 190: +29 new tests — `lib/auth/__tests__/rbac.test.ts`,
`lib/auth/__tests__/current-membership.test.ts`, extensions to `login.test.ts`, and
`lib/services/__tests__/{workspace-membership,admin-users,sharing,executive-rollup}.test.ts`.)

Verified every named exit criterion by real HTTP request against a running dev server
(`npm run db:seed` first, to create the second workspace and role-varied fixture users;
`SUPER_ADMIN_PASSWORD_HASH` was already set from a prior session, unchanged this time):

1. **Multi-user login** — logged in as three different fixture accounts
   (`multi-workspace-admin@mv-vra.local`, `analyst@mv-vra.local`,
   `business-owner@mv-vra.local`) simultaneously, each getting its own valid session —
   `{"ok":true}` / `200` for all three. This alone is the proof the `SUPER_ADMIN_EMAIL` gate
   is gone.
2. **Memberships and workspace switching** — `GET /api/auth/memberships` for the
   multi-workspace admin listed both real workspaces; for the analyst, exactly one.
   `POST /api/auth/switch-workspace` to a workspace the analyst has no membership in →
   `403 "You do not have a membership in that workspace"`; the same call for the
   multi-workspace admin, to a workspace they're genuinely a member of → `200`.
3. **RBAC capability enforcement** — `business-owner` session attempting
   `POST /api/templates` (gated by `template.manage`, which `business_owner` lacks) →
   `403 "Role 'business_owner' does not have the 'template.manage' capability"`.
4. **Dynamic role resolution, no re-login, both directions** — admin promoted the
   business-owner fixture account to `risk_analyst` via `PATCH /api/admin/users/[id]`; the
   **same signed session cookie**, with no re-login, then passed the `template.manage`
   check on its very next request (confirmed by the request reaching Zod validation — a 422
   on the request body, not the 403 it got before — proving the auth/authorization layer
   passed). Reverted the role back to `business_owner` via the same endpoint; the same
   cookie's next request against the identical route returned `403` again, immediately.
5. **Cross-Workspace Document Sharing** — created a disposable smoke-test vendor and
   uploaded a real document to it as the admin (in the default workspace), shared it to the
   second (`beta`) workspace via `POST /api/sharing`, switched the multi-workspace admin's
   session to `beta`, confirmed `GET /api/sharing/available` listed it (and the analyst's
   own default-workspace session, which was never granted the share, saw an empty list),
   downloaded it via `GET /api/sharing/[id]/download` and `diff`'d the bytes against the
   original upload — identical. Switched back to the default workspace and attempted the
   same download using the analyst's own (default-workspace) session — `403 "This document
is not shared with your workspace"`, since only `beta` was ever granted.
6. **Executive roll-up, per-membership authorization** — `GET /api/rollup` for the
   multi-workspace admin (an `admin` membership in both workspaces) returned both
   workspaces' real vendor-tier counts, `authorized_workspace_count: 2`. The same endpoint
   for the risk analyst (one membership, `risk_analyst` has `rollup.view`) returned exactly
   that one workspace, `authorized_workspace_count: 1`. For the business owner (one
   membership, `business_owner` lacks `rollup.view`) returned `workspaces: []`,
   `authorized_workspace_count: 0`, while `total_membership_count` correctly still read `1`
   — proving the function distinguishes "has no memberships" from "has a membership that
   isn't authorized," not conflating the two.
7. **Unauthenticated refusal** — `GET /api/rollup` and `GET /api/admin/users` with no
   session cookie both returned `401 {"error":"unauthenticated"}`.

Cleaned up afterward: deleted the smoke-test vendor, its `SharedDocument` grant, and the
locally-stored uploaded file; logged out all three fixture sessions; stopped the dev server.
No production/dev-persistent data was left behind beyond the seed script's own idempotent
fixtures (which are meant to persist for future local sessions).

Skipped: no browser-driven (Playwright-style) test exists for the workspace switcher, admin
users page, sharing page, or roll-up dashboard — verified by real HTTP request against the
API routes they call and by reading the components, same discipline as every prior UI-adding
phase.

## 10. Rollback

No safe commit SHA exists anywhere in this repo (`DECISIONS.md` 010, re-deferred through
every phase to date). `ROLLBACK.md`'s Active plan block (dated 2026-08-17) lists the full
file set for a phase revert. `login.ts` reverting alone restores the `SUPER_ADMIN_EMAIL`
gate without affecting any seeded data — `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD_HASH`
remain valid regardless of which side of that gate is in place. No destructive writes
anywhere in this phase; every `SharedDocument` read is an additive audit-logged read, never
a mutation of the underlying vendor data.

## 11. Follow-ups

- **No invite-email flow** — an admin sets a new user's initial password directly
  (`DECISIONS.md` 024). A real deployment would likely want email-based invites instead.
- **`getCurrentMembership()` adds one database read to every authorization check.**
  Acceptable at MVP scale (`PLAN.md` A1); revisit with a short-TTL cache only if profiling
  ever shows it matters — do not cache the role in the signed cookie itself (that's the
  exact staleness gap this phase's design was chosen to avoid, `DECISIONS.md` 024).
- **No browser-driven (Playwright-style) test exists for any of the four new UI surfaces** —
  see §9's skipped item.
- **This was the last phase in `PLAN.md`'s 0–11 sequence.** Any further work is
  post-MVP/hardening (Phase 12's originally-scoped S3 production config, or any of the
  eight explicitly-parked feature areas from `DECISIONS.md` 001).
