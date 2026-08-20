import { NextResponse, type NextRequest } from "next/server";
import { requireCurrentMembershipWithCapability } from "@/lib/auth/require-capability";
import { dbConnect } from "@/lib/db/connect";
import { withRouteErrors } from "@/lib/http/with-route-errors";
import {
  AssessmentReportService,
  buildAssessmentReportCsv,
} from "@/lib/services/assessment-report";

function filename(value: string): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "assessment"
  );
}

export const GET = withRouteErrors(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const membership =
      await requireCurrentMembershipWithCapability("assessment.review");
    const { id } = await params;
    await dbConnect();
    const report = await new AssessmentReportService({
      workspaceId: membership.workspaceId,
    }).getReport(id);
    return new NextResponse(buildAssessmentReportCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename(report.vendor.legal_name)}-assessment-review.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
