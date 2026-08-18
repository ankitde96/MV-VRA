# Feature: Phase 0 — Baseline and guardrails

|                    |                                     |
| ------------------ | ----------------------------------- |
| **Status**         | done                                |
| **Owner**          | project owner + AI                  |
| **Started**        | 2026-08-13                          |
| **Spec reference** | `docs/PLAN.md` §3, Phase 0          |
| **Models used**    | Claude Opus 5 (`claude-opus-5[1m]`) |

## 1. Scope

Scaffold the Next.js application, its tooling, and its documentation contract. No feature
from `VRA MVP Feature Specification.md` is implemented. What this phase delivers: a
TypeScript App Router project, Tailwind + shadcn/ui wired to the tokens in
`docs/DESIGN-SYSTEM.md`, a Zod-validated env module, ESLint/Prettier/Vitest, and a
`npm run verify` command that proves all of it works together. Explicitly not in scope:
MongoDB/Mongoose (Phase 1), any authentication (Phase 2), any feature route.

## 2. Why

`docs/ROLLBACK.md` and `docs/HANDOVER.md` both recorded that no application code existed.
Every later phase in `docs/PLAN.md` depends on this scaffold being in place and provably
working, per `npm run verify`.

## 3. Plan (written before implementing)

Per `docs/PLAN.md` Phase 0, step by step: scaffold Next.js (TS, App Router, Tailwind) →
`shadcn init` + pull the component inventory from `docs/DESIGN-SYSTEM.md` §4 → apply the
design tokens from §3 to `globals.css` → Zod env schema → ESLint/Prettier/Vitest → wire
`npm run verify` → replace the `[PLACEHOLDER]` gates in `docs/TEST-CHECKLIST.md`.

**Deviation from the plan, agreed with the project owner mid-session:** step 1 of Phase 0
("`git add -A && git commit` — establish the baseline") was explicitly deferred. The
project owner stated git setup will happen later and asked to proceed with scaffolding
without it. This means **`docs/ROLLBACK.md`'s "no rollback point exists" warning is still
in effect** — nothing in this phase is committed, and any accidental overwrite right now
is unrecoverable. Flagged here and in `docs/HANDOVER.md` rather than silently working
around it.

## 4. Flow impact

None. No `FLOW.md` path is created or touched by this phase.

## 5. Data model impact

None. No collection, model, or connection exists yet — that is Phase 1.

## 6. Work log

| Date       | What was done                                                                                                                                                                                                                                  | Files                                                                                                     | Model                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 2026-08-13 | Scaffolded Next.js 16 (App Router, TS strict, Tailwind v4) via `create-next-app` into a temp dir (repo dir name `VRA` is invalid as an npm package name) and merged into the repo root; renamed package to `mv-vra`.                           | `package.json`, `app/*`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `public/*` | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | `shadcn init` + added the Phase 0 component inventory from `DESIGN-SYSTEM.md` §4 (button, input, select, table, dialog, sheet, tabs, sonner for toast, tooltip, etc.)                                                                          | `components.json`, `components/ui/*`, `lib/utils.ts`                                                      | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | Replaced shadcn's default neutral oklch palette with the tokens in `DESIGN-SYSTEM.md` §3 (B2B blue/slate palette, risk-severity color pairs, fixed z-index scale) and switched the font to Inter + JetBrains Mono per §3's single-family rule. | `app/globals.css`, `app/layout.tsx`                                                                       | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | Added a Zod env schema validated at import time (`NODE_ENV`, `STORAGE_DRIVER` only — the rest are added in the phases that need them), a smoke test, and `.env.example`.                                                                       | `lib/env.ts`, `lib/__tests__/env.test.ts`, `.env.example`, `.gitignore`                                   | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | Configured Prettier (+ tailwind class-sorting plugin) and Vitest (jsdom, coverage-v8, testing-library), wired `npm run verify` = format:check → lint → typecheck → test → build.                                                               | `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `vitest.setup.ts`, `package.json`              | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | Replaced the create-next-app placeholder home page and README with project-specific content; removed unused boilerplate SVG assets.                                                                                                            | `app/page.tsx`, `README.md`, `public/*.svg` (removed)                                                     | Claude Opus 5 (`claude-opus-5[1m]`) |
| 2026-08-13 | Replaced Gates 0–3 in `TEST-CHECKLIST.md` with the real commands and removed the not-runnable banner.                                                                                                                                          | `docs/TEST-CHECKLIST.md`                                                                                  | Claude Opus 5 (`claude-opus-5[1m]`) |

## 7. What didn't work

- **`create-next-app .` in the repo root failed outright** — npm rejects package names with
  capital letters, and the repo directory is named `VRA`. Worked around by scaffolding into
  a temp directory with a valid name (`mv-vra-scaffold`) and merging the result into the
  repo root with `rsync`, excluding the scaffold's own `CLAUDE.md`/`.next`. The package name
  was then corrected to `mv-vra` in `package.json`.
- **`shadcn init`/`add` failed with `self-signed certificate in certificate chain`** against
  every Node-based fetch (`ui.shadcn.com`), while `curl` to the same host succeeded. Node's
  bundled CA store doesn't include whatever certificate authority this environment's network
  path uses; the system keychain does. `NODE_OPTIONS="--use-openssl-ca"` alone did not fix
  it. What worked: export the macOS System and SystemRootCertificates keychains to a PEM file
  and pass it via `NODE_EXTRA_CA_CERTS`. This is a one-off local workaround, not a project
  dependency — nothing in the repo depends on it, but a future session hitting the same
  `self-signed certificate` error against any `ui.shadcn.com` fetch should reach for this
  first rather than disabling TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`), which was
  deliberately avoided.
- **`npm install` for the Vitest toolchain failed on a peer-dependency conflict** between
  `shadcn`'s transient babel toolchain (added to `devDependencies` automatically by
  `shadcn init`) and `@vitejs/plugin-react`'s rolldown/babel peer requirement. Resolved with
  `--legacy-peer-deps` for that one install. Logged in `TEST-CHECKLIST.md` Gate 0 as a note
  for anyone running `npm ci` from a clean checkout — not fixed at the root, since both
  packages are legitimate and the conflict is between their own transitive dev dependencies.
- **`tsc --noEmit` failed on a clean checkout** with `Cannot find name 'LayoutProps'` — the
  App Router's generated route types live under `.next/types`, which don't exist until a
  build or dev run generates them. Running `next build` once masked the problem locally but
  would recur for anyone cloning fresh. Fixed properly: `next typegen` (a dedicated Next.js
  CLI command that generates route types without a full build) now runs as the first step
  of `npm run typecheck`.
- **`@testing-library/jest-dom`'s matchers failed to import** — `Cannot find package
'@testing-library/dom'`. It's a peer dependency jest-dom expects but does not declare
  strongly enough for npm to install automatically alongside it. Added explicitly.

## 8. Decisions logged

None new. This phase implements decisions 003–005 already recorded (tenancy, stack, UI);
it does not introduce any decision of its own.

## 9. Verification

Gates run: 0 (informal — `node --version` confirmed v26.7.0, `npm install` succeeded), 1, 2,
3, via `npm run verify` from a clean state (`rm -rf .next node_modules/.vite` first).
Skipped: 4 (no auth/tenancy/portal code exists yet), 5 (no schema/template code exists yet),
6 (not a release, no features exist to smoke-test).

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

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  18:06:26
   Duration  461ms (transform 14ms, setup 69ms, import 22ms, tests 1ms, environment 303ms)

> mv-vra@0.1.0 build
> next build

▲ Next.js 16.3.0 (Turbopack)
✓ Running next.config.ts took 10ms
  Creating an optimized production build ...
✓ Compiled successfully in 1826ms
  Running TypeScript ...
  Finished TypeScript in 1312ms ...
  Collecting page data using 5 workers ...
✓ Generating static pages using 5 workers (4/4) in 224ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
└ ○ /_not-found

○  (Static)  prerendered as static content
```

Additionally, ran `npm run dev` and confirmed by request (not by reading the code):
`curl http://localhost:3000` returns 200 with `<title>MV-VRA</title>`; the served CSS
bundle contains `--primary: #0369a1;` (light) and `--primary: #38bdf8;` (dark), and
`--risk-critical: #b91c1c;` / `#f87171;` — confirming the DESIGN-SYSTEM.md tokens compiled
in, not shadcn's default neutral palette.

`npm test` currently proves the harness runs (one smoke test on `lib/env.ts`), not feature
correctness — there is no feature yet. Vitest emits a benign warning about
`vite-tsconfig-paths` and native config loading; noted, not fixed, since it does not affect
correctness and Vitest itself flags it as forward-looking guidance, not a defect.

## 10. Rollback

**No rollback point exists.** The project owner explicitly deferred git setup for this
session ("I don't have the git repo with me now, will setup git later"), so
`docs/ROLLBACK.md`'s existing warning stands unresolved through this entire phase. Nothing
in this phase can be reverted via git; the only recovery path right now is re-running this
phase's steps from scratch. This is a carried-forward risk, not a new one — flag it again
at the start of Phase 1.

## 11. Follow-ups

- `npm ci` peer-dependency conflict (shadcn's babel toolchain vs. `@vitejs/plugin-react`) is
  worked around per-install, not fixed at the root. Revisit if it becomes a recurring
  friction point.
- Dark-mode token values in `app/globals.css` are a straight inversion of the light palette,
  not independently contrast-checked — `docs/DESIGN-SYSTEM.md` does not currently require
  dark mode for MVP; flagged in a code comment.
- Colour contrast ratios in `docs/DESIGN-SYSTEM.md` §3 were computed by hand, not measured
  in-browser — still pending verification per that document's own note.
- Establishing the git baseline (Phase 0 step 1) remains outstanding and blocks
  `docs/ROLLBACK.md` from ever showing a real baseline SHA.
