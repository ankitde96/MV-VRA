# FUTURE-IDEAS.md — Post-MVP ideas and deferred work

> Canonical holding area for ideas that are intentionally **not committed development
> work**. Nothing in this file is approved for implementation merely because it is listed.
> Before starting an item, confirm scope, priority, acceptance criteria, and rollback needs.
>
> Consolidated on 2026-08-20 from the MVP specification, `PLAN.md`, `ARCHITECTURE.md`,
> `ASSESSMENT-WORKFLOW-PLAN.md`, `HANDOVER.md`, and feature-trace follow-ups. Completed or
> superseded historical gaps were deliberately excluded.

> **Ranked companion:** `docs/OPPORTUNITY-MAP.md` (2026-08-20) argues priority, effort, and
> triggers over this inventory and adds domain-feature ideas not listed here. This file
> remains the canonical holding area; that one is opinion, not approval.

## 1. Operational hardening

- Store evidence in S3-compatible storage outside development. Configure the production
  bucket and region, require object versioning before the first production write, and test
  the existing S3 driver against the real environment.
- Add virus scanning and stricter file validation.
- Define evidence retention and deletion policies, including archived assessments and audit
  trails. Current behavior retains records indefinitely.
- Move email delivery to background processing with retry tracking. Decide whether the same
  job runner should own scheduled CAP escalation checks; the current implementation is
  request-driven.
- Build an audit-log viewer for assessment activity.
- Document and test database backup and restore procedures, including a real `mongodump`
  restore exercise.
- Select and integrate a production transactional-email provider for OTP, questionnaire,
  correction-round, and CAP-escalation messages. The current transport is console-only.
- Complete production platform configuration: managed secrets, HTTPS, security headers, and
  an explicit CORS policy.
- Run an audit-event completeness pass over every mutating service.
- Establish credential rotation and operational secret-management procedures.

## 2. Explicitly parked product areas

These eight areas come directly from the MVP specification's future roadmap:

1. AI-powered evidence analysis and questionnaire generation using OCR/RAG with traceable
   citations and assisted questionnaire completion.
2. Google Workspace SSO for internal users.
3. Automated vendor/application inventory discovery from identity providers and CMDBs such
   as Okta and Azure AD.
4. An AI copilot for conversational GRC queries, aggregation, and automated risk triage.
5. A control-framework library with mappings and crosswalks among SOC 2, ISO 27001, NIST
   CSF, and similar standards.
6. Continuous monitoring and threat intelligence, including outside-in security ratings,
   dark-web exposure, and sanctions screening.
7. Contract lifecycle and SLA performance tracking, including uptime, response time, cure
   periods, and financial penalties.
8. Bidirectional integrations with ticketing, engineering, HR, and ERP systems such as Jira,
   Azure DevOps, and Workday.

## 3. Assessment and evidence workflow ideas

- Revisit archive evidence only after payload inspection/virus scanning exists. CSV and TXT
  are accepted with MIME/extension agreement as of reviewer-experience Stage 1; ZIP remains
  rejected because archives hide their payloads.
- Decide whether questionnaire resend rounds need a configurable maximum. `review_round`
  already provides the data needed to enforce one.
- Support larger evidence artifacts with multipart/chunked uploads if the current
  single-digit-megabyte assumption stops holding.
- Consider richer conditional logic that combines `all` and `any` groups if a real template
  requires it; schema format v1 intentionally permits exactly one group.
- Remove the legacy singular `vendor.spoc` field and its obsolete index after confirming all
  deployed data has been migrated to `vendor.spocs[]`.
- Add a global seed-template library copied into new workspaces, or define a controlled
  global-template plus workspace-override model. Workspaces currently start without an
  automatically copied template library.

## 4. Risk, taxonomy, and analytics ideas

- Establish ownership and governance for the enterprise risk-category taxonomy; optionally
  add a taxonomy editor. The application currently falls back to a provisional seeded list.
- Make the evidence-gap KRI exact by joining assessment snapshots to response evidence
  requirements instead of treating every answered response without evidence as a gap.
- Add a cross-workspace document-share reuse KRI.
- Add control-domain coverage analytics or a radar view after defining a trustworthy mapping
  from risks and questionnaire controls to control domains.
- Expand mitigation guidance beyond the current thin seeded library when real failure data
  identifies the highest-value mappings.

## 5. Identity and administration ideas

- Add email-based invitations and activation for internal users instead of requiring an
  administrator to set the initial password directly.
- Design purpose-built viewer-role experiences rather than relying only on existing
  capability restrictions.
- Consider short-lived membership caching only if profiling shows the database read on every
  authorization check is material. Never cache the role in the signed session cookie.

## 6. Accessibility and interface follow-ups

- Run a dedicated accessibility pass on the locked risk-severity palette; the light-mode
  critical/high pair has a documented contrast/distinguishability concern.
- Add automated accessibility checks with axe and/or Lighthouse CI.
- Add responsive screenshot or visual-regression testing for supported viewport sizes.
- Revisit the design system's proposed compact/comfortable density modes; two-density layouts
  are not currently implemented.
- Finish standardizing remaining mutation surfaces that still use older persistent-alert
  error patterns where a toast or field-local error would be more appropriate.
- Consider purpose-built `ScoreBreakdown`, `AssessmentProgress`, `ResponseReviewPane`,
  `OffboardingChecklist`, and `CapTaskList` components if reuse or maintenance pressure
  justifies the extra abstraction.

## 7. Scale and deployment triggers

These are conditional responses to assumptions breaking, not near-term backlog items:

- Add shared session/rate-limit state before deploying multiple application instances; the
  current OTP limiter is in-memory and process-local.
- Add high-availability and redundancy work if the business-hours-best-effort availability
  target changes.
- Revisit shared-database tenancy, sharding, and read replicas if usage grows beyond tens of
  workspaces, low thousands of vendors, and low tens of thousands of assessments.
- Profile authorization and analytics queries before adding caches; use short TTLs and retain
  fresh database authorization as the security authority.
- Revisit log and fixture handling if the system begins processing PII or PHI in places where
  the current plan assumes none.

## Source map

- `VRA MVP Feature Specification.md` §4 — eight parked product areas.
- `docs/PLAN.md` open questions and Phase 12 — production, email, jobs, retention, backups.
- `docs/ARCHITECTURE.md` §7 — unresolved production transport, retention, and template seed
  library decisions.
- `docs/ASSESSMENT-WORKFLOW-PLAN.md` §7 — evidence formats, legacy SPOC cleanup, resend cap.
- `docs/HANDOVER.md` — accessibility, analytics, and current-scope exclusions.
- `docs/features/ui-revamp.md` and Phase 4/11 feature traces — UI, S3, invitations, and scale
  follow-ups.
