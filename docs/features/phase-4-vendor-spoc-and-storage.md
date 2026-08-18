# Feature: Vendor SPOC management and the storage module

|                    |                                               |
| ------------------ | --------------------------------------------- |
| **Status**         | done                                          |
| **Owner**          | Project owner (solo)                          |
| **Started**        | 2026-08-14                                    |
| **Spec reference** | `VRA MVP Feature Specification.md` §2.1, §1.1 |
| **Models used**    | Claude Sonnet 5 (`claude-sonnet-5`)           |

## 1. Scope

Two capabilities, both PLAN.md Phase 4:

1. **Vendor SPOC management** — edit the vendor SPOC (name, email, phone) from the vendor
   detail page. The `spoc` subdocument itself already existed on `Vendor` (Phase 1/3); this
   phase adds the first write path and the detail page it lives on.
2. **Storage abstraction** — one interface (`lib/storage`), a `local-fs` driver for dev and
   an `S3` driver for prod, selected by `STORAGE_DRIVER`. Uploads enforce a MIME allow-list
   and a 10MB size cap. Reads go through an authorised proxy route; a raw storage key alone
   is never enough to retrieve a file.

Does **not** include: the S3 driver being configured or exercised against real AWS
(explicitly deferred to Phase 12); per-response evidence upload (`evidence_file_url`,
Phase 7); anything on the vendor portal (Phase 6+).

## 2. Why

Spec §2.1: "Ability to add and manage a Vendor SPOC ... within the vendor details page,"
since the SPOC is the person who will receive the Email OTP once the portal exists
(Phase 6). Spec §1.1: evidence storage must work identically in dev (local filesystem) and
prod (S3) so feature code never branches on environment (`CONSTRAINTS.md` #10). Both land
together because Phase 4's storage exit criteria needed a real upload/retrieve/authorize
target, and the vendor detail page being built in this phase was the natural one.

## 3. Plan (written before implementing — habit 11)

Presented to the project owner before writing code, with two open decisions surfaced via
`AskUserQuestion` rather than assumed:

- **New dependency:** `@aws-sdk/client-s3` for the (unconfigured) S3 driver — approved.
- **Document metadata location:** an embedded `documents` array on `Vendor` vs. a new
  top-level collection — the project owner chose the embedded array. Recorded as
  `DECISIONS.md` 017 along with the MIME allow-list/size-cap assumption.

Plan, once decided: extend the `Vendor` schema; add `VendorRepository.updateSpoc()` /
`addDocument()`; build `lib/storage` (types/local-fs/s3/index); build
`lib/services/vendor-spoc.ts` and `lib/services/vendor-documents.ts`; add the PATCH spoc
route, POST/GET document routes; build the vendor detail page and its two client-form
components; wire the vendors list to link to it.

## 4. Flow impact

None of `FLOW.md`'s six lettered flows (F1–F6) — SPOC management and the storage module
are supporting capabilities Phase 6/7 will build on, not one of the six numbered execution
paths. No `FLOW.md` change made.

## 5. Data model impact

Adds `documents: [{ key, filename, mime, size, uploaded_by, uploaded_at }]` to the `Vendor`
schema (`lib/db/models/vendor.ts`) — additive, no migration needed since Mongoose treats a
missing array field as absent. Not in the original `DATA-MODEL.md` §2; recorded as
`DECISIONS.md` 017 rather than silently added. No other schema change.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Files                                                            | Model                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| 2026-08-14 | Read `HANDOVER.md`/`CONSTRAINTS.md`/`PLAN.md`/`DATA-MODEL.md`; surfaced the two open decisions via `AskUserQuestion`; filled `ROLLBACK.md`'s Active plan; installed `@aws-sdk/client-s3`; built the storage module, both services, three API routes, the vendor detail page, and its two form components; wrote unit/integration tests; ran `npm run verify` clean; verified by real HTTP request against a running dev server (SPOC edit, upload, download, 401 unauthenticated, 404 wrong document, MIME rejection); cleaned up smoke-test data and restored the real `SUPER_ADMIN_PASSWORD_HASH`. | See §5/§6 of `ROLLBACK.md`'s Active plan for the full file list. | Claude Sonnet 5 (`claude-sonnet-5`) |

## 7. What didn't work

Nothing abandoned this phase. One correction mid-build: the first draft of
`uploadVendorDocument` didn't generate the subdocument's `_id` explicitly, relying on
Mongoose's update-path casting to generate one — but `Model.updateOne({$push: ...})`
doesn't return the written document, so the caller (the API route, which needs the id to
respond with) had no way to get it back. Fixed by generating `_id: new Types.ObjectId()`
in the service before the `$push`, so the same value is known to the caller and the
persisted document.

## 8. Decisions logged

`DECISIONS.md` 017 — S3 SDK dependency, `documents` array modeling, MIME/size limits.

## 9. Verification

**Gate 1 (static checks) + Gate 2 (unit tests) + Gate 3 (build) — via `npm run verify`:**

```
$ npm run verify
...
Checking formatting...
All matched files use Prettier code style!
...
✓ Types generated successfully
...
 Test Files  11 passed (11)
      Tests  62 passed (62)
...
✓ Compiled successfully in 885ms
...
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/vendors
├ ƒ /api/vendors/[id]/documents
├ ƒ /api/vendors/[id]/documents/[documentId]
├ ƒ /api/vendors/[id]/spoc
├ ƒ /dashboard
├ ○ /login
├ ƒ /vendors
├ ƒ /vendors/[id]
└ ○ /vendors/new
```

**Gate 4 (security — evidence file access) + Gate 6 (manual smoke), by real HTTP request
against a running dev server**, using a temporary password hash for the smoke test (the
same pattern as Phase 3 — restored the real hash via `npm run db:seed` afterward):

```
$ curl -X POST /api/auth/login ...                     → 200 {"ok":true}
$ curl -X POST /api/vendors ...                         → 201 (vendor created, tier 1)
$ curl /vendors/<id>                                    → 200, page shows "Original Spoc"
$ curl -X PATCH /api/vendors/<id>/spoc ...               → 200, spoc updated
$ curl /vendors/<id>                                    → 200, page now shows "Updated Spoc"
$ curl -X POST /api/vendors/<id>/documents -F file=@evidence.pdf → 201, document id returned
$ curl /api/vendors/<id>/documents/<docId>               → 200, byte-identical to uploaded file
$ curl /api/vendors/<id>/documents/<docId>  (no cookie)  → 401
$ curl /api/vendors/<id>/documents/000000000000000000000000 → 404
$ curl -X POST .../documents -F file=@bad.exe (x-msdownload) → 422 validation_error
$ find .storage-local -type f
.storage-local/<workspace_id>/<vendor_id>/<uuid>-evidence.pdf
```

All ran clean; smoke-test vendor/engagement/audit-event documents and the local-fs file
were deleted afterward (`mongosh` + `rm -rf .storage-local`), and
`SUPER_ADMIN_PASSWORD_HASH` was restored to its real value and re-seeded.

**Not run:** Gate 5 (no template/archive code exists yet — not applicable).

## 10. Rollback

Active plan filled in `ROLLBACK.md` before starting; no git baseline exists in this repo
yet (`DECISIONS.md` 010, still deferred), so revert means restoring the specific files
listed there by hand, not a git operation.

## 11. Follow-ups

- Phase 7 will need to decide whether per-response evidence upload reuses
  `Vendor.documents`, extends it, or models response evidence separately — don't assume
  today's shape survives (`DECISIONS.md` 017, Consequences).
- Phase 12 must set `AWS_S3_BUCKET`/`AWS_REGION` and flip `STORAGE_DRIVER=s3`, and confirm
  S3 object versioning is enabled first (`ROLLBACK.md`).
- No API route yet exercises cross-workspace isolation for the SPOC PATCH route the way
  `vendor-documents.test.ts` does for documents — worth adding if Phase 6+ reuses this
  pattern under real multi-tenant load.
