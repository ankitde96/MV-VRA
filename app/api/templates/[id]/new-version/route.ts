import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { createNewTemplateVersion } from "@/lib/services/questionnaire-templates";

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("template.manage");

    const { id } = await params;
    const newVersion = await createNewTemplateVersion(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
    );

    return NextResponse.json(
      {
        template: {
          id: newVersion._id.toString(),
          template_key: newVersion.template_key,
          version: newVersion.version,
          status: newVersion.status,
        },
      },
      { status: 201 },
    );
  },
);
