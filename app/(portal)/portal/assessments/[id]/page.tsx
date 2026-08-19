import { notFound } from "next/navigation";
import { getCurrentPortalSession } from "@/lib/auth/current-portal-session";
import { getAssessmentForAnswering } from "@/lib/services/portal-assessment";
import { AssessmentAnswerForm } from "@/components/portal/assessment-answer-form";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import { PORTAL_EDITABLE_ASSESSMENT_STATUSES } from "@/lib/assessments/editable-statuses";

/**
 * DESIGN-SYSTEM.md §7 rule 8: "the vendor never sees `residual_score`, `control_id`, or
 * `Tier 2`. Those are internal concepts." This page used to render the raw
 * `assessment.status` enum value directly (e.g. "under_review") — plain-language copy only.
 */
const PLAIN_STATUS: Record<string, string> = {
  draft: "Not yet sent to you",
  sent: "Ready for you to complete",
  in_progress: "In progress — pick up where you left off",
  changes_requested: "Changes requested — update the flagged answers",
  submitted: "Submitted — thank you, no further action needed",
  under_review: "Submitted — under review by our team",
  completed: "Review complete",
  archived: "Closed",
};

export default async function PortalAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentPortalSession();
  if (!session) return null;

  const { id } = await params;

  let assessment, responses;
  try {
    ({ assessment, responses } = await getAssessmentForAnswering(session, id));
  } catch {
    notFound();
  }

  const schema = assessment.template_snapshot as unknown as QuestionsSchema;
  const initialResponses = responses.map((r) => ({
    control_id: r.control_id,
    response_value: r.response_value,
    review_status: r.review_status ?? null,
    reviewer_note: r.reviewer_note ?? "",
    evidence: r.evidence.map((e) => ({
      id: e._id!.toString(),
      filename: e.filename,
      mime: e.mime,
      size: e.size,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">
          Assessment {assessment.template_version}
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          {PLAIN_STATUS[assessment.status] ?? assessment.status}
        </p>
      </div>

      <AssessmentAnswerForm
        assessmentId={id}
        assessmentStatus={assessment.status}
        schema={schema}
        initialResponses={initialResponses}
        readOnly={!PORTAL_EDITABLE_ASSESSMENT_STATUSES.has(assessment.status)}
      />
    </div>
  );
}
