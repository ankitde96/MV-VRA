# PLAN.md — MV-VRA Development Plan

> **Project name:** MV-VRA (MoneyView Vendor Risk Assessment)
> **Source of scope:** `VRA MVP Feature Specification.md`. Where this plan and the spec
> disagree, the spec wins and this file gets corrected.
> **Status:** Plan of record, agreed 2026-08-13. Nothing in it is built yet.
>
> Companion documents:
>
> - `docs/DATA-MODEL.md` — collections, indexes, tenant enforcement, schema formats
> - `docs/DESIGN-SYSTEM.md` — tokens, component inventory, accessibility rules
> - `docs/DECISIONS.md` — entries 003–009 record the decisions summarised here

---

## 1. Understanding lock

Confirmed with the project owner before any design was proposed.

- **What is being built.** A centralised system of record for third-party vendor risk:
  intake → inherent tiering → questionnaire assessment via an external vendor portal →
  unified risk register with residual scoring and corrective action plans → offboarding
  with data-destruction verification → multi-entity workspace segmentation.
- **Why it exists.** Third-party risk is currently untracked or tracked in spreadsheets.
  The platform makes the process auditable end to end and prevents data-retention risk at
  contract termination.
- **Who it is for.** Three actors: the internal Risk/Admin team (owns templates, review,
  register, offboarding), internal business owners (submit intake), and the external
  Vendor SPOC (one named contact per vendor, authenticates by Email OTP).
- **Key constraints.** Next.js + MongoDB + S3/local-fs. No AI layer, no SSO, no discovery
  workers, no external integrations — those are the eight parked items in spec §4.
  Multi-tenant isolation, template immutability, and archive immutability are
  non-negotiable (`CONSTRAINTS.md` #8, #11, #12).
- **Explicit non-goals.** Everything in spec §4. Also: no mobile app, no public
  self-registration, no vendor-initiated intake.
- **Delivery context.** Solo developer, no fixed deadline. The plan is therefore a strictly
  linear sequence of the smallest vertical slices that are each independently demoable —
  not parallel workstreams.

### Assumptions

Stated so they can be corrected rather than discovered later.

| #   | Assumption                                                                                                            | If wrong                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A1  | Scale is tens of workspaces, low thousands of vendors, low tens of thousands of assessments. Not a scale problem.     | Sharding and read replicas enter the picture; the shared-DB tenancy call would be revisited. |
| A2  | Vendor SPOCs use the portal rarely — a handful of sessions per assessment.                                            | Portal needs session persistence and richer save/resume than planned.                        |
| A3  | Availability target is business-hours-best-effort. No HA requirement for MVP.                                         | Phase 12 grows a redundancy workstream.                                                      |
| A4  | No PII/PHI in logs, fixtures, or seed data (`CONSTRAINTS.md`, unconfirmed list). Assumed **no** until told otherwise. | Logging and seed strategy change.                                                            |
| A5  | Evidence files are documents (PDF/DOCX/XLSX/images), single-digit MB, not archives of arbitrary size.                 | Upload path needs chunking/multipart and a virus-scan step.                                  |
| A6  | The enterprise risk category taxonomy will be supplied by the risk team as a fixed list.                              | Register mapping needs a taxonomy editor, which is not planned.                              |
| A7  | One SPOC per vendor, as the spec states — not per engagement.                                                         | Vendor scoping in F2 changes shape; this is an auth-boundary change.                         |

### Open questions still unresolved

These do not block Phase 0–2. They must be answered before the phase named.

| Question                                                                         | Blocks   | Default if unanswered                                                                       |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| Which transactional email provider sends OTPs and CAP escalations?               | Phase 6  | Mailer abstraction with a console transport in dev; provider slotted in later.              |
| Background job runner, or request-driven escalation?                             | Phase 9  | Request-driven first; a job runner is a later, separate decision.                           |
| Are questionnaire templates workspace-scoped or global with workspace overrides? | Phase 5  | Workspace-scoped, with a global seed library copied in on workspace creation.               |
| Retention period for archived assessments and audit trails?                      | Phase 10 | Indefinite. Nothing is deleted; retention becomes a later policy.                           |
| S3 bucket, region, and is object versioning enabled?                             | Phase 12 | Blocks production only. `ROLLBACK.md` requires versioning before storage code touches prod. |
| Enterprise risk category taxonomy — who owns the list?                           | Phase 8  | Seeded placeholder taxonomy, flagged in the UI as provisional.                              |

---

## 2. Architecture decisions taken

Full rationale in `DECISIONS.md` 003–009. Summary:

| Decision            | Choice                                                             | Chief consequence                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy             | Shared MongoDB database, `workspace_id` on every tenant collection | Isolation is application-enforced. A missing filter is a breach, so the repository layer must make an unscoped query _impossible_, not merely discouraged. |
| Language            | TypeScript, strict                                                 | Scoring engines and tenant scoping get compile-time checks.                                                                                                |
| Router              | Next.js App Router, Server Components for the internal console     | Two route groups: `(internal)` and `(portal)`, with separate auth middleware.                                                                              |
| Data access         | Mongoose                                                           | Schema validation MongoDB will not give us; index declaration lives with the model.                                                                        |
| Boundary validation | Zod                                                                | Zod at HTTP and env boundaries, Mongoose at the DB boundary. Both, deliberately.                                                                           |
| UI                  | Tailwind + shadcn/ui                                               | Components are copied in and owned; no runtime UI dependency to upgrade around.                                                                            |
| Layering            | route handler → service → repository                               | `CONSTRAINTS.md` #9. No Mongo client reachable from a React component.                                                                                     |

### Directory shape

```
app/
  (internal)/…            internal console — RSC, session-cookie protected
  (portal)/…              vendor SPOC portal — separate cookie, vendor-scoped
  api/**/route.ts         handlers: HTTP + Zod validation only, no business logic
lib/
  db/
    connect.ts            hot-reload-safe Mongoose singleton
    models/*.ts           Mongoose schemas + index declarations
  repositories/*.ts       tenant-scoped data access — the ONLY place models are queried
  services/*.ts           domain logic, framework-agnostic, unit-testable
  scoring/                pure functions: inherent, residual, tiering
  questionnaire/          conditional-logic evaluator, shared by console and portal
  storage/                one interface, local-fs and S3 implementations
  mail/                   one interface, console and provider implementations
  auth/                   internal session + OTP challenge (touch only in its own task)
  errors/                 error classes + the single HTTP error formatter
components/ui/            shadcn primitives
components/               feature components
docs/                     the Field Guide artifacts
```

### Node.js practice applied to this system

Derived from the `nodejs-best-practices` decision framework rather than copied from it.

- **Framework:** Next.js API routes — chosen because the spec already commits to Next.js
  for the frontend and the API surface is modest. Hono/Fastify would only be right if the
  API were split out, which it is not.
- **Error handling:** custom classes (`ValidationError` 422, `NotFoundError` 404,
  `ForbiddenError` 403, `TenantScopeError` 500 + alert) thrown from any layer, caught by a
  single route wrapper. Client receives a code and a safe message; logs receive the stack,
  request context, actor, and workspace. Never leak internal detail to a vendor portal
  response.
- **Async:** all I/O is async — no `fs.*Sync` anywhere, including the local-fs storage
  implementation. `Promise.all` for the independent per-workspace queries in the executive
  roll-up. Scoring is CPU-trivial and stays inline.
- **Validation points:** request body/params, environment variables at startup (fail the
  boot, not the first request), uploaded file type and size, and every external file read.
- **Testing:** unit tests on the scoring engines and the conditional-logic evaluator —
  those are where a silent wrong answer is worse than a crash. Integration tests on the
  tenant and vendor boundaries. Not on framework code.

---

## 3. Phase roadmap

Each phase ends in something demoable and has explicit exit criteria. **A phase is not
done until its gates are run and the real output is pasted** (`CLAUDE.md` habit 8). Every
phase from 1 onward writes to `audit_events`; that is not restated each time.

Phases 2, 6, and 11 touch authentication or tenancy. Per `CONSTRAINTS.md` #2 and
`ROLLBACK.md`, each is its own request with its own rollback plan filled in first.

---

### Phase 0 — Baseline and guardrails

No features. This phase exists because `ROLLBACK.md` currently reads _no rollback point
exists_ — the repository has zero commits, so any overwrite right now is permanent.

1. `git add -A && git commit` — establish the baseline. Record the SHA in `ROLLBACK.md`.
2. Scaffold Next.js (TypeScript, App Router, Tailwind), `shadcn init`.
3. `.env.example` + Zod env schema validated at startup. `.env` git-ignored.
4. ESLint + Prettier + `tsconfig` strict.
5. Vitest configured.
6. `npm run verify` = lint + typecheck + test + build.
7. Replace every `[PLACEHOLDER]` command in `TEST-CHECKLIST.md` with the real one and
   delete the not-runnable banner.

**Dependencies requiring approval** (`CONSTRAINTS.md` #1 — ask before installing):
`next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `zod`, `vitest`,
`eslint`/`prettier`, plus shadcn's peers (`radix-ui` primitives, `class-variance-authority`,
`clsx`, `tailwind-merge`, `lucide-react`).

**Exit:** `npm run verify` exits 0, output pasted into the phase's feature trace.

---

### Phase 1 — Data layer and the tenant guard

The single most important phase. If the tenant guard is weak, every later phase inherits a
breach path.

1. Hot-reload-safe Mongoose connection singleton.
2. Models for all collections (`DATA-MODEL.md` §2), indexes declared alongside.
3. `TenantContext` type and a repository base class that **cannot** execute a query without
   one — an unscoped call throws `TenantScopeError` at runtime rather than returning
   cross-tenant data.
4. An index-sync script, run explicitly. No implicit `autoIndex` in production.
5. Seed script: one workspace, one super-admin user, the mitigation guidance library.
6. Tests: unscoped query throws; workspace A cannot read workspace B; every declared index
   exists after sync.

**Exit:** tenant-isolation test suite green, pasted. `ARCHITECTURE.md` §5 marked `✅ BUILT`.

---

### Phase 2 — Internal authentication _(auth phase — own rollback plan)_

Static super-admin credentials per spec §1.2. Google SSO stays parked.

1. Password hashed with argon2 (**new dependency — ask**), never stored plaintext, never in
   the repo. Credentials from environment only.
2. Login page, session cookie: `httpOnly`, `secure`, `sameSite=lax`, short-ish expiry.
3. Middleware protecting the whole `(internal)` route group.
4. Distinct cookie name and path from the portal cookie, so a portal session can never
   satisfy an internal route check — and vice versa.

**Exit:** no `(internal)` route or API handler is reachable unauthenticated, verified by
request rather than by reading the code.

---

### Phase 3 — Vendor intake, inherent risk engine, tiering _(FLOW F1)_

First real feature, and the first end-to-end slice.

1. Configurable intake form: expected procurement date, business unit, functional scope,
   data types processed (PII/PHI/Financial), network exposure, system access level,
   business redundancy.
2. **Inherent Risk Engine** as a pure function. Weights read from `workspace.settings` and
   the _resolved weights are snapshotted onto the engagement_ with a `weights_version`, so
   a historical score can always be recomputed and explained.
3. **Tiering & Triage** maps score → Tier 1/2/3 against workspace-configured thresholds.
4. **Fail loudly on unscoreable input.** A null or unscored tier must never default to
   Tier 3. The engagement lands in `scoring_failed` and appears in a triage queue.
   This is the gap flagged at `FLOW.md` F1 steps 4→5.
5. Vendor + Engagement written atomically, both stamped with `workspace_id`.
6. Vendor inventory list view.

**Exit:** intake submitted → tier visible in inventory. Unit tests at _every_ tier boundary,
plus the unscoreable case. `FLOW.md` F1 rewritten with real file references.

---

### Phase 4 — Vendor SPOC management and the storage module

1. SPOC subdocument (name, email, phone) managed on the vendor detail page.
2. **Storage abstraction** — one interface, `local-fs` in dev and `s3` in prod, selected by
   env. Feature code never sees the difference (`CONSTRAINTS.md` #10).
3. Reads go through an authorised proxy route or a short-lived signed URL. A raw object key
   is never enough to retrieve a file.
4. Upload constraints enforced server-side: MIME allow-list, size cap.

**Exit:** upload and retrieve a file in dev via local-fs; unauthorised retrieval of a known
key is refused. S3 implementation compiles and is unit-tested against a mock, unconfigured.

---

### Phase 5 — Template builder and versioning _(FLOW F3, part 1)_

The `questions_schema` format defined here is the highest-leverage artifact in the project —
the portal renderer, the conditional-logic evaluator, the validator, and every historical
assessment all depend on it. Format specified in `DATA-MODEL.md` §3.

1. Template CRUD, `draft → published → archived` lifecycle.
2. **Publishing freezes the version.** A published version is immutable; editing means
   creating a new version (`CONSTRAINTS.md` #11).
3. Conditional-logic expression format — declarative, evaluated by one shared module used
   by both the builder preview and the portal.
4. Builder preview renders through that same module, so preview and portal cannot diverge.

**Exit:** publish a template; an edit against the published version is rejected; preview
output matches portal output for the same schema.

---

### Phase 6 — Assessment assignment and OTP portal auth _(FLOW F2 — auth phase, own rollback plan)_

The highest-risk surface in the system: externally reachable, and it guards another
company's data.

1. Assign a template version to an engagement → create the assessment, embedding a
   **`template_snapshot`** — a frozen copy of `questions_schema`, not just a reference.
   This makes "render this historical assessment exactly as answered" a property of the
   document, not of a lookup that could later break.
2. OTP request: identical response body **and** comparable timing whether or not the email
   is registered — no enumeration (`FLOW.md` F2 gap a).
3. OTP stored hashed with a server secret, TTL index for automatic expiry, attempt limit,
   single-use — consumed on success, no replay (gap c).
4. Session scoped to exactly one `vendor_id`. Every portal request **re-derives** that scope
   from the session; it is never read from a URL or body parameter (gap b).
5. Rate limiting per email and per IP on the OTP request endpoint.
6. Mailer abstraction with a console transport in dev — never point tests at a real sender
   (`ROLLBACK.md`: sent emails cannot be rolled back).

**Exit:** the whole of Gate 4 in `TEST-CHECKLIST.md` passes, verified by request:
enumeration, expiry, attempt limit, replay, cross-vendor ID tampering, scope source.

---

### Phase 7 — Questionnaire answering, evidence upload, validation _(FLOW F3, part 2)_

1. Portal renders from `template_snapshot` via the shared evaluator.
2. Conditional logic shows/suppresses follow-ups live.
3. Autosave per `control_id`.
4. Evidence upload bound to a specific control, through the Phase 4 storage module.
5. **Pre-submission validation that skips suppressed questions.** A hidden question must
   not be flagged "empty and missing" — otherwise submission deadlocks (`FLOW.md` F3 gap).
6. **Orphaned upload handling.** Write the response record first, then the file; a
   reconciliation pass sweeps files with no owning record.

**Exit:** full SPOC round trip — OTP login, answer, branch, upload, submit. Explicit test
that a suppressed required question does not block submission.

---

### Phase 8 — Review, risk register, residual scoring _(FLOW F4)_

1. Reviewer view of the submitted assessment, response by response.
2. Raise an **Identified Risk** from a failed or exception response.
3. Map `control_id` → enterprise risk category and impact level.
4. **Residual Risk Calculation** — inherent score adjusted by verified controls and
   compensating measures.
5. **Score authority, resolving the `FLOW.md` F4 gap:** `risk.residual_score` is
   authoritative and computed on risk write. `assessment.overall_score` is _derived_ and
   recomputed in the same operation. One writer, one direction — the register and the
   assessment cannot disagree.

**Exit:** raise a risk → residual computed → register lists it → assessment score agrees
with the sum of its constituent risks.

---

### Phase 9 — CAP tracking and mitigation guidance

1. Corrective action plans with owner (internal user or vendor SPOC), due date, status.
2. Overdue detection and escalation — request-driven for MVP; a background runner is a
   separate later decision.
3. Out-of-the-box mitigation guidance library, matched to the failed control and offered
   as a suggestion at risk-raise time.

**Exit:** an overdue CAP surfaces in a queue and escalates once, without a job runner.

---

### Phase 10 — Offboarding, destruction certificates, archiving _(FLOW F5)_

1. Multi-stage offboarding checklist, tasks fanned to internal owners.
2. Certificate of Data Destruction and asset-return attestation upload and verification.
3. **Immutable archive**: assessments (with their `template_snapshot`), remediation logs,
   audit trail. Append-only — the repository exposes no update or delete path for archived
   records (`CONSTRAINTS.md` #12).
4. Vendor `lifecycle_status` transition.

**Exit:** Gate 5 in full — an archived assessment renders byte-identically to how it was
answered, and no code path exists that can mutate it.

---

### Phase 11 — Multi-workspace RBAC, sharing, executive roll-up _(FLOW F6 — tenancy phase, own rollback plan)_

Deliberately last: by this point every collection and query already carries `workspace_id`,
so this phase adds the surfaces rather than retrofitting isolation.

1. Workspace switcher; per-workspace role assignment (RBAC).
2. **Cross-Workspace Document Sharing** — the single sanctioned cross-tenant read path,
   explicit and audited. Everything else keeps failing closed.
3. **Consolidated executive roll-up.** Authorisation is checked **per workspace during
   aggregation**, never once at the top (`FLOW.md` F6 gap).

**Exit:** Gate 4 tenant isolation re-run in full; the roll-up returns only authorised
workspaces, verified with a user authorised for a strict subset.

---

### Phase 12 — Hardening and release

1. Full Gate 0–6 run, output pasted.
2. Production configuration: S3 bucket with **versioning confirmed enabled** before any
   prod storage write, secrets in env, HTTPS, security headers, CORS.
3. Audit-log completeness pass — every mutating service writes an event.
4. `mongodump` backup procedure documented and _tested_, including the restore.

---

## 4. Critical path and risk

The three places where getting it wrong is expensive to unwind:

1. **The tenant guard (Phase 1).** Retrofitting isolation after ten phases of queries is a
   rewrite. It is built first, and it fails closed by construction.
2. **The `questions_schema` format (Phase 5).** Changing it after assessments exist means
   migrating frozen snapshots — which are supposed to be immutable. Specify it fully,
   version the format itself, and accept the cost of thinking it through before Phase 6.
3. **The portal auth boundary (Phase 6).** The only externally reachable surface. Every
   subsequent portal feature inherits whatever this phase gets right or wrong.

Lower-risk and deferrable if effort runs long: the mitigation guidance library (Phase 9)
can ship with a thin seed set; cross-workspace document sharing (Phase 11) can be cut to
read-only without losing the roll-up.

---

## 5. Definition of done, per phase

Not negotiable, from `CLAUDE.md`:

- [ ] Relevant `TEST-CHECKLIST.md` gates run, **actual output pasted**, failures stated
- [ ] `docs/features/<phase>.md` trace written start to finish
- [ ] `FLOW.md` updated — prose steps replaced with real `path/file.ts:function` references
- [ ] `ARCHITECTURE.md` section marked `✅ BUILT`
- [ ] `DECISIONS.md` appended for every meaningful choice, version-pinned
- [ ] Non-obvious logic commented for flow and intent, not syntax
- [ ] `HANDOVER.md` updated with the five lines
