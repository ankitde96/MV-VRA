# Browser E2E, UX Reliability, and Documentation Cleanup

**Date:** 2026-08-18  
**Safe baseline:** `5b37815193f5`  
**Scope:** Browser verification, recoverable portal failure states, and current-state docs.

## What changed

- Added Playwright with desktop Chromium and Pixel 7 projects.
- Added read-only browser journeys for internal auth, return destinations, portal-cookie
  isolation, administrator navigation, role denial, vendor portal auth, and OTP failure.
- Prevented the portal login UI from advancing when the OTP request endpoint fails.
- Made questionnaire autosave failures visible and retryable.
- Flushes pending debounced answers before assessment submission, preventing a submit/save
  race from reporting valid answers as missing.
- Made evidence upload errors accessible and changed the next action to an explicit retry.
- Made mobile detection hydration-safe so narrow viewports no longer replace the desktop
  sidebar tree during React hydration.
- Corrected `withRouteErrors` to return Next.js-compatible non-optional route parameters,
  closing the generated route-type failure that previously blocked the full verification
  command.
- Excluded `e2e/` from Vitest discovery so each test runner owns only its suite.
- Updated README, architecture, handover, rollback, test checklist, and ignored browser
  artifacts to reflect the current system.

## Boundaries

- No schema, tenant-scoping, RBAC, session-token, or storage behavior changed.
- Browser tests use idempotent development fixtures and do not create or delete records.
- Playwright remains a separate gate from `npm run verify` because it needs a live MongoDB
  replica set, seeded fixtures, and installed browser binaries.

## Verification

Run:

```bash
npm run db:seed
npm run db:seed-questionnaire
npm run test:e2e
npm run verify
21st review components/portal --json
```

Final result: Playwright 14/14, Vitest 206/206, `npm run verify` successful, and 21st review
reported zero errors, warnings, or suggestions for the reviewed portal components. ESLint
reports the existing TanStack Table React Compiler advisory and zero errors.
