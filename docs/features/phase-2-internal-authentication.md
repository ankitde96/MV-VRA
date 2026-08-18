# Feature: Phase 2 — Internal authentication

|                    |                                                    |
| ------------------ | -------------------------------------------------- |
| **Status**         | done                                               |
| **Owner**          | project owner + AI                                 |
| **Started**        | 2026-08-14                                         |
| **Spec reference** | `docs/PLAN.md` §3, Phase 2; `ARCHITECTURE.md` §1.2 |
| **Models used**    | Claude Opus 5 (`claude-opus-5[1m]`)                |

## 1. Scope

Static super-admin login for the internal console: argon2 password verification against
the existing `User` collection, a stateless HMAC-signed session cookie, and route
protection that fails closed by default. A minimal `/login` page and a `/dashboard`
placeholder to prove the protection end to end. Explicitly not in scope: Google SSO
(parked post-MVP), multi-user login/RBAC (the `User` model supports it, this phase
deliberately doesn't use that yet — `DECISIONS.md` 013), and the vendor OTP portal
(Phase 6, a different auth surface entirely).

## 2. Why

Every internal feature from Phase 3 onward needs a logged-in actor to attribute actions to
and a boundary to keep the console from being reachable by anyone. This is also the
project's first auth logic, so it sets the pattern (session shape, cookie discipline,
fail-closed routing) that Phase 6's vendor portal auth will need to stay distinct from.

## 3. Plan (written before implementing)

Per `PLAN.md` Phase 2 and `CONSTRAINTS.md` #2 (auth changes are their own request with
their own rollback plan): `docs/ROLLBACK.md`'s Active plan was filled in first, naming the
files to be touched and the fact that there is still no git baseline to revert to
(carried forward, not resolved, from Phase 0/1). Then: argon2 dependency approval → session
token module → cookie constants → login service function → route protection → login/logout
routes and pages → verify by real HTTP request, not by reading the code.

**Deviations, both surfaced and resolved during the session:**

1. **Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`** (discovered from the dev
   server's own warning on first run, then confirmed from Next's bundled docs before
   acting). Built and named the file `proxy.ts` with an exported `proxy` function from the
   start rather than migrating later — see §7.
2. **No `sessions` collection exists** (not planned in `DATA-MODEL.md`). Rather than add
   one, sessions are stateless and HMAC-signed — a deliberate choice with real tradeoffs,
   logged as `DECISIONS.md` 012.

## 4. Flow impact

No `FLOW.md` execution path is added or completed — internal login isn't one of F1–F6.
It's the prerequisite every internal-facing flow from Phase 3 onward will assume exists.

## 5. Data model impact

None. Uses the existing `User` model from Phase 1 unmodified. No `sessions` collection —
see `DECISIONS.md` 012 for why.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                       | Files                                                                                                                                                                                 | Model                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Filled `ROLLBACK.md`'s Active plan before touching anything, per `CONSTRAINTS.md` #2. Got explicit approval for `argon2`, confirmed the native binding works on this machine before building on it.                                                 | `docs/ROLLBACK.md`                                                                                                                                                                    | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Extended `lib/env.ts` with `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH`, `SESSION_SECRET` — the last has no default in production (fails the boot), a dev-only fallback otherwise.                                                              | `lib/env.ts`, `.env.example`                                                                                                                                                          | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built the stateless session token module on Web Crypto (`crypto.subtle`) rather than `node:crypto`/`Buffer`, so it works regardless of which runtime Next.js runs the proxy file on.                                                                | `lib/auth/session.ts`, `lib/auth/session-cookie.ts`                                                                                                                                   | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built `login()`, gated to `SUPER_ADMIN_EMAIL` specifically (`DECISIONS.md` 013), returning null uniformly for wrong password / unknown email / disabled account.                                                                                    | `lib/auth/login.ts`, `lib/auth/current-session.ts`                                                                                                                                    | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built `proxy.ts` (discovered and applied the Next.js 16 middleware→proxy rename — see §7) — fails closed by default with an explicit public-path allowlist.                                                                                         | `proxy.ts`                                                                                                                                                                            | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built the login/logout API routes, the login page, and the `(internal)` route group's layout + a `/dashboard` placeholder proving protection works.                                                                                                 | `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/login/page.tsx`, `app/(internal)/layout.tsx`, `app/(internal)/dashboard/page.tsx`, `components/logout-button.tsx` | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Built `scripts/hash-password.ts` so a real password hash is generated locally rather than ever hardcoded; wired `--env-file-if-exists=.env.local` into the `db:*`/`hash-password` npm scripts so they see the same env as `next dev`.               | `scripts/hash-password.ts`, `package.json`                                                                                                                                            | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Updated `scripts/seed.ts` to read from `lib/env.ts` instead of raw `process.env`, and to `$set` the password hash on every run (not just `$setOnInsert`) so re-seeding after generating a real hash actually updates the existing placeholder user. | `scripts/seed.ts`                                                                                                                                                                     | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Verified the entire flow by real HTTP request against a running dev server (§9), then wrote automated tests for the session module and login function.                                                                                              | `lib/auth/__tests__/session.test.ts`, `lib/auth/__tests__/login.test.ts`                                                                                                              | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-14 | Logged `DECISIONS.md` 012–013; updated `TEST-CHECKLIST.md` Gate 4 and `ARCHITECTURE.md` §2.                                                                                                                                                         | `docs/DECISIONS.md`, `docs/TEST-CHECKLIST.md`, `docs/ARCHITECTURE.md`                                                                                                                 | Claude Opus 5 (`claude-opus-5[1m]`) |

## 7. What didn't work

- **`npm run dev` printed a deprecation warning on first boot**: "The `middleware` file
  convention is deprecated. Please use `proxy` instead," pointing at
  `npx @next/codemod@canary middleware-to-proxy .`. Ran the codemod first, but it refused
  outright — it requires a clean git state before running, and this repo has no commits at
  all (`DECISIONS.md` 010) to be "clean" against. Rather than force it, read Next's own
  bundled migration doc directly
  (`node_modules/next/dist/docs/.../file-conventions/proxy.md`) to confirm the actual
  mechanism was a simple rename — `middleware.ts` → `proxy.ts`, exported function renamed
  `middleware` → `proxy`, same signature, same `config.matcher` shape — and applied it by
  hand. Confirmed by the dev server's build output afterward: `ƒ Proxy (Middleware)`
  instead of the deprecation warning. Worth remembering: any future codemod invocation in
  this repo will hit the same "stash or commit first" refusal until a git baseline exists.
- **`npm run db:seed` silently kept warning "SUPER_ADMIN_PASSWORD_HASH not set"** even after
  writing a real hash into `.env.local`. Root cause: `tsx` (and Node generally) does not
  auto-load `.env.local` the way `next dev`/`next build` do internally — that loading is a
  Next.js-specific behavior, not a general Node one. Fixed by adding Node's own
  `--env-file-if-exists=.env.local` flag (available natively since Node 20.6, no new
  dependency) to every script's npm command. `--env-file` (without `-if-exists`) was
  considered and rejected — it errors on a missing file, which would break a fresh clone
  with no `.env.local` yet.
- **A subtle bug caught before it shipped, not after**: the first version of
  `scripts/seed.ts` used `$setOnInsert` for `password_hash`, meaning re-running the seed
  script after generating a real password hash would never actually update the
  already-existing placeholder-hash user — the placeholder would persist forever. Caught by
  testing the actual login flow end-to-end (a real hash simply didn't work) rather than
  trusting the script ran without error. Fixed by moving `password_hash` to its own `$set`
  (unconditional update) while keeping the rest of the fields under `$setOnInsert`.

## 8. Decisions logged

- `DECISIONS.md` 012 — stateless HMAC session cookie (no `sessions` collection); `proxy.ts`
  fails closed by default with an explicit public-path allowlist rather than an enumerated
  protected-routes list.
- `DECISIONS.md` 013 — login gated to `SUPER_ADMIN_EMAIL` specifically, not any active
  `User` document, closing a gap the Phase-1-built multi-user-capable model would otherwise
  leave open.

## 9. Verification

Gates run: 0 (informal), 1, 2, 3 via `npm run verify` from a clean state; Gate 4 exercised
directly by HTTP request against a running `npm run dev` server (not by reading the code —
CLAUDE.md habit 8). Skipped: 5 (no schema/template change), 6 (not a release, and F1–F3
don't exist yet to smoke-test).

```
$ rm -rf .next && npm run verify
...
> mv-vra@0.1.0 test
> vitest run

 Test Files  6 passed (6)
      Tests  34 passed (34)

> mv-vra@0.1.0 build
> next build

▲ Next.js 16.3.0 (Turbopack)
✓ Compiled successfully in 2.0s
  Running TypeScript ...
  Finished TypeScript in 2.2s ...
✓ Generating static pages using 9 workers (8/8) in 323ms

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /dashboard
└ ○ /login

ƒ Proxy (Middleware)
```

Gate 4, verified by real request against `npm run dev` (transcript, not paraphrased):

```
=== 1. Unauthenticated request to protected page redirects to /login ===
status=307 redirect=http://localhost:3000/login?from=%2Fdashboard

=== 2. Unauthenticated request to protected API returns 401 JSON ===
{"error":"unauthenticated"}
status=401

=== 3. Public paths reachable without a session ===
/ -> status=200
/login -> status=200

=== 4. Login with wrong password -> 401, generic error ===
{"error":"invalid_credentials"}
status=401

=== 5. Login with wrong (unregistered) email -> same 401, same error shape ===
{"error":"invalid_credentials"}
status=401

=== 6. Login with correct credentials ===
{"ok":true}
status=200
Set-Cookie: mvvra_internal_session=<token>; Path=/; HttpOnly; SameSite=lax

=== 7. Access /dashboard WITH the session cookie ===
status=200 — page renders "Signed in as user <id> in workspace <id>" (seeded IDs)

=== 8. Logout ===
{"ok":true}
status=200

=== 9. After logout, /dashboard is protected again ===
status=307 redirect=http://localhost:3000/login?from=%2Fdashboard

=== 10. Set-Cookie attributes ===
set-cookie: mvvra_internal_session=...; Path=/; HttpOnly; SameSite=lax
(no Secure flag — expected in dev; env.NODE_ENV !== 'production')

=== 11. Tampered/corrupted session cookie is rejected ===
status=307 redirect=http://localhost:3000/login?from=%2Fdashboard

=== 12. Malformed JSON body -> 422, not a crash ===
{"error":"invalid_request"}
status=422
```

Automated coverage added afterward, all passing:

- `lib/auth/__tests__/session.test.ts` — round-trip; tampered signature rejected; tampered
  body rejected (signature no longer matches); expired-but-correctly-signed token rejected
  (signed with the same `env.SESSION_SECRET` the module itself uses, so this genuinely
  tests expiry, not an accidental signature mismatch); malformed/empty/undefined input
  rejected.
- `lib/auth/__tests__/login.test.ts` — correct credentials succeed; correct email + wrong
  password fails; a second real, active `User` document with the _correct_ password still
  fails because its email isn't `SUPER_ADMIN_EMAIL` (proves `DECISIONS.md` 013's gate is
  real, not just documented); unknown email fails; email match is case-insensitive.

Not yet tested: session expiry over real wall-clock time (only tested via a
pre-constructed expired token, not by waiting 8 hours); concurrent-login behavior (not
applicable yet — one static account, no session list to reason about).

## 10. Rollback

Per the Active plan filled into `ROLLBACK.md` before this phase started: all changes are
additive (new files) except `.env.example` and `lib/env.ts` (both additive edits). No git
baseline exists to revert to (carried forward, unchanged, from Phase 0/1 — `DECISIONS.md` 010) — recovery is hand-delete of the listed new files plus reverting the two additive
edits. No data migration involved; `SUPER_ADMIN_PASSWORD_HASH` in the seeded `User` document
can simply be re-seeded with the Phase 1 placeholder if needed.

## 11. Follow-ups

- **No server-side session revocation exists.** Rotating `SESSION_SECRET` invalidates every
  session at once; there's no way to revoke a single one. Acceptable for one static admin
  account (`DECISIONS.md` 012); revisit if/when multi-user auth lands.
- **`SUPER_ADMIN_EMAIL` gate in `lib/auth/login.ts` is the single point to remove** when
  real multi-user internal login and RBAC are eventually built — `DECISIONS.md` 013 names
  it explicitly so it isn't rediscovered by grepping.
- Git baseline still doesn't exist, now three phases deep. Raised again, not resolved.
- The Vitest "unsupported by `configLoader: 'native'`" warning (noted since Phase 0)
  persists, still harmless.
