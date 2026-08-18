import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { updateVendorSpoc } from "@/lib/services/vendor-spoc";

const spocRequestSchema = z.object({
  spoc_name: z.string().min(1),
  spoc_email: z.string().email(),
  spoc_phone: z.string().min(1),
});

export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("vendor.write");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = spocRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const result = await updateVendorSpoc(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data,
    );

    return NextResponse.json({ vendor: result });
  },
);
