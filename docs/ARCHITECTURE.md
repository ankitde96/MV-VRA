# ARCHITECTURE.md — The System Map

> Guide habit 6. The _shape_ of the system, not implementation detail — so no session has
> to re-derive the terrain by guessing.
>
> **STATUS (2026-08-18): Phases 0–11 ✅ BUILT — the full `PLAN.md` sequence.** Scaffold (0),
> data layer + tenant guard (1), internal authentication (2), vendor intake + Inherent Risk
> Engine + tiering (3), vendor SPOC management + the storage module (4), the questionnaire
> template builder + versioning (5), assessment assignment + OTP portal auth (6),
> questionnaire answering + evidence upload + validation (7), review + risk register +
> residual scoring (8), CAP tracking + overdue escalation (9), offboarding + destruction
> certificates + immutable archiving (10), and multi-workspace RBAC + Cross-Workspace
> Document Sharing + executive roll-up (11) all exist and are verified — see the phase
> feature traces in `docs/features/`. `FLOW.md` F1–F6 are now all fully ✅ BUILT end to end;
> this was the last flow. Phase 8's code was written in a prior uncommitted session and had
> two typecheck-failing bugs fixed before verification, and shipped with no automated test
> coverage for the Residual Risk Calculation or `AssessmentReviewService` — both gaps
> closed at the start of Phase 9 (`lib/scoring/__tests__/residual-risk.test.ts`,
> `lib/services/__tests__/assessment-review.test.ts`) before building CAP tracking on top —
> see `DECISIONS.md` 021, 022. Phase 10 added the first-ever writer of
> `status: 'archived'` and, with it, a new immutability guard on the Phase 8/9 risk/CAP
> write paths (`DECISIONS.md` 023). Phase 11 removed the Phase 2 single-account login gate
> (`DECISIONS.md` 013, 024), added the first-ever readers/writers of the `SharedDocument`
> and `User.memberships[].role` fields (both unused since Phase 1), and closed `FLOW.md`
> F6's per-workspace-authorization gap. The former no-git-baseline risk is closed: `main`
> has a pushed history and `docs/ROLLBACK.md` records the current rollback baseline.

---

**Assessment workflow revamp (2026-08-19):** Stages 1–5 are complete. Stage 4 adds a
draft-only transactional send service, recipient-scoped portal authorization, explicit
cross-collection activity timestamps, and a shared DataTable history surface. Stage 3 is
the draft/tailoring foundation; Stage 4 freezes that snapshot on send, starts the SLA, and
uses selected SPOC ids as the portal access boundary. Stage 5 closes the review loop.
`AssessmentReviewService` owns per-response verdicts,
query-guarded resend, risk-gated completion, and audit events. Portal write services enforce
the correction boundary independently of the UI. Both reviewer and vendor forms use
`hooks/use-debounced-autosave.ts`; the route/service/repository boundary remains intact. See
`docs/features/assessment-workflow-stage-3-draft-checklists.md` and
`docs/features/assessment-workflow-stage-4-send-and-history.md` and
`docs/features/assessment-workflow-stage-5-review-resend.md`.

**Reviewer experience Stage 0 (2026-08-20):** The internal review page keeps workflow and
network orchestration in `components/assessments/assessment-review-client.tsx`, while
`components/assessments/review/review-state.ts` owns per-control client state and the
`ReviewSection`/memoized `ReviewQuestionRow` pair owns question rendering. Unchanged control
state retains object identity across reducer actions, so one note edit can remain row-local.
`hooks/use-review-url-state.ts` is the query-string persistence boundary for Stage 3; it has
no named fields or current consumer in Stage 0. Service, repository, and authorization
boundaries are unchanged. See `DECISIONS.md` 046.

**Reviewer experience Stages 1–2 (2026-08-20):** Stage 1 adds additive evidence-review
foundations and precise uploader provenance (`DECISIONS.md` 047). Stage 2 leaves runtime
boundaries unchanged and extends only the opt-in demo-data path: `scripts/demo-data-spec.ts`
owns a deterministic 25-control snapshot and verdict profiles; `scripts/seed-demo-data.ts`
writes response/evidence fixtures, delegates risk/CAP creation to
`AssessmentReviewService`, and stores bytes only through `getStorageDriver()`. Database
cleanup is resolved from workspace-scoped `.demo.mv-vra.local` vendor ids; storage reset is
limited to `<workspace_id>/reviewer-demo-v2`. See `DECISIONS.md` 048.

**Reviewer experience Stage 3 (2026-08-20):** Review workflow/network writes remain in
`AssessmentReviewClient`; `hooks/use-review-productivity.ts` now owns the bounded client-side
view model for progress, facets, search, section disclosure, focused-control restoration,
and keyboard coordination. Pure calculation and URL parsing/serialization live under
`components/assessments/review/`. Suppressed controls are excluded from every actionable
review set. No service, repository, authorization, API, or schema boundary changed. See
`DECISIONS.md` 049.

**Reviewer experience Stage 4 (2026-08-20):** `AssessmentEvidenceService` is the shared
tenant-scoped boundary for resolving evidence, atomically setting or clearing advisory
flags through `ResponseRepository`, and assembling bounded ZIP exports. Internal downloads
use internal membership routes and portal downloads retain their separate portal-session
route; neither accepts a storage key from the request. All bytes flow through
`getStorageDriver()`. ZIP preflight uses persisted file sizes and the configurable
`EVIDENCE_ZIP_MAX_BYTES` ceiling before bodies are loaded, then `archiver` writes sanitized,
collision-safe paths plus `manifest.csv` to the response stream. See `DECISIONS.md` 050.

## 1. What this system is

**MV-VRA** (MoneyView Vendor Risk Assessment) is a centralized system of record for
third-party risk. MVP scope is a **workflow orchestration engine**: dynamic intake,
contextual vendor tiering, an external vendor collaboration portal, a unified risk
register, and multi-tenant workspace isolation.

Explicitly **not** in the MVP: AI/RAG evidence analysis, Google SSO, automated inventory
discovery, agentic copilots, control framework libraries, continuous monitoring feeds,
contract/SLA tracking, and third-party integrations (spec §4).

## 2. Stack

| Layer            | Choice                                                | Notes                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16, App Router, TypeScript strict             | ✅ BUILT. Route groups `(internal)` (Phase 0) and `(portal)` (Phase 6, real URL prefix `/portal` — route groups alone don't add a URL segment) both exist — see `DECISIONS.md` 004, 019                                                                                                                                                                                                                                     |
| Database         | MongoDB via Mongoose                                  | ✅ BUILT (Phase 1). Document-oriented; shared DB with `workspace_id` — see 003. Physical model in `DATA-MODEL.md`. Converted to a single-node replica set `rs0` in Phase 3 for transactions — see `DECISIONS.md` 014                                                                                                                                                                                                        |
| Validation       | Zod at HTTP/env boundaries                            | ✅ BUILT for env (`lib/env.ts`) and now the first HTTP boundary too — `app/api/vendors/route.ts` (Phase 3)                                                                                                                                                                                                                                                                                                                  |
| UI               | Tailwind v4 + shadcn/ui                               | ✅ BUILT (Phase 0). Swiss/minimal tokens in `app/globals.css`; two-density layouts not built — see `DESIGN-SYSTEM.md`                                                                                                                                                                                                                                                                                                       |
| Evidence storage | AWS S3 (prod) / local filesystem (dev)                | ✅ BUILT (Phase 4, local-fs driver + authorised proxy route). S3 driver compiles and is unit-tested against a mock; unconfigured until Phase 12 sets `AWS_S3_BUCKET`/`AWS_REGION` — see `DECISIONS.md` 017                                                                                                                                                                                                                  |
| Internal auth    | Multi-user, RBAC-gated (dev)                          | ✅ BUILT (Phases 2, 11). Stateless HMAC-signed session cookie, `proxy.ts` fails closed by default (Phase 2, `DECISIONS.md` 012). The single-`SUPER_ADMIN_EMAIL` gate (013) was removed in Phase 11 — any active `User` with a matching password logs in; a four-role capability matrix (`lib/auth/rbac.ts`) resolved fresh from the DB per request now gates writes — see `DECISIONS.md` 024. Google SSO parked to post-MVP |
| Vendor auth      | Email OTP to Vendor SPOC                              | ✅ BUILT (Phase 6). Structurally separate stateless session (own cookie, own signing secret) from the internal one; enumeration-resistant request, HMAC-hashed single-use codes, attempt limit, rate limiting — see `DECISIONS.md` 019. The only external-user entry path                                                                                                                                                   |
| Portal answering | Render `template_snapshot`, autosave, evidence upload | ✅ BUILT (Phase 7). Shares the Phase 5 renderer/evaluator with the builder preview; write access is locked once an assessment leaves `sent`/`in_progress` — see `DECISIONS.md` 020                                                                                                                                                                                                                                          |
| Browser testing  | Playwright, desktop + mobile Chromium                 | ✅ BUILT (2026-08-18). Covers protected-route return behavior, safe login failures, internal/portal session isolation, primary admin navigation, role denial, vendor portal login, and OTP request failure handling. See `e2e/` and `docs/TEST-CHECKLIST.md`.                                                                                                                                                               |

## 3. Actors

- **Internal — Risk/Admin team.** Configures templates, reviews assessments, owns the risk
  register, runs offboarding.
- **Internal — Business owner.** Submits vendor intake requests.
- **External — Vendor SPOC.** One of one-or-more named contacts per vendor. Authenticates by Email OTP,
  answers questionnaires, uploads evidence. Sees only their own vendor's data.

## 4. Module map

```
┌─ Next.js application ──────────────────────────────────────────────┐
│                                                                    │
│  INTERNAL SURFACE                    EXTERNAL SURFACE              │
│  ├── Intake forms ✅ BUILT            └── Vendor Portal ✅ BUILT     │
│  ├── Vendor inventory ✅ BUILT              ├── OTP login ✅ BUILT   │
│  ├── Vendor detail (SPOC, docs,             ├── Answer + branch +   │
│  │   draft questionnaire editor) ✅ BUILT  │   upload ✅ BUILT       │
│  ├── Template builder ✅ BUILT             └── Submit ✅ BUILT       │
│  ├── Assessment review ✅ BUILT                                     │
│  ├── Risk register ✅ BUILT                                         │
│  ├── Offboarding checklist ✅ BUILT   ── strict tenant + vendor    │
│  ├── Admin: users/roles ✅ BUILT          scoping boundary, plus    │
│  ├── Cross-Ws. sharing ✅ BUILT           ONE sanctioned exception  │
│  └── Executive roll-up ✅ BUILT           (sharing) ── Phase 11 ──  │
│                                                                    │
│  ── API routes ✅ BUILT (app/api/vendors/**, app/api/templates/**, │
│     app/api/portal/**, app/api/admin/**, app/api/sharing/**,      │
│     app/api/rollup/**)                                             │
│                                                                    │
│  DOMAIN SERVICES                                                   │
│  ├── Inherent Risk Engine ✅ BUILT   scores intake → Tier 1/2/3     │
│  │   lib/scoring/inherent-risk.ts    (Phase 3)                     │
│  ├── Tiering & Triage ✅ BUILT       rules-based routing            │
│  ├── Questionnaire Engine ✅ BUILT   conditional logic, versioned   │
│  │   lib/questionnaire/*.ts          templates (Phase 5)           │
│  ├── Assessment draft/edit ✅ BUILT  snapshot clone + guarded edit   │
│  │   lib/services/                   time (Phase 6)                │
│  │   assessment-assignment.ts                                     │
│  ├── OTP portal auth ✅ BUILT        enumeration-resistant, single- │
│  │   lib/services/portal-auth.ts     use, attempt-limited (Phase 6)│
│  ├── Portal answering ✅ BUILT       autosave, evidence upload,     │
│  │   lib/services/                   suppressed-question-skipping  │
│  │   portal-assessment.ts            submission validation (Ph. 7) │
│  ├── Validation/Pre-screen ✅ BUILT  suppressed questions never     │
│  │   (part of portal-assessment.ts)  block submission (Phase 7)    │
│  ├── Residual Risk Engine ✅ BUILT   severity×impact blended with   │
│  │   lib/scoring/residual-risk.ts    inherent score (Phase 8)      │
│  ├── Risk Register ✅ BUILT          control gaps → enterprise      │
│  │   lib/services/                   categories, one writer for    │
│  │   assessment-review.ts            residual/overall score        │
│  │                                   (Phase 8, DECISIONS.md 021)   │
│  ├── Remediation (CAP) ✅ BUILT      task create/update, request-   │
│  │   lib/services/                   driven overdue detection +    │
│  │   assessment-review.ts            one-time escalation           │
│  │   (createCapTask,                 (Phase 9, DECISIONS.md 022)  │
│  │    detectAndEscalateOverdueCaps)                                │
│  ├── Offboarding ✅ BUILT    checklist + certificate upload/verify  │
│  │   lib/services/            + the sole writer of `archived`      │
│  │   offboarding.ts           (Phase 10, DECISIONS.md 023)         │
│  ├── RBAC ✅ BUILT           4-role capability matrix, resolved    │
│  │   lib/auth/{rbac,          fresh from the DB every request,    │
│  │   current-membership}.ts   never cached in the cookie (Ph. 11) │
│  ├── Cross-Ws. Sharing ✅ BUILT  the ONE sanctioned cross-tenant   │
│  │   lib/services/sharing.ts     read; every read audit-logged    │
│  │                                (Phase 11, DECISIONS.md 024)    │
│  └── Executive Roll-up ✅ BUILT  authorizes PER MEMBERSHIP inside  │
│      lib/services/                its own loop, not once at the   │
│      executive-rollup.ts          top (Phase 11, DECISIONS.md 024)│
│                                                                    │
│  ── repository layer (all queries scoped by workspace_id) ─────    │
└────────────┬──────────────────────────────┬────────────────────────┘
             │                              │
      ┌──────▼──────┐              ┌────────▼─────────┐
      │  MongoDB    │              │ Storage module ✅ │
      │             │              │ local fs │ S3    │
      └─────────────┘              └──────────────────┘
```

## 5. Data model

**✅ BUILT (Phase 1, 2026-08-14).** All 13 collections from `DATA-MODEL.md` §2 exist as
Mongoose models under `lib/db/models/`, indexes declared alongside and applied via
`npm run db:indexes`. The tenant guard (`lib/repositories/base.ts`) is live and verified by
integration test against a real MongoDB — see
`docs/features/phase-1-data-layer-and-tenant-guard.md`. Phase 3 added
`EngagementRepository` (tenant-scoped) and `WorkspaceRepository` (not tenant-scoped —
`Workspace` _is_ the tenant) alongside `VendorRepository`; Phase 5 added
`TemplateRepository`; Phase 6 added `AssessmentRepository`; Phase 7 added
`ResponseRepository`; Phase 8 added `RiskRepository` (first writer to `risks`,
`lib/db/models/risk.ts` existed unused since Phase 1) — the rest are added with the
features that need them. `TenantRepository.create()` and `updateOne()` both accept an
optional `session`, so callers can write across two repositories inside one MongoDB
transaction — see `docs/features/phase-3-vendor-intake-and-tiering.md` and
`docs/features/phase-6-assessment-assignment-and-otp-portal-auth.md`. `otp_challenges` is
deliberately **not** behind a `TenantRepository` — OTP login resolves an email to a vendor
before any workspace is known, so `lib/auth/otp-challenge.ts` queries the model directly
(same reasoning as `lib/audit/record-event.ts`).

Collections (spec §3, summarized — full field/index detail in `DATA-MODEL.md` §2):

- **Workspace / Tenant** — `workspace_id`, `entity_name`, `settings`. Root of all isolation.
- **Vendor Profile** — `vendor_id`, `legal_name`, `domain`, `inherent_risk_tier`,
  `lifecycle_status`; embeds **Vendor SPOC** (`spoc_name`, `spoc_email`, `spoc_phone`).
- **Engagement** — `engagement_id`, `vendor_id`, `business_owner_id`,
  `data_classification`, `status`. A vendor may have many engagements.
- **Risk Assessment** — `assessment_id`, `engagement_id`, `template_id`, `status`,
  `overall_score`.
- **Questionnaire Template** — `template_id`, `version`, `questions_schema` (JSON defining
  the conditional logic). Versioned; immutable once published or archived.
- **Question / Control Response** — `control_id`, `question_text`, `response_value`,
  `evidence` (array of `{file_key, filename, mime, size, uploaded_at, uploaded_by}`,
  DATA-MODEL.md §2), and advisory `evidence_flags`. New portal evidence attributes the signed
  SPOC ID; the reviewer service resolves uploader labels in one workspace-scoped batch and
  retains a vendor-name fallback for legacy records (`DECISIONS.md` 047). `is_suppressed`
  exists on the model but is **not written by Phase 7** — see `DECISIONS.md` 020's addendum
  below.
- **Identified Risk** — `risk_id`, `control_id`, `severity`, `residual_score`,
  `remediation_owner`, `status`.

Ownership chain: `Workspace → Vendor → Engagement → Assessment → Response → Identified Risk`.

## 6. Boundaries that matter

1. **Tenant boundary.** `workspace_id` scopes every data-access path. The only sanctioned
   cross-workspace path is Cross-Workspace Document Sharing. **✅ BUILT (Phase 11)** —
   `lib/services/sharing.ts` reads/writes the `SharedDocument` model, unused since Phase 1.
   A share is a manual, explicit per-document grant (never implicit, never "share
   everything"); every read through it is unconditionally audit-logged
   (`sharing.document_read`), and authorization is re-verified from the database on every
   read, never trusted from whatever list the client is looking at. Verified by real HTTP
   request: a granted document downloads byte-identical from the authorized workspace and
   is refused (403) from an unrelated one; revoking immediately refuses a subsequent read.
2. **Vendor boundary.** An authenticated SPOC reaches exactly one vendor's assessments.
   This is the highest-risk surface in the system — it is externally reachable. **✅ BUILT
   (Phase 6)** — `PortalSessionPayload.vendorId` is set once at OTP-verify time from the
   matched challenge document, never from a request parameter, and every portal read
   re-derives it from the session cookie. Verified by real HTTP request with two vendors
   coexisting: one vendor's session lists exactly its own assessment even after a second
   vendor's assessment exists.
3. **Storage boundary.** One module resolves local-vs-S3. Feature code never sees the
   difference.
4. **Template immutability boundary.** Active and archived assessments must keep rendering
   against the exact template version they were answered under.
5. **Archive boundary.** Offboarding records, audit trails, and remediation logs are
   append-only. **✅ BUILT (Phase 10)** — `completeOffboarding()`
   (`lib/services/offboarding.ts`) is the sole writer of `status: 'archived'`; every write
   method on `OffboardingRepository` and `AssessmentRepository.archive()` filters its own
   query to exclude already-archived documents, and the Phase 8/9 risk/CAP-task write paths
   gained the same guard (`DECISIONS.md` 023) — verified by real HTTP request that a risk
   write against an archived assessment is refused with 403.

## 7. Architectural questions — resolved and remaining

Resolved 2026-08-13. Full rationale in `DECISIONS.md` 003–009; physical model in
`DATA-MODEL.md`; build sequence in `PLAN.md`.

- [x] **App Router or Pages Router?** App Router, with route groups `(internal)` and
      `(portal)`. Server Components for the internal console. → 004
- [x] **Driver or ODM?** Mongoose, plus Zod at the HTTP and env boundaries. → 004
- [x] **Tenancy model?** Shared database, `workspace_id` first in every index, enforced by a
      repository base that throws when constructed unscoped. → 003
- [x] **Where does OTP state live?** `otp_challenges` collection with a TTL index. The TTL
      sweep runs up to 60s late, so the explicit `expires_at` check remains mandatory. → see
      `DATA-MODEL.md` §2
- [x] **Scoring weights — code or `settings`?** In `workspace.settings`, versioned, and the
      resolved weights are snapshotted onto the engagement so historical scores stay
      reproducible. → 008
- [x] **Language?** TypeScript, strict. → 004
- [x] **UI stack?** Tailwind + shadcn/ui; Swiss/minimal; two densities. → 005,
      `DESIGN-SYSTEM.md`
- [x] **Are questionnaire templates workspace-scoped or global with overrides?**
      Workspace-scoped — `{workspace_id, template_key, version}` unique
      (`lib/db/models/questionnaire-template.ts`, already built in Phase 1). The "global
      seed library copied in on workspace creation" half of `PLAN.md`'s default was **not**
      built in Phase 5 — every workspace starts with zero templates; each must be authored
      per workspace via `/templates/new`. → Phase 5, `DECISIONS.md` 018
- [x] **Mailer abstraction with a console transport in dev?** Built exactly as `PLAN.md`'s
      default (`lib/mail/`) — Phase 6 needed it for OTPs. **Which real provider sends mail
      in production remains unanswered** — `MAIL_PROVIDER` only accepts `'console'`
      (`lib/env.ts`); adding a real transport is still a later, separate decision. → Phase 6

- [x] **Score authority — `FLOW.md` F4 gap.** `risk.residual_score` is authoritative and
      computed on risk write; `assessment.overall_score` is derived as the sum of the
      assessment's risks and recomputed in the same write. One writer, one direction — see
      `lib/services/assessment-review.ts`'s `raiseRisk()`/`updateRisk()`, verified by real
      HTTP request that the two never disagree. → Phase 8

- [x] **Background job runner for escalations, or request-driven?** Request-driven, exactly
      `PLAN.md` §1's stated default — `detectAndEscalateOverdueCaps()` runs on every
      `GET /api/risks/cap-tasks/overdue` call (e.g. the register page loading the overdue
      queue), not on a schedule. Idempotency is a stamped `cap_tasks[].escalated_at` field
      on the document itself, not a separate job-run ledger. → Phase 9, `DECISIONS.md` 022

- [x] **Retention period for archived assessments and audit trails?** `PLAN.md`'s own
      default — indefinite, nothing is deleted. Phase 10 built no retention/expiry logic at
      all; `AssessmentRepository`/`OffboardingRepository` expose no delete path, only
      `archive()`. A real retention policy remains a later, separate decision. → Phase 10

- [x] **Multi-user internal login and RBAC — `DECISIONS.md` 013's own named exit
      condition.** The `SUPER_ADMIN_EMAIL` gate is removed; any active `User` whose password
      matches now authenticates. Authorization is a four-role capability matrix
      (`lib/auth/rbac.ts`), resolved fresh from the database on every request
      (`lib/auth/current-membership.ts`), never cached in the signed session cookie — a role
      change takes effect on the very next request, not at next login. Verified by real HTTP
      request in both directions with no re-login. → Phase 11, `DECISIONS.md` 024
      (supersedes 013)

- [x] **`FLOW.md` F6's own named gap — is roll-up authorization checked once at the top or
      per workspace?** Per workspace, inside the aggregation loop
      (`getExecutiveRollup()`, `lib/services/executive-rollup.ts`) — a user with an `admin`
      role in one workspace and a `viewer` role in another gets a roll-up that includes the
      first and silently omits the second. Verified by real HTTP request with exactly that
      account shape. → Phase 11, `DECISIONS.md` 024

Still open, with defaults recorded in `PLAN.md` §1:

- [ ] S3 bucket, region, and is object versioning enabled? (blocks production only —
      `ROLLBACK.md` requires versioning confirmed before any prod storage write)
- [ ] Who owns the enterprise risk category taxonomy? Phase 8 shipped a seeded
      placeholder list (`DEFAULT_ENTERPRISE_RISK_CATEGORIES`,
      `lib/services/assessment-review.ts`), flagged `Provisional` in both the reviewer and
      register UI — `PLAN.md`'s own default, not a resolution of the question. Still open.
