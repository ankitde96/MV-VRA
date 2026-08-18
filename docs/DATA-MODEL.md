# DATA-MODEL.md — MV-VRA MongoDB Schema Design

> Companion to `PLAN.md`. Derived from `VRA MVP Feature Specification.md` §3, expanded into
> a physical model with indexes, tenancy enforcement, and the `questions_schema` format.
>
> **STATUS: DESIGN — NOT YET BUILT (2026-08-13).** No collection exists. Field names below
> are the contract Phase 1 implements; correct this file rather than the code if they drift.

---

## 1. Tenancy model and how it is enforced

**Shared database, `workspace_id` discriminator on every tenant-scoped collection.**

The isolation guarantee is application-level, which means the _code_ is the security
boundary. Three mechanisms make that survivable:

1. **`workspace_id` is the first field of every index** on a tenant collection. A query
   without it cannot use an index, so a missing filter degrades loudly (collection scan)
   rather than quietly returning another tenant's data.
2. **Models are never queried outside a repository.** The repository base takes a
   `TenantContext` in its constructor and injects `workspace_id` into every filter, update,
   and aggregation pipeline. There is no method that accepts a raw filter.
3. **An unscoped call throws.** Constructing a repository without a `TenantContext` raises
   `TenantScopeError` at runtime. It is not a lint warning; it is a crash.

```ts
// lib/repositories/base.ts — conceptual shape
//
// Every tenant-scoped repository extends this. The point is not convenience: it is that
// there is no code path that reaches a model without a workspace_id, so "forgot the tenant
// filter" is not a mistake a future session can make by omission.
abstract class TenantRepository<T> {
  constructor(protected readonly ctx: TenantContext) {
    if (!ctx?.workspace_id)
      throw new TenantScopeError("repository constructed unscoped");
  }
  protected scope(filter: Filter<T> = {}) {
    return { ...filter, workspace_id: this.ctx.workspace_id };
  }
}
```

**Collections that are deliberately NOT tenant-scoped:** `users` (a user may belong to
several workspaces), `mitigation_guidance` (a global library), and `shared_documents`
(which exists precisely to cross the boundary, and carries its own explicit grant list).

---

## 2. Collections

Types are indicative. `ObjectId` refs are stored as `ObjectId`, not strings.

### `workspaces`

Root of all isolation. Not tenant-scoped — it _is_ the tenant.

| Field                                 | Type      | Notes                                                      |
| ------------------------------------- | --------- | ---------------------------------------------------------- |
| `_id`                                 | ObjectId  | the `workspace_id` everything else references              |
| `entity_name`                         | string    | e.g. "MoneyView India"                                     |
| `slug`                                | string    | URL-safe, unique                                           |
| `parent_workspace_id`                 | ObjectId? | null for the corporate root; enables the roll-up hierarchy |
| `settings.risk_weights`               | object    | inherent-scoring weights — see §4                          |
| `settings.weights_version`            | int       | bumped on any weight change; never reused                  |
| `settings.tier_thresholds`            | object    | `{ tier1_min, tier2_min }`                                 |
| `settings.enterprise_risk_categories` | string[]  | taxonomy for register mapping                              |
| `status`                              | enum      | `active` \| `suspended`                                    |
| `created_at`                          | Date      |                                                            |

Indexes: `{ slug: 1 }` unique · `{ parent_workspace_id: 1 }`

---

### `users`

Internal users only. Vendor SPOCs are _not_ users — they live on the vendor document and
authenticate by OTP. Keeping them in separate collections means there is no code path where
a vendor could be resolved into an internal principal.

| Field           | Type     | Notes                                                                                          |
| --------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `_id`           | ObjectId |                                                                                                |
| `email`         | string   | unique                                                                                         |
| `name`          | string   |                                                                                                |
| `password_hash` | string   | argon2. Dev super-admin only; SSO replaces this post-MVP                                       |
| `memberships`   | array    | `[{ workspace_id, role }]` — `role`: `admin` \| `risk_analyst` \| `business_owner` \| `viewer` |
| `status`        | enum     | `active` \| `disabled`                                                                         |

Indexes: `{ email: 1 }` unique · `{ 'memberships.workspace_id': 1 }`

---

### `vendors`

| Field                       | Type     | Notes                                                        |
| --------------------------- | -------- | ------------------------------------------------------------ |
| `_id`                       | ObjectId |                                                              |
| `workspace_id`              | ObjectId |                                                              |
| `legal_name`                | string   |                                                              |
| `domain`                    | string   | primary web domain; the join key for cross-workspace sharing |
| `spoc`                      | subdoc   | `{ spoc_name, spoc_email, spoc_phone }`                      |
| `inherent_risk_tier`        | enum?    | `1` \| `2` \| `3` \| **`null`** — see §4                     |
| `lifecycle_status`          | enum     | `prospective` \| `active` \| `offboarding` \| `terminated`   |
| `created_at` / `updated_at` | Date     |                                                              |

Indexes:
`{ workspace_id: 1, legal_name: 1 }` ·
`{ workspace_id: 1, domain: 1 }` unique ·
`{ workspace_id: 1, inherent_risk_tier: 1, lifecycle_status: 1 }` (inventory filters) ·
`{ 'spoc.spoc_email': 1 }` — **not** workspace-prefixed, because OTP login resolves an email
before any workspace is known. This is the one deliberate exception, and it is why the OTP
lookup must return a constant response regardless of match (`FLOW.md` F2).

---

### `engagements`

A vendor may have several engagements; the tier is scored per engagement and reflected up.

| Field                              | Type     | Notes                                                                                                                    |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `_id`, `workspace_id`, `vendor_id` |          |                                                                                                                          |
| `business_owner_id`                | ObjectId | ref `users`                                                                                                              |
| `business_unit`                    | string   |                                                                                                                          |
| `functional_scope`                 | string   |                                                                                                                          |
| `expected_procurement_date`        | Date     |                                                                                                                          |
| `data_classification`              | string[] | `pii` \| `phi` \| `financial` \| `none`                                                                                  |
| `intake_responses`                 | object   | raw form answers, kept verbatim for audit                                                                                |
| `inherent_score`                   | subdoc   | `{ total, breakdown: {factor: points}, weights_version, weights_snapshot }`                                              |
| `inherent_risk_tier`               | enum?    | `1`\|`2`\|`3`\|`null`                                                                                                    |
| `status`                           | enum     | `draft` \| `submitted` \| **`scoring_failed`** \| `tiered` \| `in_assessment` \| `assessed` \| `offboarding` \| `closed` |

Indexes: `{ workspace_id: 1, vendor_id: 1 }` · `{ workspace_id: 1, status: 1 }` ·
`{ workspace_id: 1, inherent_risk_tier: 1 }`

**`weights_snapshot` is not redundant.** Weights live in `workspace.settings` and will
change. Without the snapshot, a score computed in March cannot be explained in November,
and re-running history silently produces different numbers.

---

### `questionnaire_templates`

| Field                          | Type   | Notes                                    |
| ------------------------------ | ------ | ---------------------------------------- |
| `_id`, `workspace_id`          |        |                                          |
| `template_key`                 | string | stable across versions                   |
| `version`                      | int    | 1, 2, 3…                                 |
| `name`, `description`          | string |                                          |
| `status`                       | enum   | `draft` \| `published` \| `archived`     |
| `questions_schema`             | object | see §3                                   |
| `schema_format_version`        | int    | version of the _format_, not the content |
| `published_at`, `published_by` |        |                                          |

Indexes: `{ workspace_id: 1, template_key: 1, version: -1 }` unique ·
`{ workspace_id: 1, status: 1 }`

Published documents are immutable. Enforced in the repository (no update path when
`status === 'published'`) rather than only by convention.

---

### `assessments`

| Field                                               | Type    | Notes                                                                                            |
| --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `_id`, `workspace_id`, `engagement_id`, `vendor_id` |         |                                                                                                  |
| `template_id`, `template_version`                   |         | provenance reference                                                                             |
| **`template_snapshot`**                             | object  | **frozen copy of `questions_schema`**                                                            |
| `status`                                            | enum    | `draft` \| `sent` \| `in_progress` \| `submitted` \| `under_review` \| `completed` \| `archived` |
| `overall_score`                                     | number? | **derived**, recomputed from constituent risks                                                   |
| `assigned_at`, `submitted_at`, `reviewed_at`        | Date    |                                                                                                  |

Indexes: `{ workspace_id: 1, engagement_id: 1 }` · `{ workspace_id: 1, status: 1 }` ·
`{ workspace_id: 1, vendor_id: 1, status: 1 }`

**Why snapshot rather than reference.** `CONSTRAINTS.md` #11 requires historical assessments
to keep rendering exactly as answered. A `template_id + version` reference satisfies that
only while the template document is intact and the renderer's interpretation of the format
is unchanged. Embedding the schema makes correct rendering a property of the assessment
itself. The cost is duplication measured in kilobytes; the benefit is that Gate 5 cannot be
broken by a future template migration.

---

### `responses`

Separate collection, not an embedded array — matching spec §3, and for three practical
reasons: portal autosave writes one control at a time (no whole-document contention),
evidence metadata would inflate the assessment document toward the 16 MB ceiling, and a
reviewer's per-control queries stay cheap.

| Field                                  | Type    | Notes                                                            |
| -------------------------------------- | ------- | ---------------------------------------------------------------- |
| `_id`, `workspace_id`, `assessment_id` |         |                                                                  |
| `control_id`                           | string  | matches a question id in the snapshot                            |
| `question_text`                        | string  | snapshotted at answer time                                       |
| `response_value`                       | mixed   | shape depends on question type                                   |
| `evidence`                             | array   | `[{ file_key, filename, mime, size, uploaded_at, uploaded_by }]` |
| `is_suppressed`                        | boolean | true when conditional logic hid the question                     |
| `answered_at`, `answered_by`           |         |                                                                  |

Indexes: `{ workspace_id: 1, assessment_id: 1, control_id: 1 }` unique — the uniqueness is
what makes autosave an idempotent upsert.

**`is_suppressed` is load-bearing.** It is what lets the validator distinguish "not answered
because hidden" from "not answered because skipped" — the deadlock at `FLOW.md` F3.

---

### `risks`

| Field                                                                | Type   | Notes                                                                                              |
| -------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `_id`, `workspace_id`, `assessment_id`, `engagement_id`, `vendor_id` |        |                                                                                                    |
| `control_id`, `title`, `description`                                 |        |                                                                                                    |
| `severity`                                                           | enum   | `critical` \| `high` \| `medium` \| `low`                                                          |
| `enterprise_risk_category`                                           | string | from `workspace.settings` taxonomy                                                                 |
| `impact_level`                                                       | enum   |                                                                                                    |
| `residual_score`                                                     | number | **authoritative**, computed on write                                                               |
| `residual_inputs`                                                    | object | verified controls, compensating measures, weights version                                          |
| `cap_tasks`                                                          | array  | `[{ task_id, description, owner_type: internal\|vendor, owner_ref, due_date, status, closed_at }]` |
| `status`                                                             | enum   | `open` \| `mitigating` \| `accepted` \| `closed`                                                   |

Indexes: `{ workspace_id: 1, status: 1, severity: 1 }` ·
`{ workspace_id: 1, vendor_id: 1 }` ·
`{ workspace_id: 1, 'cap_tasks.due_date': 1, 'cap_tasks.status': 1 }` (overdue queue)

CAPs are embedded because they are always read with their risk and never queried
independently of one. If CAP reporting later needs to span risks, that is the trigger to
split them out — not before.

---

### `otp_challenges`

| Field                       | Type   | Notes                                                                |
| --------------------------- | ------ | -------------------------------------------------------------------- |
| `email`                     | string |                                                                      |
| `vendor_id`, `workspace_id` |        | resolved at issue time, never client-supplied                        |
| `code_hash`                 | string | HMAC-SHA256 of the code with a server secret, constant-time compared |
| `expires_at`                | Date   | **TTL index**                                                        |
| `attempts`                  | int    | capped                                                               |
| `consumed_at`               | Date?  | set on success — single use, no replay                               |
| `request_ip`                | string |                                                                      |

Indexes: `{ expires_at: 1 }` with `expireAfterSeconds: 0` · `{ email: 1, created_at: -1 }`

The TTL index means expired challenges disappear without a cleanup job. It does **not**
replace the explicit expiry check — TTL deletion runs on a background sweep up to 60s late,
so the code must still compare `expires_at` itself.

---

### `offboardings`

| Field                                               | Type    | Notes                                                    |
| --------------------------------------------------- | ------- | -------------------------------------------------------- |
| `_id`, `workspace_id`, `engagement_id`, `vendor_id` |         |                                                          |
| `checklist`                                         | array   | `[{ item_id, label, owner_id, status, completed_at }]`   |
| `destruction_certificate`                           | subdoc? | `{ file_key, uploaded_at, verified_by, verified_at }`    |
| `asset_return_attestation`                          | subdoc? | same shape                                               |
| `status`                                            | enum    | `initiated` \| `in_progress` \| `verified` \| `archived` |

Indexes: `{ workspace_id: 1, engagement_id: 1 }` unique · `{ workspace_id: 1, status: 1 }`

---

### `audit_events`

Append-only. No update, no delete — the repository exposes neither.

| Field                      | Type      | Notes                                                              |
| -------------------------- | --------- | ------------------------------------------------------------------ |
| `workspace_id`             | ObjectId? | null for cross-workspace and system events                         |
| `actor`                    | subdoc    | `{ type: internal\|vendor\|system, id, email }`                    |
| `action`                   | string    | e.g. `assessment.submitted`                                        |
| `entity_type`, `entity_id` |           |                                                                    |
| `diff`                     | object?   | changed fields only — **never** raw PII/PHI values (assumption A4) |
| `at`                       | Date      |                                                                    |
| `request_ip`               | string    |                                                                    |

Indexes: `{ workspace_id: 1, at: -1 }` · `{ entity_type: 1, entity_id: 1, at: -1 }`

---

### `mitigation_guidance`

Global seed library, not tenant-scoped. `{ control_pattern, failure_condition, suggested_remediation, references[] }`.
Index: `{ control_pattern: 1 }`.

### `shared_documents`

The one sanctioned cross-tenant read path.
`{ owner_workspace_id, vendor_domain, document_ref, shared_with: [workspace_id], granted_by, granted_at, expires_at? }`.
Index: `{ vendor_domain: 1, shared_with: 1 }`. Every read through it writes an
`audit_events` entry — a cross-boundary read is never silent.

---

## 3. `questions_schema` format

The contract between the template builder, the portal renderer, the conditional-logic
evaluator, and every frozen snapshot. Versioned by `schema_format_version` so the evaluator
can keep reading old snapshots after the format evolves.

```jsonc
{
  "schema_format_version": 1,
  "sections": [
    {
      "id": "sec_hosting",
      "title": "Hosting & Infrastructure",
      "questions": [
        {
          "control_id": "HOST-01", // stable; the join key for responses & risks
          "text": "Where is the application hosted?",
          "type": "single_select", // text | textarea | single_select |
          // multi_select | boolean | number | date | file
          "options": ["Cloud", "On-premise", "Hybrid"],
          "required": true,
          "evidence": { "required": false, "accept": ["pdf", "png"] },
        },
        {
          "control_id": "HOST-02",
          "text": "Which cloud provider?",
          "type": "single_select",
          "options": ["AWS", "Azure", "GCP", "Other"],
          "required": true,
          "show_if": {
            // absent ⇒ always shown
            "all": [
              {
                "control_id": "HOST-01",
                "op": "in",
                "value": ["Cloud", "Hybrid"],
              },
            ],
          },
          "evidence": { "required": true, "accept": ["pdf"] },
        },
      ],
    },
  ],
}
```

**Conditional-logic rules, fixed now to avoid ambiguity later:**

- `show_if` supports `all` (AND) and `any` (OR), each an array of conditions. Nesting is one
  level deep — deliberately. Arbitrary nesting is a small feature to build and a large one
  to make comprehensible in a builder UI. YAGNI.
- Operators: `eq`, `neq`, `in`, `not_in`, `gt`, `lt`, `is_answered`, `is_empty`.
- A condition referencing an unanswered question evaluates **false** — the dependent
  question stays hidden until its parent is answered.
- **Suppression cascades.** If a question is hidden, every question conditioned on it is
  also hidden, evaluated top-to-bottom in declaration order. Forward references are rejected
  at publish time, which is what makes single-pass evaluation safe.
- A suppressed question is written with `is_suppressed: true` and is **skipped by the
  validator**, regardless of `required`.

---

## 4. Scoring, and the fail-loud rule

**Inherent risk** = weighted sum over data types processed, network exposure, system access
level, and business redundancy. Weights come from `workspace.settings.risk_weights`, and
both the version and the resolved weights are snapshotted onto the engagement.

**Tiering** compares the total against `workspace.settings.tier_thresholds`.

**The rule that matters** (`FLOW.md` F1, `TEST-CHECKLIST.md` Gate 2):

> If any scoring input is missing or unmappable, the engine returns a failure — it does
> **not** return a score. `inherent_risk_tier` stays `null`, the engagement moves to
> `scoring_failed`, and it surfaces in a triage queue.

`inherent_risk_tier` has **no schema default**. A scoring bug therefore appears as a visible
missing tier, not as a silent Tier 3 — an under-assessed high-risk vendor is the worst
failure this system can produce, and it is the one that would never be noticed.

**Residual risk** = inherent score adjusted by verified controls and compensating measures.
`risk.residual_score` is authoritative and written first; `assessment.overall_score` is
derived from the set of risks and recomputed in the same operation. One writer, one
direction (resolves the `FLOW.md` F4 gap).

---

## 5. Consistency, transactions, and integrity

MongoDB gives atomicity per document. Three places need more than that:

| Operation       | Spans                                 | Approach                                                                                                                                                                                            |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake submit   | `vendors` + `engagements`             | Multi-document transaction (requires a replica set — **use one even in dev**, single-node replica set via `mongod --replSet`).                                                                      |
| Evidence upload | `responses` + object storage          | Write the response record first, then the file, then patch the key. A file with no owning record is a sweepable orphan; a record pointing at a missing file is a broken UI. Fail toward the orphan. |
| Risk write      | `risks` + `assessments.overall_score` | Same transaction. The derived score is never written by anything else.                                                                                                                              |

Referential integrity is application-enforced. Deletes are avoided entirely: vendors and
engagements move through `lifecycle_status`/`status`, and archives are append-only. The
system has no hard-delete path, which is also what makes `CONSTRAINTS.md` #3 easy to honour.

---

## 6. Index and migration policy

- Indexes are declared on the model and applied by an **explicit** `npm run db:indexes`
  script. `autoIndex` is off outside development — an unexpected index build on a
  production write path is a stall.
- Every migration ships with a tested down-path, or a `mongodump` taken first
  (`ROLLBACK.md`).
- Adding a field: additive, no migration, tolerate `undefined` on read.
- Changing the meaning of a field: not permitted on a collection with existing documents —
  add a new field and migrate readers.
- `schema_format_version` on templates exists so the questionnaire format can evolve without
  ever rewriting a frozen snapshot.
