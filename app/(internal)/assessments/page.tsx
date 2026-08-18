import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { VendorRepository } from "@/lib/repositories/vendor-repository";
import { PageHeader } from "@/components/layout/page-header";
import {
  ReviewQueueTable,
  type ReviewQueueRow,
} from "@/components/assessments/review-queue-table";

export default async function ReviewQueuePage() {
  const session = await getCurrentSession();
  if (!session) return null;
  await dbConnect();

  const ctx = { workspaceId: session.workspaceId };
  const assessmentRepo = new AssessmentRepository(ctx);
  const vendorRepo = new VendorRepository(ctx);
  const assessments = await assessmentRepo
    .find({ status: { $in: ["submitted", "under_review"] } })
    .sort({ submitted_at: 1 })
    .lean();
  const vendorIds = [
    ...new Set(assessments.map((item) => item.vendor_id.toString())),
  ];
  const vendors = await vendorRepo
    .find({ _id: { $in: vendorIds } })
    .select("legal_name")
    .lean();
  const names = new Map(
    vendors.map((vendor) => [vendor._id.toString(), vendor.legal_name]),
  );
  const rows: ReviewQueueRow[] = assessments.map((assessment) => ({
    id: assessment._id.toString(),
    vendor: names.get(assessment.vendor_id.toString()) ?? "Unknown vendor",
    template_version: assessment.template_version,
    status: assessment.status,
    submitted_at: assessment.submitted_at?.toISOString() ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Review queue"
        description="Submitted vendor assessments awaiting analyst review."
      />
      <ReviewQueueTable rows={rows} />
    </div>
  );
}
