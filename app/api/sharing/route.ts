import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import { shareVendorDocument } from "@/lib/services/sharing";

const shareRequestSchema = z.object({
  vendor_id: z.string().min(1),
  document_id: z.string().min(1),
  target_workspace_ids: z.array(z.string().min(1)).min(1),
  expires_at: z.coerce.date().nullable().optional(),
});

export const POST = withRouteErrors(async (request: NextRequest) => {
  const membership =
    await requireCurrentMembershipWithCapability("sharing.manage");

  const body = await request.json().catch(() => null);
  const parsed = shareRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      "vendor_id, document_id, and a non-empty target_workspace_ids array are required",
    );
  }

  const shared = await shareVendorDocument(
    { workspaceId: membership.workspaceId },
    { userId: membership.userId },
    {
      vendorId: parsed.data.vendor_id,
      documentId: parsed.data.document_id,
      targetWorkspaceIds: parsed.data.target_workspace_ids,
      expiresAt: parsed.data.expires_at ?? null,
    },
  );

  return NextResponse.json(
    { share_id: shared!._id.toString() },
    { status: 201 },
  );
});
