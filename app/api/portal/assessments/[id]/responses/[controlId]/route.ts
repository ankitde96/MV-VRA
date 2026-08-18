import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import { saveResponse } from "@/lib/services/portal-assessment";

const saveResponseSchema = z.object({ value: z.unknown() });

export const PUT = withRouteErrors(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; controlId: string }> },
  ) => {
    const session = await getCurrentPortalSession();
    if (!session) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }

    const { id, controlId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = saveResponseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: parsed.error.message },
        { status: 422 },
      );
    }

    const response = await saveResponse(
      session,
      id,
      controlId,
      parsed.data.value,
    );
    return NextResponse.json({
      response: {
        control_id: response.control_id,
        answered_at: response.answered_at,
      },
    });
  },
);
