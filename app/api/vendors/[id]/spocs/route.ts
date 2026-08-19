import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { addVendorSpoc } from "@/lib/services/vendor-spoc";

const addSpocRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
});

/**
 * ASSESSMENT-WORKFLOW-PLAN.md Stage 2 — adds one entry to `Vendor.spocs[]`. Retires the
 * single-object `PATCH /api/vendors/[id]/spoc` route.
 */
export const POST = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("vendor.write");

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = addSpocRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const spoc = await addVendorSpoc(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      parsed.data,
    );

    return NextResponse.json({ spoc }, { status: 201 });
  },
);
