import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { archiveTemplate } from "@/lib/services/questionnaire-templates";

export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("template.manage");

    const { id } = await params;
    const template = await archiveTemplate(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
    );

    return NextResponse.json({
      template: { id: template._id.toString(), status: template.status },
    });
  },
);
