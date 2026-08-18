import { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { TemplateRepository } from "@/lib/repositories/template-repository";
import { recordAuditEvent } from "@/lib/audit/record-event";
import { validateQuestionsSchemaStructure } from "@/lib/questionnaire/validate-schema";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import type { TenantContext } from "@/lib/tenant/context";

export interface TemplateInput {
  name: string;
  description: string;
  questions_schema: QuestionsSchema;
}

/**
 * PLAN.md Phase 5: draft -> published -> archived lifecycle. Zod validates the wire shape
 * of `questions_schema` at the HTTP boundary (app/api/templates/**); this file owns the
 * structural rules Zod can't express (validateQuestionsSchemaStructure) and the lifecycle
 * rules CONSTRAINTS.md #11 requires — a published/archived version is never mutated in
 * place, only versioned forward.
 */
export async function listTemplates(ctx: TenantContext) {
  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  return templateRepo.find().sort({ template_key: 1, version: -1 }).lean();
}

export async function getTemplate(ctx: TenantContext, id: string) {
  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  const template = await templateRepo.findById(id);
  if (!template) {
    throw new NotFoundError(`Template ${id} not found`);
  }
  return template;
}

export async function createTemplate(
  ctx: TenantContext,
  actor: { userId: string },
  input: TemplateInput & { template_key: string },
) {
  validateQuestionsSchemaStructure(input.questions_schema);

  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);

  const existing = await templateRepo.findLatestVersion(input.template_key);
  if (existing) {
    throw new ValidationError(
      `template_key "${input.template_key}" already exists — create a new version from it instead`,
    );
  }

  const template = await templateRepo.create({
    template_key: input.template_key,
    version: 1,
    name: input.name,
    description: input.description,
    questions_schema: input.questions_schema,
    schema_format_version: input.questions_schema.schema_format_version,
    status: "draft",
  });

  await recordAuditEvent({
    workspace_id: template.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "template.created",
    entity_type: "questionnaire_template",
    entity_id: template._id,
    diff: { template_key: template.template_key, version: template.version },
  });

  return template;
}

export async function updateDraftTemplate(
  ctx: TenantContext,
  actor: { userId: string },
  id: string,
  input: TemplateInput,
) {
  validateQuestionsSchemaStructure(input.questions_schema);

  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  const template = await templateRepo.findById(id);
  if (!template) {
    throw new NotFoundError(`Template ${id} not found`);
  }
  if (template.status !== "draft") {
    throw new ForbiddenError(
      `Template ${id} is ${template.status} — only a draft can be edited`,
    );
  }

  const result = await templateRepo.updateDraft(id, {
    name: input.name,
    description: input.description,
    questions_schema: input.questions_schema,
  });
  if (result.modifiedCount === 0) {
    throw new ForbiddenError(
      `Template ${id} is no longer a draft — it was published concurrently`,
    );
  }

  await recordAuditEvent({
    workspace_id: template.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "template.draft_updated",
    entity_type: "questionnaire_template",
    entity_id: template._id,
    diff: { name: input.name },
  });

  return { ...template.toObject(), ...input };
}

export async function publishTemplate(
  ctx: TenantContext,
  actor: { userId: string },
  id: string,
) {
  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  const template = await templateRepo.findById(id);
  if (!template) {
    throw new NotFoundError(`Template ${id} not found`);
  }
  if (template.status !== "draft") {
    throw new ForbiddenError(
      `Template ${id} is ${template.status} — only a draft can be published`,
    );
  }

  // Re-validated here even though every draft save already validated: this is the
  // publish-time safety net DATA-MODEL.md §3 calls out by name, and the last check before
  // this schema is frozen and can never be mutated again (CONSTRAINTS.md #11).
  validateQuestionsSchemaStructure(
    template.questions_schema as unknown as QuestionsSchema,
  );

  const actorId = new Types.ObjectId(actor.userId);
  const result = await templateRepo.publish(id, actorId);
  if (result.modifiedCount === 0) {
    throw new ForbiddenError(
      `Template ${id} is no longer a draft — it may have been published already`,
    );
  }

  await recordAuditEvent({
    workspace_id: template.workspace_id,
    actor: { type: "internal", id: actorId, email: null },
    action: "template.published",
    entity_type: "questionnaire_template",
    entity_id: template._id,
    diff: { version: template.version },
  });

  return getTemplate(ctx, id);
}

export async function createNewTemplateVersion(
  ctx: TenantContext,
  actor: { userId: string },
  id: string,
) {
  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  const source = await templateRepo.findById(id);
  if (!source) {
    throw new NotFoundError(`Template ${id} not found`);
  }
  if (source.status === "draft") {
    throw new ValidationError(
      `Template ${id} is already a draft — edit it directly instead of creating another version`,
    );
  }

  const latest = await templateRepo.findLatestVersion(source.template_key);
  if (latest?.status === "draft") {
    throw new ValidationError(
      `template_key "${source.template_key}" already has an editable draft (version ${latest.version}) — edit that instead`,
    );
  }

  const nextVersion = (latest?.version ?? source.version) + 1;
  const newVersion = await templateRepo.create({
    template_key: source.template_key,
    version: nextVersion,
    name: source.name,
    description: source.description,
    questions_schema: source.questions_schema,
    schema_format_version: source.schema_format_version,
    status: "draft",
  });

  await recordAuditEvent({
    workspace_id: source.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "template.new_version_created",
    entity_type: "questionnaire_template",
    entity_id: newVersion._id,
    diff: {
      template_key: source.template_key,
      version: nextVersion,
      copied_from_version: source.version,
    },
  });

  return newVersion;
}

export async function archiveTemplate(
  ctx: TenantContext,
  actor: { userId: string },
  id: string,
) {
  await dbConnect();
  const templateRepo = new TemplateRepository(ctx);
  const template = await templateRepo.findById(id);
  if (!template) {
    throw new NotFoundError(`Template ${id} not found`);
  }
  if (template.status === "archived") {
    throw new ValidationError(`Template ${id} is already archived`);
  }

  const result = await templateRepo.archive(id);
  if (result.modifiedCount === 0) {
    throw new ForbiddenError(
      `Template ${id} could not be archived — its status changed concurrently`,
    );
  }

  await recordAuditEvent({
    workspace_id: template.workspace_id,
    actor: {
      type: "internal",
      id: new Types.ObjectId(actor.userId),
      email: null,
    },
    action: "template.archived",
    entity_type: "questionnaire_template",
    entity_id: template._id,
    diff: { previous_status: template.status },
  });

  return getTemplate(ctx, id);
}
