import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/current-session";
import { dbConnect } from "@/lib/db/connect";
import { AssessmentReviewService } from "@/lib/services/assessment-review";
import { AssessmentReviewClient } from "@/components/assessments/assessment-review-client";

export default async function AssessmentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) return null;

  const { id } = await params;
  await dbConnect();

  let data;
  try {
    const service = new AssessmentReviewService({
      workspaceId: session.workspaceId,
    });
    data = await service.getAssessmentReviewData(id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Link href="/vendors" className="hover:underline">
          Vendors
        </Link>
        <span>/</span>
        <Link href={`/vendors/${data.vendor.id}`} className="hover:underline">
          {data.vendor.legal_name}
        </Link>
        <span>/</span>
        <span>Assessment v{data.assessment.template_version}</span>
      </div>

      <AssessmentReviewClient initialData={data} />
    </div>
  );
}
