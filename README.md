# MV-VRA

MoneyView Vendor Risk Assessment — a centralized system of record for third-party vendor
risk. Read `CLAUDE.md` and `docs/PLAN.md` before working in this repo; both are load-bearing,
not background reading.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                                          | Purpose                                                                                            |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`                                   | Local dev server                                                                                   |
| `npm run verify`                                | format check + lint + typecheck + test + build — the Gate 0–3 bundle from `docs/TEST-CHECKLIST.md` |
| `npm run format` / `format:check`               | Prettier                                                                                           |
| `npm run lint`                                  | ESLint                                                                                             |
| `npm run typecheck`                             | `next typegen` (route types) then `tsc --noEmit`                                                   |
| `npm run test` / `test:watch` / `test:coverage` | Vitest                                                                                             |

## Where things stand

This is Phase 0 of `docs/PLAN.md` — scaffold and guardrails only. No feature described in
`VRA MVP Feature Specification.md` is implemented yet. See `docs/HANDOVER.md` for current
state and `docs/ARCHITECTURE.md` for the target design.
