import { type Types, type QueryFilter, type UpdateQuery } from "mongoose";
import {
  QuestionnaireTemplate,
  type QuestionnaireTemplateDoc,
} from "@/lib/db/models/questionnaire-template";
import { TenantRepository } from "./base";
import { toObjectId, type TenantContext } from "@/lib/tenant/context";

export type TemplateDraftUpdate = {
  name: string;
  description: string;
  questions_schema: unknown;
};

/**
 * CONSTRAINTS.md #11: a published (or archived) version is immutable. `updateDraft()`
 * scopes its own filter to `status: 'draft'`, so the write is structurally impossible
 * against a published/archived document — not merely gated by the service checking first.
 * A stale-status race (two requests, one publishes between the other's read and write)
 * still ends with `matchedCount === 0` here rather than a silent mutation; the service
 * layer (lib/services/questionnaire-templates.ts) turns that into a clear error.
 */
export class TemplateRepository extends TenantRepository<QuestionnaireTemplateDoc> {
  constructor(ctx: TenantContext) {
    super(QuestionnaireTemplate, ctx);
  }

  findByTemplateKey(templateKey: string) {
    return this.find({
      template_key: templateKey,
    } as QueryFilter<QuestionnaireTemplateDoc>).sort({
      version: -1,
    });
  }

  findLatestVersion(templateKey: string) {
    return this.findOne({
      template_key: templateKey,
    } as QueryFilter<QuestionnaireTemplateDoc>)
      .sort({ version: -1 })
      .limit(1);
  }

  updateDraft(id: string | Types.ObjectId, update: TemplateDraftUpdate) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        status: "draft",
      } as QueryFilter<QuestionnaireTemplateDoc>,
      { $set: update } as UpdateQuery<QuestionnaireTemplateDoc>,
    );
  }

  publish(id: string | Types.ObjectId, publishedBy: Types.ObjectId) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        status: "draft",
      } as QueryFilter<QuestionnaireTemplateDoc>,
      {
        $set: {
          status: "published",
          published_at: new Date(),
          published_by: publishedBy,
        },
      } as UpdateQuery<QuestionnaireTemplateDoc>,
    );
  }

  archive(id: string | Types.ObjectId) {
    return this.updateOne(
      {
        _id: toObjectId(id),
        status: { $in: ["draft", "published"] },
      } as QueryFilter<QuestionnaireTemplateDoc>,
      { $set: { status: "archived" } } as UpdateQuery<QuestionnaireTemplateDoc>,
    );
  }
}
