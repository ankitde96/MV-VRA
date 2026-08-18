# Feature: Assessment assignment and OTP portal auth

|                    |                                               |
| ------------------ | --------------------------------------------- |
| **Status**         | done                                          |
| **Owner**          | Project owner (solo)                          |
| **Started**        | 2026-08-14                                    |
| **Spec reference** | `VRA MVP Feature Specification.md` §1.2, §2.2 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)           |

## 1. Scope

PLAN.md Phase 6, FLOW.md F2 (in full) and F3 steps 1–2 — explicitly the highest-risk
surface in the system: externally reachable, and it guards another company's data.

1. **Assessment assignment** — assign a `published` template version to an engagement,
   creating an `Assessment` with a deep-cloned `template_snapshot`, atomically moving the
   engagement to `in_assessment`.
2. **OTP request** — enumeration-resistant (identical response body, best-effort
   comparable timing) whether or not the email matches a vendor SPOC.
3. **OTP storage and verification** — HMAC-hashed codes, explicit expiry check (not just
   the TTL sweep), attempt limit, single-use consumption, constant-time hash comparison.
4. **Portal session** — a structurally separate session type from the internal one (own
   cookie, own signing secret, own module), scoped to exactly one `vendor_id`, re-derived
   from the session on every portal request.
5. **Rate limiting** — per-email and per-IP, on the OTP request endpoint.
6. **Mailer abstraction** — one interface, console transport in dev.

Does **not** include: answering questionnaires, uploading evidence, or submitting an
assessment (all Phase 7); a real transactional email provider (still an open question,
`ARCHITECTURE.md` §7); a shared/multi-instance rate-limit store (Phase 12, if ever needed).

## 2. Why

Spec §1.2: Vendor SPOC authenticates via Email OTP. Spec §2.2: "a secure vendor portal
where the Vendor SPOC authenticates via Email OTP." `PLAN.md` calls this phase out by name
as the highest-risk surface — the only externally-reachable one, and the one guarding
another company's data — with an exit criterion naming six specific attack classes.

## 3. Plan (written before implementing — habit 11)

Read `PLAN.md` Phase 6, `DATA-MODEL.md`'s `otp_challenges`/`assessments` sections, and
`FLOW.md` F2's three named gaps before writing anything. Filled `ROLLBACK.md`'s Active plan
first (auth phase, `CONSTRAINTS.md` #2). No decision in this phase needed a stop-and-ask —
every open point (OTP constants, rate-limit numbers, portal session TTL, assessment status
on assignment, in-memory vs. shared rate-limit store) is a tunable/correctable assumption,
not a scope or architecture choice, so all five are recorded in `DECISIONS.md` 019 rather
than asked about, consistent with how prior phases handled similarly unspecified numbers.

Build order: crypto/rate-limit primitives first (pure functions, unit-testable in
isolation) → the portal session module (deliberately not a generic reuse of the internal
session signer — a structurally separate module is the strongest version of `FLOW.md` F2
gap (b)'s guarantee) → the OTP data-access module and service → `proxy.ts`'s second,
independent branch → the assignment repository/service → API routes → pages.

## 4. Flow impact

`FLOW.md` F2 is now ✅ BUILT in full, with all three named gaps (enumeration, scope
source, replay) resolved and file-referenced. `FLOW.md` F3 steps 1–2 (assignment) are now
✅ BUILT; steps 3–8 (portal rendering through submission) remain Phase 7.

## 5. Data model impact

None — `otp_challenges` and `assessments` already existed from Phase 1 with the exact
shape this phase needed. No schema change, no migration. `lib/repositories/base.ts`'s
`updateOne()` gained an optional `session` parameter (mirroring `create()`'s existing one)
so `assignAssessment()` could update the engagement's status inside the same transaction
that creates the assessment — a small, backward-compatible addition, not a schema change.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Files                                                                                             | Model                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Read `PLAN.md` Phase 6, `DATA-MODEL.md`, `FLOW.md` F2; filled `ROLLBACK.md`'s Active plan. Built `lib/mail/` (console transport), `lib/auth/otp.ts` + `rate-limit.ts` (unit-tested first), `lib/auth/portal-session*.ts` + `current-portal-session.ts`, `lib/auth/otp-challenge.ts`, `lib/services/portal-auth.ts`, extended `lib/repositories/base.ts`'s `updateOne()` with a session param, `lib/repositories/assessment-repository.ts`, `lib/services/assessment-assignment.ts`, five API routes, `proxy.ts`'s second fail-closed branch, the portal pages/components, and the vendor-detail-page assignment UI. Ran `npm run verify` clean. Verified the entire OTP lifecycle and every Gate 4 attack class by real HTTP request against a running dev server, plus a second vendor to prove scope isolation empirically rather than by inspection. Cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH` afterward. | See `ROLLBACK.md`'s Active plan (filled before this phase, cleared after) for the full file list. | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

Nothing abandoned. `npm run build` failed once mid-session with "OTP_HMAC_SECRET is
required in production" — `next build` runs with `NODE_ENV=production` regardless of
target environment, and `.env.local` didn't yet have a dev value for the new variable
(only `SESSION_SECRET` had one from Phase 2). Fixed by adding a `OTP_HMAC_SECRET` dev value
to `.env.local`, the same way `SESSION_SECRET` already was — not a code bug, a missing
local-environment value for a newly-added required-in-prod variable.

## 8. Decisions logged

`DECISIONS.md` 019 — OTP constants, timing-mitigation honesty, in-memory rate limiting,
assessment status on assignment, structurally separate portal session.

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
 Test Files  18 passed (18)
      Tests  110 passed (110)
...
✓ Compiled successfully in 1265ms
...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/portal/auth/logout
├ ƒ /api/portal/auth/otp/request
├ ƒ /api/portal/auth/otp/verify
├ ƒ /api/templates
├ ƒ /api/templates/[id]
├ ƒ /api/templates/[id]/archive
├ ƒ /api/templates/[id]/new-version
├ ƒ /api/templates/[id]/publish
├ ƒ /api/vendors
├ ƒ /api/vendors/[id]/assessments
├ ƒ /api/vendors/[id]/documents
├ ƒ /api/vendors/[id]/documents/[documentId]
├ ƒ /api/vendors/[id]/spoc
├ ƒ /dashboard
├ ○ /login
├ ƒ /portal
├ ○ /portal/login
├ ƒ /templates
├ ƒ /templates/[id]
├ ○ /templates/new
├ ƒ /vendors
├ ƒ /vendors/[id]
└ ○ /vendors/new
```

**Gate 4 in full + Gate 6, by real HTTP request against a running dev server**, using the
same temporary-password-then-restore pattern as prior phases:

```
$ curl -X POST /api/auth/login ...                                     → 200
$ curl -X POST /api/vendors (intake) ...                                → 201, vendor + engagement
$ curl -X POST /api/templates ... ; POST .../publish                    → 200, published template
$ curl -X POST /api/vendors/<id>/assessments {engagement_id,template_id} → 201, status "sent"
$ curl /vendors/<id>                                                    → 200, shows "Awaiting response"

$ curl /portal (no cookie)                                              → 307 -> /portal/login
$ curl -X POST /api/portal/auth/otp/request {email: <real spoc>}         → 200 {"ok":true}
$ curl -X POST /api/portal/auth/otp/request {email: <nonexistent>}       → 200 {"ok":true}
$ diff <real response> <fake response>                                  → IDENTICAL

$ curl -X POST /api/portal/auth/otp/verify {code: "000000"}              → 401 unauthorized
$ curl -X POST /api/portal/auth/otp/verify {code: <real, from console log>} → 200, cookie set
$ curl -X POST /api/portal/auth/otp/verify {code: <same code again>}     → 401 (replay refused)

$ curl -X POST .../otp/request  (5x, same email)                        → 200,200,200,200,429 (email cap)
$ curl -X POST .../otp/request  (20x, same IP, 20 different emails)      → 200 x20, then 429 (IP cap)

$ (wrong code x5) then (correct code)                                   → 401 x5, then 401 (locked out)

$ curl -b <internal cookie> /portal                                      → 307 (internal cookie rejected)
$ curl -b <portal cookie> /dashboard                                     → 307 (portal cookie rejected)

$ (second vendor + assessment created)
$ curl -b <vendor-1 portal cookie> /portal                                → shows exactly 1 assessment (its own)

$ curl -X POST /api/portal/auth/logout                                   → 200, cookie cleared
$ curl -b <cleared cookie> /portal                                        → 307 -> /portal/login
```

All ran clean; smoke-test vendors, engagements, assessments, the template, OTP challenges,
and audit events were deleted afterward (`mongosh`), and `SUPER_ADMIN_PASSWORD_HASH` was
restored to its real value and re-seeded.

**Not run:** nothing in Gate 4/6 relevant to this phase was skipped. Answering/uploading
within the portal is Phase 7 and has nothing to verify yet.

## 10. Rollback

Active plan filled in `ROLLBACK.md` before starting. Every new file can be deleted
outright; the only edits to existing files (`proxy.ts`, `lib/env.ts`,
`lib/repositories/base.ts`, `app/(internal)/vendors/[id]/page.tsx`) are additive. No git
baseline exists in this repo yet (`DECISIONS.md` 010, still deferred).

## 11. Follow-ups

- **The in-memory rate limiter must be replaced before any multi-instance deployment** —
  it silently stops being effective the moment there's more than one server process
  (`DECISIONS.md` 019).
- **The timing mitigation is best-effort, not cryptographic** — call this out explicitly
  to any future security reviewer rather than letting it be assumed stronger than it is.
- Phase 7 will build the portal's questionnaire renderer, reusing
  `components/questionnaire/question-renderer.tsx` (Phase 5) — the shared-module guarantee
  this was built for is now exercised on both sides.
- No API-route-level cross-workspace test exists yet for `/api/vendors/[id]/assessments`,
  matching the same still-open gap already noted for other internal routes.
- Which real transactional email provider replaces the console transport remains an open
  question (`ARCHITECTURE.md` §7) — `MAIL_PROVIDER` only accepts `'console'` today.
