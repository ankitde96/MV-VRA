import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import { revokeVendorDocumentShare } from "@/lib/services/sharing";

const revokeSchema = z.object({
  target_workspace_id: z.string().min(1),
});

export const DELETE = withRouteErrors<{ params: Promise<{ id: string }> }>(
  async (request: NextRequest, context) => {
    const membership =
      await requireCurrentMembershipWithCapability("sharing.manage");
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("target_workspace_id is required");
    }

    const result = await revokeVendorDocumentShare(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data.target_workspace_id,
    );
    return NextResponse.json(result);
  },
);
