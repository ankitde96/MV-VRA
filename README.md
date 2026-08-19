# MV-VRA

MoneyView Vendor Risk Assessment — a centralized system of record for third-party vendor
risk. Read `CLAUDE.md` and `docs/PLAN.md` before working in this repo; both are load-bearing,
not background reading.

## Getting started

Requires a local MongoDB **replica set** (not standalone — see `DECISIONS.md` 014), running
on `MONGODB_URI` from `.env.local`.

```bash
npm install
cp .env.example .env.local
npm run db:indexes             # build indexes
npm run db:seed                # workspace, super-admin user, mitigation-guidance library
npm run db:seed-questionnaire  # WFPL Vendor Risk Assessment Questionnaire v2.0 (published template)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development logins

`npm run db:seed` creates or refreshes these local-development accounts. Their password is
always `admin` in the development environment so a newly seeded environment is immediately
usable. These credentials are development-only.

| User                                 | Password | Access                                                |
| ------------------------------------ | -------- | ----------------------------------------------------- |
| `admin@mv-vra.local`                 | `admin`  | Super Admin (all workspaces and workspace management) |
| `analyst@mv-vra.local`               | `admin`  | Risk Analyst                                          |
| `business-owner@mv-vra.local`        | `admin`  | Business Owner                                        |
| `multi-workspace-admin@mv-vra.local` | `admin`  | Admin in the default and beta workspaces              |
| `vendor@mv-vra.local`                | `123456` | Vendor portal (`6a841ef950d13373304dd55f`)            |

If `SUPER_ADMIN_EMAIL` is overridden in `.env.local`, that email replaces
`admin@mv-vra.local`. Production uses `SUPER_ADMIN_PASSWORD_HASH`; the fixed development
password is never used there.

For the vendor portal, enter the vendor username on `/portal/login`, choose **Send code**,
then enter the documented password as the verification code. The static vendor credential
is accepted only in development; other environments continue to require a generated OTP.

## Scripts

| Script                                          | Purpose                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                   | Local dev server                                                                                                                                                                                                                                          |
| `npm run verify`                                | format check + lint + typecheck + test + build — the Gate 0–3 bundle from `docs/TEST-CHECKLIST.md`                                                                                                                                                        |
| `npm run format` / `format:check`               | Prettier                                                                                                                                                                                                                                                  |
| `npm run lint`                                  | ESLint                                                                                                                                                                                                                                                    |
| `npm run typecheck`                             | `next typegen` (route types) then `tsc --noEmit`                                                                                                                                                                                                          |
| `npm run test` / `test:watch` / `test:coverage` | Vitest                                                                                                                                                                                                                                                    |
| `npm run test:e2e` / `test:e2e:ui`              | Playwright browser journeys in desktop Chromium and a Pixel 7 viewport; requires seeded development data                                                                                                                                                  |
| `npm run db:indexes`                            | Build MongoDB indexes                                                                                                                                                                                                                                     |
| `npm run db:seed`                               | Bootstrap workspace, super-admin user, mitigation-guidance library — required on every fresh env                                                                                                                                                          |
| `npm run db:seed-questionnaire`                 | Import `docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv` as a published template. Idempotent — safe to re-run, skips if already present.                                                                                                         |
| `npm run db:seed-demo`                          | Optional: 12-vendor demo dataset for visually exercising dashboards/charts, not required to run the app                                                                                                                                                   |
| `npm run hash-password -- '<password>'`         | Generate an argon2 hash for `SUPER_ADMIN_PASSWORD_HASH`                                                                                                                                                                                                   |
| `npm run sweep:evidence`                        | Ops: report/remove orphaned evidence files (dry-run by default, `-- --delete` to act)                                                                                                                                                                     |
| `npm run migrate:vendor-spocs`                  | One-time: backfill `Vendor.spocs[]` from the legacy single-SPOC field for vendors created before the multi-SPOC change. Idempotent, safe to re-run. Not needed on a fresh environment — `npm run db:seed`/vendor intake already write `spocs[]` directly. |

## Where things stand

MVP Phases 0–11 and two post-MVP UI revamp rounds are complete — see `docs/HANDOVER.md` for
current state (updated every session, read it first) and `docs/ARCHITECTURE.md` for the
system map.

## Browser tests

The browser suite expects the development fixtures documented above. On a fresh database:

```bash
npm run db:seed
npm run db:seed-questionnaire
npx playwright install chromium
npm run test:e2e
```

Playwright starts `npm run dev` automatically unless an existing local server is already
available. Failure traces, screenshots, and videos are written under ignored test-artifact
directories; no test mutates or deletes application records.
