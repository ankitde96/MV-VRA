# Feature: Vendor intake, Inherent Risk Engine, tiering

|                    |                                             |
| ------------------ | ------------------------------------------- |
| **Status**         | done                                        |
| **Owner**          | Project owner + Claude Sonnet 5             |
| **Started**        | 2026-08-14                                  |
| **Spec reference** | `VRA MVP Feature Specification.md` §2.1, §3 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)         |

## 1. Scope

The first real user-facing feature and the first end-to-end demoable slice: an internal
business owner submits a vendor intake form; a pure scoring function (the **Inherent Risk
Engine**) computes an inherent risk score from workspace-configured weights; **Tiering &
Triage** maps that score to Tier 1/2/3 against workspace-configured thresholds, or the
engagement lands in `scoring_failed` if the input can't be scored; the Vendor and
Engagement are written atomically; the result appears in a new vendor inventory view.

Does **not** include: SPOC management, storage, template builder, questionnaire portal,
risk register, CAPs, offboarding, RBAC (Phases 4–11).

## 2. Why

Third-party risk needs to enter the system somewhere. This is that entry point, and the
place `DATA-MODEL.md` §4's "never fabricate a tier" rule has to hold from day one — an
under-assessed high-risk vendor is the failure mode this system exists to prevent.

## 3. Plan (written before implementing)

Full plan in this session's plan-mode output (see chat history / `docs/DECISIONS.md`
014–016 for the decisions it produced). Summary: `app/api/vendors/route.ts` (HTTP + Zod) →
`lib/services/vendor-intake.ts` (orchestration) → `lib/repositories/*` (only place models
are queried) + `lib/scoring/inherent-risk.ts` (pure, framework-agnostic). Two prerequisite
gaps were raised and resolved before starting: the local mongod replica-set conversion
(approved and done — `DECISIONS.md` 014) and the git-baseline gap (explicitly re-deferred by
the project owner, out of scope for this task).

## 4. Flow impact

`docs/FLOW.md` F1 rewritten in full with real file references and marked ✅ BUILT. The gap
it used to flag (steps 4→5, "a null tier must not silently default to Tier 3") is now
resolved by construction: `scoreAndTierEngagement()` returns a discriminated union with no
shared shape between the tiered and failed cases.

## 5. Data model impact

No schema change — `Vendor`, `Engagement`, `Workspace` models already existed from Phase 1
with exactly the fields this phase needed. First-ever write to `audit_events` (model existed
since Phase 1, unused until now — `DECISIONS.md` 016 notes this as a Phase 1/2 gap, not
retroactively fixed). `TenantRepository.create()` (`lib/repositories/base.ts`) gained an
optional `{ session }` param so a caller can write across two repositories inside one
MongoDB transaction.

Environment/infra change (not a schema change): local mongod converted from standalone to a
single-node replica set `rs0` — `DECISIONS.md` 014. `MONGODB_URI` defaults now carry
`?replicaSet=rs0` (`lib/env.ts`, `.env.example`).

## 6. Work log

| Date       | What was done                                                                                                                   | Files                                                                                                                                     | Model           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-08-14 | Converted local mongod to replica set, verified with a real transaction; updated `MONGODB_URI` defaults                         | `/opt/homebrew/etc/mongod.conf` (outside repo), `lib/env.ts`, `.env.example`                                                              | Claude Sonnet 5 |
| 2026-08-14 | Built and unit-tested the Inherent Risk Engine and Tiering & Triage                                                             | `lib/scoring/inherent-risk.ts`, `lib/scoring/__tests__/inherent-risk.test.ts`                                                             | Claude Sonnet 5 |
| 2026-08-14 | Added `EngagementRepository`, `WorkspaceRepository`; extended `TenantRepository.create()` with a session param                  | `lib/repositories/engagement-repository.ts`, `lib/repositories/workspace-repository.ts`, `lib/repositories/base.ts`                       | Claude Sonnet 5 |
| 2026-08-14 | Built the first `audit_events` writer and the first route error wrapper                                                         | `lib/audit/record-event.ts`, `lib/http/with-route-errors.ts`                                                                              | Claude Sonnet 5 |
| 2026-08-14 | Built the orchestrating service (score → tier → atomic write → audit) and its integration test                                  | `lib/services/vendor-intake.ts`, `lib/services/__tests__/vendor-intake.test.ts`                                                           | Claude Sonnet 5 |
| 2026-08-14 | Built the API route, the intake form, and the inventory page                                                                    | `app/api/vendors/route.ts`, `components/vendor-intake-form.tsx`, `app/(internal)/vendors/new/page.tsx`, `app/(internal)/vendors/page.tsx` | Claude Sonnet 5 |
| 2026-08-14 | Seeded real `risk_weights` (previously empty, which would have hit `scoring_failed` on every intake in a fresh dev environment) | `scripts/seed.ts`                                                                                                                         | Claude Sonnet 5 |
| 2026-08-14 | Verified end to end by real HTTP request against a running dev server (see §9)                                                  | —                                                                                                                                         | Claude Sonnet 5 |
| 2026-08-14 | Updated `FLOW.md`, `ARCHITECTURE.md`, `TEST-CHECKLIST.md`, `DECISIONS.md` (014–016), this trace                                 | `docs/FLOW.md`, `docs/ARCHITECTURE.md`, `docs/TEST-CHECKLIST.md`, `docs/DECISIONS.md`                                                     | Claude Sonnet 5 |

## 7. What didn't work

- **Mongoose's `Model.create()` overloads didn't resolve against the generic `T` in
  `TenantRepository`** when threading a `ClientSession` through the array form. Fixed with a
  narrow, explicitly-commented cast in `lib/repositories/base.ts` rather than widening the
  repository's public type signature — the integration test exercises exactly this path
  against a real transaction, so the cast is backed by a real assertion, not just a type
  escape hatch.
- **`workspace.settings.risk_weights` collapsed to the schema-definition shape under
  `InferSchemaType`**, not the runtime value type — the same category of Mongoose/TypeScript
  gotcha already documented in `docs/features/phase-1-data-layer-and-tenant-guard.md` §7 for
  `timestamps`, just on a different nested-plain-object field. Worked around with an explicit
  cast in `lib/services/vendor-intake.ts` rather than restructuring the `Workspace` schema
  (out of scope for this task, and the Phase 1 model is otherwise fine).
- **The manual HTTP smoke test needed a real login**, and the existing `SUPER_ADMIN_PASSWORD_HASH`
  in `.env.local` didn't match the password the project owner first tried. Rather than guess
  further, backed up `.env.local`, generated a throwaway temp-password hash, ran the smoke
  test, then restored the original `.env.local` and re-ran `npm run db:seed` to put the
  original hash back in the database. `.env.local.bak-phase3-smoke` was the temporary
  backup filename, removed after restoring.

## 8. Decisions logged

- `docs/DECISIONS.md` 014 — replica-set conversion, git-baseline re-deferral
- `docs/DECISIONS.md` 015 — inherent-risk factor enums and weight-lookup shape
- `docs/DECISIONS.md` 016 — Phase 1/2 audit-trail gap noted, not retroactively fixed

## 9. Verification

**Gate 1** (`npm run format:check && npm run lint && npm run typecheck`): all clean —
0 errors, 0 warnings, 0 tsc output.

**Gate 2** (`npm test`):

```
 Test Files  8 passed (8)
      Tests  51 passed (51)
```

Includes the new `lib/scoring/__tests__/inherent-risk.test.ts` (17 assertions across tier
boundaries and the unscoreable case) and `lib/services/__tests__/vendor-intake.test.ts`
(real transaction against local MongoDB — both the tiered and `scoring_failed` paths).

**Gate 3** (`npm run build`): compiled successfully, routes generated including
`/api/vendors`, `/vendors`, `/vendors/new`.

**Gate 6, manual smoke, by real HTTP request against a running `npm run dev`:**

- Unauthenticated `GET /vendors` → `307` redirect to `/login`
- Unauthenticated `POST /api/vendors` → `401 {"error":"unauthenticated"}`
- Logged in, `POST /api/vendors` with PII+Financial, external, admin, single-source →
  `201`, `vendor.inherent_risk_tier: 1`, `engagement.status: "tiered"`
- Logged in, `POST /api/vendors` with none/none/none/fully_redundant →
  `201`, `vendor.inherent_risk_tier: 3`, `engagement.status: "tiered"`
- `GET /vendors` (authenticated) rendered both vendors with the correct `Tier 1` / `Tier 3`
  badges

**Not exercised by live HTTP request:** the `scoring_failed` path through the actual route
— every enum value the Zod schema accepts is covered by the seeded `risk_weights`, so
provoking it live would require deliberately breaking the seed data. It's covered instead by
the integration test (`lib/services/__tests__/vendor-intake.test.ts`, second case), which
exercises the identical service code path against a real transaction and asserts both the
returned values and what's actually stored in the database.

**Skipped:** Gate 4's cross-workspace-via-API-route item and Gate 5 (no template/archive
code exists yet) — both out of scope for this phase, as noted in `TEST-CHECKLIST.md`.

## 10. Rollback

See `docs/ROLLBACK.md`'s Active plan, filled in before this work started. No git baseline
exists to revert to (re-confirmed, `DECISIONS.md` 014); the local mongod replica-set
conversion is a one-way environment change (see `docs/ROLLBACK.md` for how to reverse it if
the phase itself were abandoned, though nothing from here on works without it).

## 11. Follow-ups

- Backfill Phase 1/2 audit events (`DECISIONS.md` 016) before the offboarding/archival
  phases need a complete audit trail.
- The git-baseline gap is now three phases deep and was explicitly re-deferred a third time.
- `network_exposure`/`system_access_level`/`business_redundancy` option values and their
  weights are a stated assumption (`DECISIONS.md` 015) — confirm against the real risk
  team's scoring matrix before this goes anywhere near production data.
- No aggregation module exists yet — `app/(internal)/vendors/page.tsx` joins Vendor and
  Engagement in memory. Fine at MVP scale (`PLAN.md` A1); revisit if that assumption breaks.
