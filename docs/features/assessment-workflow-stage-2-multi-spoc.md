# Feature: Assessment workflow Stage 2 — multiple Vendor SPOCs

> `ASSESSMENT-WORKFLOW-PLAN.md` Stage 2. Guide habit 5. ⚠ Auth-touching (`CONSTRAINTS.md` #2).

|                    |                                                                  |
| ------------------ | ---------------------------------------------------------------- |
| **Status**         | done                                                             |
| **Owner**          | Project owner                                                    |
| **Started**        | 2026-08-19                                                       |
| **Spec reference** | `ASSESSMENT-WORKFLOW-PLAN.md` §4 Stage 2, `DECISIONS.md` 040/042 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)                              |

## 1. Scope

A vendor may now have more than one Vendor SPOC. `Vendor.spocs[]` (additive) replaces the
single embedded `spoc` object as the source of truth for portal OTP login, CAP-escalation
contact, and (going forward) questionnaire recipients. Each entry has its own active/inactive
status and exactly one is primary at any time. The legacy `spoc` field is left in place,
unread by anything new. A SPOC is deactivated, never hard-deleted — no `DELETE` route exists.

## 2. Why

Requirement #4: "In the vendor page there should be option for adding multiple vendor SPOC."
The single embedded SPOC was also what portal OTP login resolved against
(`lib/auth/otp-challenge.ts`), so this was flagged auth-touching from the plan stage.

## 3. Plan (written before implementing — habit 11)

D2 (`DECISIONS.md` 040): full replacement rather than an `additional_contacts[]` bolt-on, to
avoid two permanent parallel notions of "SPOC." D8: the portal session gains `spocId` in this
stage, ahead of its first reader (Stage 4), so every auth-touching change in the revamp lives
in one isolated, separately-rolled-back stage. Two implementation choices made during, not
before, coding (`DECISIONS.md` 042): no hard-delete (Stage 4 will reference SPOC ids from
`Assessment.recipients[]`, so a delete would leave a dangling reference), and deactivating the
primary is refused outright rather than auto-reassigning.

## 4. Flow impact

`FLOW.md` F2 (Vendor SPOC authentication) rewritten in place — see its own diff. Steps 2–4
now resolve against `spocs[]`, store the matched `spoc_id` on the OTP challenge, and
re-verify that SPOC is still active at verify time (a genuinely new gap this stage closes,
not present in the original F2: nothing before this stage checked whether the vendor-level
match was still valid by the time the code was entered). Step 5's session payload gains
`spocId`, unread by anything until Stage 4.

## 5. Data model impact

- `Vendor.spocs[]` (additive): `{ _id, name, email, phone, is_primary, status }[]`. Index
  `{ "spocs.email": 1 }` added, same deliberate non-workspace-prefixed exception as the
  legacy `{ "spoc.spoc_email": 1 }` index (kept, unwritten by anything new).
- `OtpChallenge.spoc_id` (additive, nullable): the matched SPOC at request time.
- `PortalSessionPayload.spocId` (new required field on the signed token payload — not a
  database field, but a breaking payload-shape change for any pre-existing portal cookie).
- No field was repurposed and nothing was deleted (`CONSTRAINTS.md` #3, `DATA-MODEL.md` §6).

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Model                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-19 | Filled `ROLLBACK.md`'s Active plan before starting (auth-touching). Added `spocs[]`/`spoc_id` to the schema; rewrote OTP lookup, request, and verify to resolve/scope against it, including a new verify-time re-check of active status; added `spocId` to the portal session payload. Rewrote the vendor-repository SPOC methods and `lib/services/vendor-spoc.ts`; retired the single-object SPOC route and added `POST /api/vendors/[id]/spocs` + `PATCH /api/vendors/[id]/spocs/[spocId]`. Rewrote `components/spoc-edit-form.tsx` as a list UI (add/edit/deactivate/reactivate/make-primary). Updated vendor intake, the CAP-escalation email lookup, the vendors table's SPOC column, both seed scripts, and added `scripts/migrate-vendor-spocs.ts`. Extended `lib/services/__tests__/{portal-auth,portal-assessment,assessment-review}.test.ts`. Found and fixed a real Mongoose 9 bug during real-HTTP verification (see §7). Ran the full gate suite plus an extensive real-HTTP walkthrough against real dev data. | `lib/db/models/{vendor,otp-challenge}.ts`, `lib/auth/{otp-challenge,portal-session}.ts`, `lib/services/{portal-auth,vendor-spoc,vendor-intake,assessment-review}.ts`, `lib/repositories/vendor-repository.ts`, `app/api/vendors/[id]/spoc/route.ts` (deleted), `app/api/vendors/[id]/spocs/route.ts` (new), `app/api/vendors/[id]/spocs/[spocId]/route.ts` (new), `components/spoc-edit-form.tsx`, `components/vendors/vendors-table.tsx`, `app/(internal)/vendors/page.tsx`, `app/(internal)/vendors/[id]/page.tsx`, `scripts/{seed,seed-demo-data,migrate-vendor-spocs}.ts` (last is new), `package.json`, `README.md`, three test files, `docs/{DATA-MODEL,FLOW,ROLLBACK,TEST-CHECKLIST,DECISIONS}.md` | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

**A real bug, found by real-HTTP verification, not by the automated test suite.**
`VendorRepository.setPrimarySpoc()` uses an aggregation-pipeline-array `updateOne()` (a
`$map`/`$mergeObjects` stage) so that "exactly one primary" is atomic — no window where a
concurrent read could see zero or two primaries, which two sequential `$set`s would have
had. `npm run test` passed with this code (no test exercised `setPrimarySpoc()` yet, since
it was newly added this stage with no unit coverage written for the repository method in
isolation). The first real HTTP request against it — `PATCH .../spocs/[id]` with
`{"make_primary": true}` — returned a `500`:

```
MongooseError: Cannot pass an array to query updates unless the `updatePipeline` option is set.
```

Mongoose 9 requires `{ updatePipeline: true }` explicitly before it accepts an array as the
update argument; a prior Mongoose major did not require this. Fixed by adding that option.
Re-verified with the same request, then confirmed by direct database read that exactly one
`spocs[].is_primary` was `true` afterward. This is the exact discipline `HANDOVER.md`
already credits with catching two real bugs in UI Revamp Round 2 that typecheck/lint/tests
did not — logged here so the next session writing a pipeline-form Mongoose 9 update knows
to reach for `updatePipeline` immediately rather than rediscovering this.

## 8. Decisions logged

`DECISIONS.md` 040 (D2, D8 — decided before this stage started) and 042 (the three
implementation-time choices plus the bug above, decided during this stage).

## 9. Verification

**`npm run verify` components, actual output:**

- `format:check` — `All matched files use Prettier code style!`
- `lint` — 0 errors, 1 pre-existing TanStack advisory.
- `typecheck` — clean (`.next` cache cleared and `next typegen` re-run after deleting the
  retired `app/api/vendors/[id]/spoc/route.ts`, since the route-types generator otherwise
  kept a stale reference to it).
- `test` — `Test Files 29 passed (29)`, `Tests 212 passed (212)` (209 from Stage 1 + 3 net
  new). Two transient failures were hit and diagnosed, not silently retried: one in
  `assessment-review.test.ts` was a **real** gap in that test's own vendor fixture (it never
  set `spocs[]`, so the CAP-escalation email lookup this stage changed correctly returned
  `null` — fixed by adding `spocs[]` to the fixture, not by reverting the production code);
  the other two (`sharing.test.ts`, then later `portal-assessment.test.ts`) each reproduced
  as a pre-existing cross-file local-fs storage race — confirmed by passing in isolation and
  by a clean full-suite re-run, not a regression introduced by this stage.
- `build` — same disposable-secret pattern as Stage 1; completed with the new
  `/api/vendors/[id]/spocs` and `/spocs/[spocId]` routes in the manifest and no
  `/api/vendors/[id]/spoc` remaining.

**Real HTTP request against `npm run dev`**, using real (not disposable) dev data:

- Ran `npm run db:indexes` (new `{ "spocs.email": 1 }` index applied) and `npm run db:seed`
  (idempotently populated the dev vendor's `spocs[]`, since it started empty).
- Ran `npm run migrate:vendor-spocs` against the real local database: backfilled one
  genuinely pre-existing vendor (`nithin.r@jify.com`, not a test fixture), then re-ran it and
  confirmed `No vendors need a spocs[] backfill.`
- Logged in as the dev vendor's **primary** SPOC via the deterministic dev-bypass credential,
  and separately as its **secondary** SPOC via a real OTP — read the code from the console
  mailer log rather than any shortcut — confirming both produce independently-scoped
  sessions and both can load `/portal`.
- As the internal admin: added a third SPOC (`201`); confirmed deactivating the primary is
  refused (`422`, the exact message); deactivated the secondary and third SPOC in turn
  (`200` each, since two remained active each time); confirmed deactivating the primary once
  it was the _only_ active SPOC left is still refused (`422`, same message — the primary
  check short-circuits before the count check, which is fine, either reason is sufficient);
  confirmed a deactivated SPOC's OTP request returns the byte-identical `{"ok":true}` with
  **zero** real challenges written (`otpchallenges` count query = 0); reactivated it, made it
  primary (this is where the Mongoose bug in §7 was caught and fixed), and confirmed by direct
  database read that exactly one `spocs[].is_primary` was `true`.
- Loaded `/vendors` and confirmed the SPOC column shows the primary email plus a `+2` count
  chip; loaded `/vendors/[id]` and confirmed all three SPOCs render with exactly one
  "Primary" badge and the add/edit/deactivate/make-primary controls present.
- Restored the dev vendor to its documented two-SPOC seed state afterward (primary back to
  `vendor@mv-vra.local`, the third SPOC reactivated) so `README.md`'s development-login table
  stays accurate for the next session.

**Not run:** `npm run test:e2e` — same sandbox TLS-interception limitation as Stage 1, not a
regression; see that stage's trace and `HANDOVER.md`.

## 10. Rollback

Safe baseline: `137031b` (Stage 1's commit). See `ROLLBACK.md`'s Active plan for the full
file list and what to re-check. No destructive writes; the one real bug found (§7) was fixed
and re-verified, not rolled back.

## 11. Follow-ups

- The legacy `Vendor.spoc` field and its index remain, deliberately unwritten by anything new
  — dropping them is a separate later decision (`ASSESSMENT-WORKFLOW-PLAN.md` §7).
- No unit test exists for `VendorRepository.setPrimarySpoc()` in isolation — the bug in §7
  was caught by real-HTTP verification, not a unit test. Worth adding one before this method
  is touched again, given Mongoose's pipeline-update requirement is easy to reintroduce
  accidentally in a similar method later.
- Stage 3 (draft assessments and per-vendor checklist editing) is next, and does not depend
  on this stage.
