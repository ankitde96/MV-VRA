import { NextResponse, type NextRequest } from "next/server";
import {
  requireCurrentMembership,
  requireCurrentMembershipWithCapability,
} from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import {
  getOffboardingView,
  initiateOffboarding,
} from "@/lib/services/offboarding";

export const GET = withRouteErrors(
  async (
    _req: NextRequest,
    { params }: { params: Promise<{ engagementId: string }> },
  ) => {
    const membership = await requireCurrentMembership();

    const { engagementId } = await params;
    const offboarding = await getOffboardingView(
      { workspaceId: membership.workspaceId },
      engagementId,
    );
    return NextResponse.json({ offboarding });
  },
);

export const POST = withRouteErrors(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ engagementId: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("offboarding.manage");

    const { engagementId } = await params;
    const body = (await req.json().catch(() => null)) as {
      checklist_items?: { label: string; owner_id: string }[];
    } | null;
    if (!body?.checklist_items) {
      throw new ValidationError(
        "Expected { checklist_items: [{ label, owner_id }] }",
      );
    }

    const offboarding = await initiateOffboarding(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      engagementId,
      body.checklist_items,
    );

    return NextResponse.json(
      { offboarding_id: offboarding._id.toString() },
      { status: 201 },
    );
  },
);
