// @vitest-environment node
import { afterAll, afterEach, describe, expect, it } from "vitest";
import mongoose, { Types } from "mongoose";
import { dbConnect } from "@/lib/db/connect";
import { QuestionnaireTemplate } from "@/lib/db/models/questionnaire-template";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import {
  archiveTemplate,
  createNewTemplateVersion,
  createTemplate,
  publishTemplate,
  updateDraftTemplate,
} from "@/lib/services/questionnaire-templates";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";

const baseSchema: QuestionsSchema = {
  schema_format_version: 1,
  sections: [
    {
      id: "sec_1",
      title: "Section 1",
      questions: [
        { control_id: "Q1", text: "Q1?", type: "text", required: true },
      ],
    },
  ],
};

/**
 * TEST-CHECKLIST.md Gate 2/5: verified against a real database, not by reading the code.
 * CONSTRAINTS.md #11 is the thing under test — a published/archived version must never be
 * mutated in place.
 */
describe("questionnaire template lifecycle (integration)", () => {
  const workspaceId = new Types.ObjectId();
  const actorId = new Types.ObjectId();

  afterEach(async () => {
    await QuestionnaireTemplate.deleteMany({ workspace_id: workspaceId });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("creates a draft at version 1", async () => {
    await dbConnect();
    const template = await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "baseline",
        name: "Baseline",
        description: "",
        questions_schema: baseSchema,
      },
    );
    expect(template.version).toBe(1);
    expect(template.status).toBe("draft");
  });

  it("rejects creating a second version-1 template under the same template_key", async () => {
    await dbConnect();
    await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "dup",
        name: "Dup",
        description: "",
        questions_schema: baseSchema,
      },
    );
    await expect(
      createTemplate(
        { workspaceId },
        { userId: actorId.toString() },
        {
          template_key: "dup",
          name: "Dup 2",
          description: "",
          questions_schema: baseSchema,
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a schema with a forward-referencing show_if at creation time, not just at publish", async () => {
    await dbConnect();
    const invalidSchema: QuestionsSchema = {
      schema_format_version: 1,
      sections: [
        {
          id: "sec_1",
          title: "Section",
          questions: [
            {
              control_id: "Q1",
              text: "Q1",
              type: "text",
              required: true,
              show_if: { all: [{ control_id: "Q2", op: "is_answered" }] },
            },
            { control_id: "Q2", text: "Q2", type: "text", required: true },
          ],
        },
      ],
    };
    await expect(
      createTemplate(
        { workspaceId },
        { userId: actorId.toString() },
        {
          template_key: "invalid",
          name: "Invalid",
          description: "",
          questions_schema: invalidSchema,
        },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("allows editing a draft in place, then freezes it on publish", async () => {
    await dbConnect();
    const template = await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "lifecycle",
        name: "Lifecycle",
        description: "",
        questions_schema: baseSchema,
      },
    );

    await updateDraftTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      template._id.toString(),
      {
        name: "Lifecycle v1 (edited)",
        description: "updated",
        questions_schema: baseSchema,
      },
    );
    const afterEdit = await QuestionnaireTemplate.findById(template._id);
    expect(afterEdit?.name).toBe("Lifecycle v1 (edited)");

    const published = await publishTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      template._id.toString(),
    );
    expect(published.status).toBe("published");
    expect(published.published_at).not.toBeNull();

    await expect(
      updateDraftTemplate(
        { workspaceId },
        { userId: actorId.toString() },
        template._id.toString(),
        {
          name: "Should not be allowed",
          description: "",
          questions_schema: baseSchema,
        },
      ),
    ).rejects.toThrow(ForbiddenError);

    const afterAttemptedEdit = await QuestionnaireTemplate.findById(
      template._id,
    );
    expect(afterAttemptedEdit?.name).toBe("Lifecycle v1 (edited)");
  });

  it("creates a new draft version from a published template, copying its schema, and bumps the version number", async () => {
    await dbConnect();
    const v1 = await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "versioning",
        name: "Versioning",
        description: "",
        questions_schema: baseSchema,
      },
    );
    await publishTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );

    const v2 = await createNewTemplateVersion(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );
    expect(v2.version).toBe(2);
    expect(v2.status).toBe("draft");
    expect(v2.template_key).toBe("versioning");
    expect(v2.questions_schema).toEqual(baseSchema);
  });

  it("refuses to create another new version while a draft already exists for the template_key", async () => {
    await dbConnect();
    const v1 = await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "one-draft",
        name: "One Draft",
        description: "",
        questions_schema: baseSchema,
      },
    );
    await publishTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );
    await createNewTemplateVersion(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );

    await expect(
      createNewTemplateVersion(
        { workspaceId },
        { userId: actorId.toString() },
        v1._id.toString(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("archives a published template and refuses to archive it twice", async () => {
    await dbConnect();
    const v1 = await createTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      {
        template_key: "archiving",
        name: "Archiving",
        description: "",
        questions_schema: baseSchema,
      },
    );
    await publishTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );

    const archived = await archiveTemplate(
      { workspaceId },
      { userId: actorId.toString() },
      v1._id.toString(),
    );
    expect(archived.status).toBe("archived");

    await expect(
      archiveTemplate(
        { workspaceId },
        { userId: actorId.toString() },
        v1._id.toString(),
      ),
    ).rejects.toThrow(ValidationError);
  });
});
