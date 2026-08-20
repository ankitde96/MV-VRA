import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { AssessmentEvidenceService } from "@/lib/services/assessment-evidence";
import { withRouteErrors } from "@/lib/http/with-route-errors";

export const GET = withRouteErrors(
  async (
    _request: NextRequest,
    {
      params,
    }: {
      params: Promise<{ id: string; controlId: string; evidenceId: string }>;
    },
  ) => {
    const membership = await requireCurrentMembership();
    const { id, controlId, evidenceId } = await params;
    const service = new AssessmentEvidenceService({
      workspaceId: membership.workspaceId,
    });
    const { evidence, body } = await service.getEvidenceFile(
      id,
      controlId,
      evidenceId,
    );

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": evidence.mime,
        "Content-Disposition": `attachment; filename="${evidence.filename.replace(/["\r\n]/g, "")}"`,
        "Content-Length": String(evidence.size),
      },
    });
  },
);
