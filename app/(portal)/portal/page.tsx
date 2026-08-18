import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { dbConnect } from "@/lib/db/connect";
import { AssessmentRepository } from "@/lib/repositories/assessment-repository";
import { PortalLogoutButton } from "@/components/portal-logout-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting your response",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  completed: "Completed",
  archived: "Archived",
};

/**
 * PLAN.md Phase 6 exit criterion, `FLOW.md` F2 gap (b): `vendor_id` comes only from the
 * session (never a URL/query parameter), so this page is the concrete proof that a SPOC
 * sees exactly their own assessments — nobody else's, and never by tampering with an id.
 * Answering/uploading against a specific assessment is Phase 7 —
 * `app/(portal)/portal/assessments/[id]/page.tsx`, linked below.
 */
export default async function PortalHomePage() {
  const session = await getCurrentPortalSession();
  if (!session) return null;

  await dbConnect();
  const assessmentRepo = new AssessmentRepository({
    workspaceId: session.workspaceId,
  });
  const assessments = await assessmentRepo
    .find({ vendor_id: session.vendorId })
    .sort({ assigned_at: -1 })
    .lean();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-xl font-semibold">
          Your assessments
        </h1>
        <PortalLogoutButton />
      </div>

      {assessments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No assessments yet</EmptyTitle>
            <EmptyDescription>
              You&apos;ll see assessments here once one is assigned to you.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <Link
              key={assessment._id.toString()}
              href={`/portal/assessments/${assessment._id.toString()}`}
            >
              <Card className="glass-panel-sm hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground font-medium">
                      Assessment {assessment.template_version}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {STATUS_LABEL[assessment.status] ?? assessment.status}
                    </p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground size-5 shrink-0"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
