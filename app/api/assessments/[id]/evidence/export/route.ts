import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembership } from "@/lib/auth/require-capability";
import { AssessmentEvidenceService } from "@/lib/services/assessment-evidence";
import { withRouteErrors } from "@/lib/http/with-route-errors";

export const GET = withRouteErrors(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership = await requireCurrentMembership();
    const { id } = await params;
    const service = new AssessmentEvidenceService({
      workspaceId: membership.workspaceId,
    });
    const archive = await service.createArchive(id);

    return new NextResponse(archive.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        "X-Evidence-File-Count": String(archive.fileCount),
        "X-Evidence-Source-Bytes": String(archive.sourceBytes),
      },
    });
  },
);
