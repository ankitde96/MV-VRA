import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * questions_schema is stored as-is (Mixed) — its internal shape is the contract defined in
 * DATA-MODEL.md §3, validated by application code (Zod) at write time, not by a Mongoose
 * sub-schema. Publishing freezes the version; the repository layer (not this file) refuses
 * to update a document once status === 'published' — CONSTRAINTS.md #11.
 */
const templateSchema = new Schema(
  {
    workspace_id: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    template_key: { type: String, required: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    questions_schema: { type: Schema.Types.Mixed, required: true },
    schema_format_version: { type: Number, required: true, default: 1 },
    published_at: { type: Date, default: null },
    published_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } as const },
);

templateSchema.index(
  { workspace_id: 1, template_key: 1, version: -1 },
  { unique: true },
);
templateSchema.index({ workspace_id: 1, status: 1 });

export type QuestionnaireTemplateDoc = InferSchemaType<typeof templateSchema>;
export const QuestionnaireTemplate: Model<QuestionnaireTemplateDoc> =
  models.QuestionnaireTemplate ??
  model<QuestionnaireTemplateDoc>("QuestionnaireTemplate", templateSchema);
