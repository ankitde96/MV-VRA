import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { AssessmentEvidenceService } from "@/lib/services/assessment-evidence";
import { ValidationError } from "@/lib/errors";
import { withRouteErrors } from "@/lib/http/with-route-errors";

const flagSchema = z.object({
  flag: z.literal("insufficient").nullable(),
  note: z.string().max(1000).optional(),
});

export const PATCH = withRouteErrors(
  async (
    request: NextRequest,
    {
      params,
    }: {
      params: Promise<{ id: string; controlId: string; evidenceId: string }>;
    },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");
    const parsed = flagSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(
        "flag must be 'insufficient' or null and note must be at most 1000 characters",
      );
    }
    const { id, controlId, evidenceId } = await params;
    const service = new AssessmentEvidenceService({
      workspaceId: membership.workspaceId,
    });
    const result = await service.setEvidenceFlag(
      id,
      controlId,
      evidenceId,
      parsed.data,
      membership.userId,
    );
    return NextResponse.json(result);
  },
);
