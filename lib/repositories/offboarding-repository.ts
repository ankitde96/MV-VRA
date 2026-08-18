import {
  Types,
  type ClientSession,
  type QueryFilter,
  type UpdateQuery,
} from "mongoose";
import { Offboarding, type OffboardingDoc } from "@/lib/db/models/offboarding";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export type ChecklistItemInput = {
  item_id: Types.ObjectId;
  label: string;
  owner_id: Types.ObjectId;
  status: "pending" | "in_progress" | "done";
  completed_at: Date | null;
};

export type CertificateInput = {
  file_key: string;
  uploaded_at: Date;
  verified_by: Types.ObjectId | null;
  verified_at: Date | null;
};

export type CertificateKind =
  "destruction_certificate" | "asset_return_attestation";

const NOT_ARCHIVED = { status: { $ne: "archived" } };

/**
 * CONSTRAINTS.md #12 — archived records are append-only. Rather than trust every future
 * caller to check `status` first, every write method here scopes its own filter to
 * `status !== 'archived'` (or an explicit allow-list of *from* statuses for
 * `advanceStatus()`), the same structural-immutability mechanism `TemplateRepository` uses
 * for published templates (`lib/repositories/template-repository.ts`). Once
 * `completeOffboarding()` flips a document to `archived`, every method below matches zero
 * documents against it — not merely discouraged by a service-layer check.
 */
export class OffboardingRepository extends TenantRepository<OffboardingDoc> {
  constructor(ctx: TenantContext) {
    super(Offboarding, ctx);
  }

  findByEngagement(engagementId: string | Types.ObjectId) {
    return this.findOne({
      engagement_id: toObjectId(engagementId),
    } as QueryFilter<OffboardingDoc>);
  }

  pushChecklistItem(id: Types.ObjectId | string, item: ChecklistItemInput) {
    return this.model.updateOne(
      this.scope({
        _id: toObjectId(id),
        ...NOT_ARCHIVED,
      } as QueryFilter<OffboardingDoc>),
      { $push: { checklist: item } } as UpdateQuery<OffboardingDoc>,
    );
  }

  updateChecklistItemFields(
    id: Types.ObjectId | string,
    itemId: Types.ObjectId | string,
    fields: Record<string, unknown>,
  ) {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      setFields[`checklist.$[item].${key}`] = value;
    }
    return this.model.updateOne(
      this.scope({
        _id: toObjectId(id),
        ...NOT_ARCHIVED,
      } as QueryFilter<OffboardingDoc>),
      { $set: setFields } as UpdateQuery<OffboardingDoc>,
      { arrayFilters: [{ "item.item_id": toObjectId(itemId) }] },
    );
  }

  setCertificate(
    id: Types.ObjectId | string,
    kind: CertificateKind,
    certificate: CertificateInput,
  ) {
    return this.updateOne(
      { _id: toObjectId(id), ...NOT_ARCHIVED } as QueryFilter<OffboardingDoc>,
      { $set: { [kind]: certificate } } as UpdateQuery<OffboardingDoc>,
    );
  }

  /**
   * Filter requires the certificate's `file_key` to already exist — verifying an
   * unuploaded certificate is a service-layer 422, not a silent no-op write here.
   */
  verifyCertificate(
    id: Types.ObjectId | string,
    kind: CertificateKind,
    verifiedBy: Types.ObjectId,
  ) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        [`${kind}.file_key`]: { $exists: true },
        ...NOT_ARCHIVED,
      } as QueryFilter<OffboardingDoc>,
      {
        $set: {
          [`${kind}.verified_by`]: verifiedBy,
          [`${kind}.verified_at`]: new Date(),
        },
      } as UpdateQuery<OffboardingDoc>,
    );
  }

  advanceStatus(
    id: Types.ObjectId | string,
    fromStatuses: string[],
    toStatus: string,
    opts?: { session?: ClientSession },
  ) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        status: { $in: fromStatuses },
      } as QueryFilter<OffboardingDoc>,
      { $set: { status: toStatus } } as UpdateQuery<OffboardingDoc>,
      opts,
    );
  }
}
