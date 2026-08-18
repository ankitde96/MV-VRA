import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  requireCurrentMembership,
  requireCurrentMembershipWithCapability,
} from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { questionsSchemaSchema } from "@/lib/questionnaire/schema";
import {
  getTemplate,
  updateDraftTemplate,
} from "@/lib/services/questionnaire-templates";

const updateTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  questions_schema: questionsSchemaSchema,
});

export const GET = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership = await requireCurrentMembership();

    const { id } = await params;
    const template = await getTemplate(
      { workspaceId: membership.workspaceId },
      id,
    );

    return NextResponse.json({
      template: {
        id: template._id.toString(),
        template_key: template.template_key,
        version: template.version,
        name: template.name,
        description: template.description,
        status: template.status,
        questions_schema: template.questions_schema,
      },
    });
  },
);

export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("template.manage");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const template = await updateDraftTemplate(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data,
    );

    return NextResponse.json({ template: { id, status: template.status } });
  },
);
