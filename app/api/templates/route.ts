import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  requireCurrentMembership,
  requireCurrentMembershipWithCapability,
} from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { questionsSchemaSchema } from "@/lib/questionnaire/schema";
import {
  createTemplate,
  listTemplates,
} from "@/lib/services/questionnaire-templates";

const createTemplateSchema = z.object({
  template_key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  questions_schema: questionsSchemaSchema,
});

export const GET = withRouteErrors(async () => {
  const membership = await requireCurrentMembership();

  const templates = await listTemplates({
    workspaceId: membership.workspaceId,
  });
  return NextResponse.json({
    templates: templates.map((t) => ({
      id: t._id.toString(),
      template_key: t.template_key,
      version: t.version,
      name: t.name,
      status: t.status,
      updated_at: t.updated_at,
    })),
  });
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const membership =
    await requireCurrentMembershipWithCapability("template.manage");

  const body = await request.json().catch(() => null);
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: parsed.error.message },
      { status: 422 },
    );
  }

  const template = await createTemplate(
    { workspaceId: membership.workspaceId },
    { userId: membership.userId },
    parsed.data,
  );

  return NextResponse.json(
    {
      template: {
        id: template._id.toString(),
        template_key: template.template_key,
        version: template.version,
      },
    },
    { status: 201 },
  );
});
