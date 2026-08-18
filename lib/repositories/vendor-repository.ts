import { type Types, type QueryFilter, type UpdateQuery } from "mongoose";
import { Vendor, type VendorDoc } from "@/lib/db/models/vendor";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export type VendorSpocInput = {
  spoc_name: string;
  spoc_email: string;
  spoc_phone: string;
};
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

  updateSpoc(vendorId: string | Types.ObjectId, spoc: VendorSpocInput) {
    return this.updateOne(
      { _id: toObjectId(vendorId) } as QueryFilter<VendorDoc>,
      {
        $set: { spoc },
      } as UpdateQuery<VendorDoc>,
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
