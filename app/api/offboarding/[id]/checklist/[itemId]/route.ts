import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { ValidationError } from "@/lib/errors";
import {
  updateChecklistItem,
  type ChecklistItemStatus,
} from "@/lib/services/offboarding";

const VALID_STATUSES = new Set(["pending", "in_progress", "done"]);

export const PATCH = withRouteErrors(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ id: string; itemId: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("offboarding.manage");

    const { id, itemId } = await params;
    const body = (await req.json().catch(() => null)) as {
      status?: string;
    } | null;
    if (!body?.status || !VALID_STATUSES.has(body.status)) {
      throw new ValidationError(
        "status must be one of pending, in_progress, done",
      );
    }

    const result = await updateChecklistItem(
      { workspaceId: membership.workspaceId },
      { userId: membership.userId },
      id,
      itemId,
      body.status as ChecklistItemStatus,
    );

    return NextResponse.json(result);
  },
);
