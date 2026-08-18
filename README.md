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

## Scripts

| Script                                          | Purpose                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                   | Local dev server                                                                                                                                  |
| `npm run verify`                                | format check + lint + typecheck + test + build — the Gate 0–3 bundle from `docs/TEST-CHECKLIST.md`                                                |
| `npm run format` / `format:check`               | Prettier                                                                                                                                          |
| `npm run lint`                                  | ESLint                                                                                                                                            |
| `npm run typecheck`                             | `next typegen` (route types) then `tsc --noEmit`                                                                                                  |
| `npm run test` / `test:watch` / `test:coverage` | Vitest                                                                                                                                            |
| `npm run db:indexes`                            | Build MongoDB indexes                                                                                                                             |
| `npm run db:seed`                               | Bootstrap workspace, super-admin user, mitigation-guidance library — required on every fresh env                                                  |
| `npm run db:seed-questionnaire`                 | Import `docs/questionnaires/wfpl-vendor-risk-assessment-v2.0.csv` as a published template. Idempotent — safe to re-run, skips if already present. |
| `npm run db:seed-demo`                          | Optional: 12-vendor demo dataset for visually exercising dashboards/charts, not required to run the app                                           |
| `npm run hash-password -- '<password>'`         | Generate an argon2 hash for `SUPER_ADMIN_PASSWORD_HASH`                                                                                           |
| `npm run sweep:evidence`                        | Ops: report/remove orphaned evidence files (dry-run by default, `-- --delete` to act)                                                             |

## Where things stand

MVP Phases 0–11 and two post-MVP UI revamp rounds are complete — see `docs/HANDOVER.md` for
current state (updated every session, read it first) and `docs/ARCHITECTURE.md` for the
system map.
