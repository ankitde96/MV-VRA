# Feature: Phase 1 — Data layer and the tenant guard

|                    |                                     |
| ------------------ | ----------------------------------- |
| **Status**         | done                                |
| **Owner**          | project owner + AI                  |
| **Started**        | 2026-08-14                          |
| **Spec reference** | `docs/PLAN.md` §3, Phase 1          |
| **Models used**    | Claude Opus 5 (`claude-opus-5[1m]`) |

## 1. Scope

Build the data layer: Mongoose models for all 13 collections in `DATA-MODEL.md` §2, a
hot-reload-safe connection singleton, the `TenantContext` type, a repository base class
that cannot execute a query without one, an explicit index-sync script, and a seed script
(workspace + super-admin user + mitigation guidance library). Explicitly not in scope: any
API route, any feature repository beyond `VendorRepository` (built only to exercise and
test the tenant guard), and multi-document transactions (deferred — see §3 and
`DECISIONS.md` 011).

## 2. Why

Per `PLAN.md`'s critical path: "Retrofitting isolation across ten phases of existing
queries is a rewrite... it is built first, and it fails closed by construction." Every
later phase's repositories extend the base class built here.

## 3. Plan (written before implementing)

Per `PLAN.md` Phase 1, step by step: connection singleton → models with indexes declared
alongside → `TenantContext` + repository base that throws when unscoped → index-sync
script → seed script → tests (unscoped throws; cross-workspace read fails; every declared
index exists after sync).

**Two deviations, both agreed with the project owner before proceeding:**

1. **MongoDB setup.** The plan assumed a decision would be needed on how to provide
   MongoDB locally (memory-server, external URI, etc.). It turned out the project owner
   already had a MongoDB Community Homebrew service running standalone on
   `localhost:27017` — discovered by process/port inspection after `mongod`/`docker`/`brew`
   weren't on `PATH` in this shell. No new setup was needed.
2. **Replica-set conversion deferred.** `DATA-MODEL.md` §5 says dev should run a
   single-node replica set so multi-document transactions work. The project owner asked
   for the reasoning restated (clarifying that "replica set" is unrelated to evidence-file
   storage, which was the source of the confusion), then explicitly chose to keep the
   local mongod standalone and revisit before Phase 3, when transactions first become
   load-bearing. Logged as `DECISIONS.md` 011.

## 4. Flow impact

None directly — no `FLOW.md` execution path is created or completed by this phase alone.
This phase is the substrate every flow's repository layer will run on.

## 5. Data model impact

All 13 collections from `DATA-MODEL.md` §2 now exist as Mongoose models:
`Workspace`, `User`, `Vendor`, `Engagement`, `QuestionnaireTemplate`, `Assessment`,
`Response`, `Risk`, `OtpChallenge`, `Offboarding`, `AuditEvent`, `MitigationGuidance`,
`SharedDocument` — see `lib/db/models/*.ts`. Every declared index matches `DATA-MODEL.md`
§2 field-for-field (verified by test, see §9). No transactions used yet.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                         | Files                                                                                                                                                   | Model                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Discovered the project owner's local MongoDB was already installed and running (Homebrew service, standalone, empty). Confirmed via `ps`/`lsof`/`mongosh`, not assumed.                                                                               | none (investigation only)                                                                                                                               | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Added `mongoose` (approved earlier via `DECISIONS.md` 004's stack choice) and extended `lib/env.ts` with `MONGODB_URI`.                                                                                                                               | `package.json`, `lib/env.ts`                                                                                                                            | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Added the shared error classes (`ValidationError`, `NotFoundError`, `ForbiddenError`, `TenantScopeError`) referenced throughout `PLAN.md` §2.                                                                                                         | `lib/errors/index.ts`                                                                                                                                   | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built the hot-reload-safe Mongoose connection singleton, caching the connection promise on `globalThis` to survive Next.js dev recompiles.                                                                                                            | `lib/db/connect.ts`                                                                                                                                     | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built all 13 Mongoose models per `DATA-MODEL.md` §2, indexes declared alongside each schema; barrel file for script/registration use.                                                                                                                 | `lib/db/models/*.ts` (13 model files + `index.ts`)                                                                                                      | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built `TenantContext` and the `TenantRepository` base class — every public method routes through `scope()`, which injects `workspace_id`; construction without one throws `TenantScopeError`. Built `VendorRepository` as the first concrete example. | `lib/tenant/context.ts`, `lib/repositories/base.ts`, `lib/repositories/vendor-repository.ts`                                                            | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Added `tsx` (approved) to run standalone scripts with the `@/` alias resolved; built the explicit index-sync script and the idempotent seed script (workspace, super-admin user, mitigation-guidance library).                                        | `scripts/db-indexes.ts`, `scripts/seed.ts`, `package.json`                                                                                              | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Wrote and ran the three required test suites against the real local MongoDB (`mv-vra-test` database) — unscoped-construction, cross-workspace isolation, and index-existence.                                                                         | `lib/repositories/__tests__/base.test.ts`, `lib/repositories/__tests__/tenant-isolation.test.ts`, `lib/db/__tests__/indexes.test.ts`, `vitest.setup.ts` | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Updated `TEST-CHECKLIST.md` Gate 2 and the STATUS banner; marked `ARCHITECTURE.md` §5 `✅ BUILT`; logged `DECISIONS.md` 011.                                                                                                                          | `docs/TEST-CHECKLIST.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`                                                                                   | Claude Opus 5 (`claude-opus-5[1m]`) |

## 7. What didn't work

- **`Vendor.create(...)` and other `Model` calls typed to a nonsensical
  `{ [x: string]: NativeDate }` shape**, producing confusing TypeScript errors that looked
  unrelated to the actual code (`workspace_id incompatible with Date`, etc.). Root cause:
  every model used custom timestamp field names —
  `timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }` — and without `as const`
  on that options object, TypeScript widens the string literals `'created_at'`/`'updated_at'`
  to plain `string`, which breaks Mongoose's `InferSchemaType` mapped-type logic and collapses
  the whole inferred document type to a generic string-indexed signature. Confirmed by
  isolating the exact mechanism in a scratch schema before touching every model file. Fixed
  by adding `as const` to every `timestamps: {...}` option across all ten models that declare
  one. This is a real Mongoose 9 + TypeScript gotcha worth remembering: **any object literal
  passed as Mongoose schema options whose literal string values matter for type inference
  needs `as const`,** not just the timestamps option — worth checking again if a similar
  "everything collapses to an index signature" error reappears elsewhere (e.g. `enum` arrays
  assigned to a variable before being passed in, rather than declared inline).
- **`mongoose` 9.x removed the `FilterQuery` type export**, renaming it to `QueryFilter`
  (confirmed by grepping the package's own `.d.ts` files — `FilterQuery` appears nowhere,
  `QueryFilter` is the direct replacement). `UpdateQuery` is unchanged. This is an
  undocumented-in-our-context breaking change between the Mongoose major version we
  installed and the `FilterQuery` name used in most existing Mongoose+TypeScript examples
  online — worth remembering if a future session copies a Mongoose snippet from
  documentation written against Mongoose 8 or earlier.
- **Duplicate-index warnings on `Workspace.slug` and `User.email`** — both were declared
  `unique: true` at the field level _and_ via a separate `schema.index()` call. Mongoose
  compiles both into the index list, producing a harmless-but-noisy warning at
  `syncIndexes()` time. Fixed by removing the field-level `unique: true` and keeping only
  the explicit `.index()` declaration, everywhere — the project's convention going forward
  is: indexes are declared exactly once, via `schema.index()`, never via field-level
  `unique`/`index` options, so there is one place to look for what's indexed.
- **`findOneAndUpdate(..., { new: true })` is deprecated** in this Mongoose version in favor
  of `{ returnDocument: 'after' }`. Fixed in `scripts/seed.ts`.

## 8. Decisions logged

- `DECISIONS.md` 011 — local mongod stays standalone; replica-set conversion deferred to
  Phase 3, when transactions first become load-bearing.

## 9. Verification

Gates run: 0 (informally — `node --version`, local mongod confirmed reachable), 1, 2, 3 via
`npm run verify` from a clean state. Skipped: 4 (only `VendorRepository` exists — tenant
isolation is proven at the repository layer by Gate 2's integration tests, but the gate as a
whole needs every repository and API route, which don't exist yet), 5 (no template/archive
code exists), 6 (not a release).

```
$ rm -rf .next && npm run verify

> mv-vra@0.1.0 verify
> npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build

> mv-vra@0.1.0 format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> mv-vra@0.1.0 lint
> eslint

> mv-vra@0.1.0 typecheck
> next typegen && tsc --noEmit

Generating route types...
✓ Types generated successfully

> mv-vra@0.1.0 test
> vitest run

 RUN  v4.1.10 /Users/ankit.de/Desktop/VRA

 Test Files  4 passed (4)
      Tests  24 passed (24)
   Start at  10:47:05
   Duration  518ms (transform 111ms, setup 266ms, import 431ms, tests 72ms, environment 632ms)

> mv-vra@0.1.0 build
> next build

▲ Next.js 16.3.0 (Turbopack)
✓ Running next.config.ts took 10ms
  Creating an optimized production build ...
✓ Compiled successfully in 1523ms
  Running TypeScript ...
  Finished TypeScript in 2.1s ...
  Collecting page data using 5 workers ...
✓ Generating static pages using 5 workers (4/4) in 229ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found

○  (Static)  prerendered as static content
```

`npm test`'s 24 passing tests break down as: 1 env smoke test (Phase 0), 4 repository
construction tests, 5 tenant-isolation integration tests, 14 index-existence tests (13
models + 1 "discovered at least one model" sanity check) — all against the live local
`mv-vra-test` database, confirmed to be a separate database from the dev `mv-vra` one
(checked via `mongosh listDatabases` and per-database document counts, not assumed).

Additionally ran the two operational scripts against the real local mongod and confirmed
idempotency by running each twice:

```
$ npm run db:indexes
Syncing indexes for Workspace...
Syncing indexes for User...
Syncing indexes for Vendor...
Syncing indexes for Engagement...
Syncing indexes for QuestionnaireTemplate...
Syncing indexes for Assessment...
Syncing indexes for Response...
Syncing indexes for Risk...
Syncing indexes for OtpChallenge...
Syncing indexes for Offboarding...
Syncing indexes for AuditEvent...
Syncing indexes for MitigationGuidance...
Syncing indexes for SharedDocument...
Done. 13 model(s) synced.

$ npm run db:seed
SUPER_ADMIN_PASSWORD_HASH not set — seeding a placeholder hash that cannot authenticate. Set it before Phase 2 login is exercised.
Workspace ready: default (6a7ea385e12bcae5dc8b8481)
Super-admin user ready: admin@mv-vra.local
Mitigation guidance library ready: 2 entr(y/ies).
```

Second run of `db:seed` produced the identical workspace ID and the same document counts
(checked via `mongosh` — 1 workspace, 1 user, 2 mitigation-guidance entries both times),
confirming the upsert-by-natural-key logic doesn't duplicate on re-run.

## 10. Rollback

**Still no git commit exists anywhere in this repo** (carried forward from Phase 0,
`DECISIONS.md` 010 — the project owner has not yet set up git). This phase adds a real
database layer with real local data (`mv-vra` database now has a seeded workspace, user,
and guidance library). If something needs to be undone: the code has no committed baseline
to revert to (hand-fix only); the _data_ can be cleared by dropping the `mv-vra` and
`mv-vra-test` databases via `mongosh` — both are freely re-creatable by re-running
`db:indexes` and `db:seed`, since nothing downstream depends on them yet.

## 11. Follow-ups

- **Raise the replica-set question again before Phase 3.** `DECISIONS.md` 011 — Phase 3's
  atomic Vendor+Engagement write will fail outright against the current standalone mongod.
- Only `VendorRepository` exists. Phase 3+ each add the repository their feature needs,
  extending `TenantRepository`.
- No API routes exist yet, so the tenant guard has only been exercised directly against
  repositories in tests — not yet through an HTTP boundary. Gate 4 in `TEST-CHECKLIST.md`
  stays unchecked until that exists.
- The Vitest "unsupported by `configLoader: 'native'`" warning (noted since Phase 0) is
  still present and still harmless; still not fixed.
