import { type Types, type QueryFilter, type UpdateQuery } from "mongoose";
import { Vendor, type VendorDoc } from "@/lib/db/models/vendor";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export type VendorSpocEntryInput = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  is_primary: boolean;
  status: "active" | "inactive";
};
export type VendorSpocFields = { name: string; email: string; phone: string };
export type VendorDocumentInput = {
  _id: Types.ObjectId;
  key: string;
  filename: string;
  mime: string;
  size: number;
  uploaded_by: Types.ObjectId;
  uploaded_at: Date;
};

/**
 * First concrete repository, built in Phase 1 to prove out and test the tenant guard
 * (DATA-MODEL.md §1). Phase 3 extends this with the intake-specific write path. Phase 4
 * adds SPOC editing and document-metadata writes (DECISIONS.md 017) — both still route
 * through `scope()` via the inherited `updateOne`, so a workspace-B vendor id can't be
 * targeted from a workspace-A session.
 */
export class VendorRepository extends TenantRepository<VendorDoc> {
  constructor(ctx: TenantContext) {
    super(Vendor, ctx);
  }

  /** ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — the legacy `spoc` object above is never written
   * by this repository again; every SPOC write from here on targets `spocs[]`. */
  addSpoc(vendorId: string | Types.ObjectId, spoc: VendorSpocEntryInput) {
    return this.updateOne(
      { _id: toObjectId(vendorId) } as QueryFilter<VendorDoc>,
      { $push: { spocs: spoc } } as UpdateQuery<VendorDoc>,
    );
  }

  updateSpocFields(
    vendorId: string | Types.ObjectId,
    spocId: string | Types.ObjectId,
    fields: Partial<VendorSpocFields>,
  ) {
    const setFields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      setFields[`spocs.$[spoc].${key}`] = value;
    }
    return this.model.updateOne(
      this.scope({ _id: toObjectId(vendorId) } as QueryFilter<VendorDoc>),
      { $set: setFields } as UpdateQuery<VendorDoc>,
      { arrayFilters: [{ "spoc._id": toObjectId(spocId) }] },
    );
  }

  setSpocStatus(
    vendorId: string | Types.ObjectId,
    spocId: string | Types.ObjectId,
    status: "active" | "inactive",
  ) {
    return this.model.updateOne(
      this.scope({ _id: toObjectId(vendorId) } as QueryFilter<VendorDoc>),
      {
        $set: { "spocs.$[spoc].status": status },
      } as UpdateQuery<VendorDoc>,
      { arrayFilters: [{ "spoc._id": toObjectId(spocId) }] },
    );
  }

  /**
   * Exactly one `is_primary: true` at a time — a `$map` pipeline update over the whole
   * array is what makes that atomic; two sequential `$set`s (unset all, then set one)
   * would have a window where a concurrent read sees zero or two primaries.
   */
  setPrimarySpoc(
    vendorId: string | Types.ObjectId,
    spocId: string | Types.ObjectId,
  ) {
    return this.model.updateOne(
      this.scope({ _id: toObjectId(vendorId) }),
      [
        {
          $set: {
            spocs: {
              $map: {
                input: "$spocs",
                as: "s",
                in: {
                  $mergeObjects: [
                    "$$s",
                    { is_primary: { $eq: ["$$s._id", toObjectId(spocId)] } },
                  ],
                },
              },
            },
          },
        },
      ],
      // Mongoose 9 requires this explicitly before it will accept an aggregation
      // pipeline (an array) as the update argument, rather than a plain UpdateQuery.
      { updatePipeline: true },
    );
  }

  addDocument(
    vendorId: string | Types.ObjectId,
    document: VendorDocumentInput,
  ) {
    return this.updateOne(
      { _id: toObjectId(vendorId) } as QueryFilter<VendorDoc>,
      {
        $push: { documents: document },
      } as UpdateQuery<VendorDoc>,
    );
  }
}
