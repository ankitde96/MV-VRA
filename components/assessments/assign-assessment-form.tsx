"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssessmentChecklistEditor } from "@/components/assessments/assessment-checklist-editor";
import {
  SendQuestionnaireDialog,
  type QuestionnaireRecipient,
} from "@/components/assessments/send-questionnaire-dialog";
import type { QuestionsSchema } from "@/lib/questionnaire/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Awaiting response",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  completed: "Completed",
  archived: "Archived",
};

export interface EngagementRow {
  id: string;
  businessUnit: string;
  status: string;
  assessments: {
    id: string;
    status: string;
    templateVersion: number;
    templateName: string;
    templateSnapshot: QuestionsSchema;
    updatedAt: string;
  }[];
}

export interface PublishedTemplateOption {
  id: string;
  name: string;
  templateKey: string;
  version: number;
}

export function AssignAssessmentForm({
  vendorId,
  engagements,
  publishedTemplates,
  recipients,
}: {
  vendorId: string;
  engagements: EngagementRow[];
  publishedTemplates: PublishedTemplateOption[];
  recipients: QuestionnaireRecipient[];
}) {
  const router = useRouter();
  const [selectedTemplateByEngagement, setSelectedTemplateByEngagement] =
    useState<Record<string, string>>({});
  const [loadingEngagementId, setLoadingEngagementId] = useState<string | null>(
    null,
  );

  async function assign(engagementId: string) {
    const templateId = selectedTemplateByEngagement[engagementId];
    if (!templateId) {
      toast.error("Choose a template first.");
      return;
    }

    setLoadingEngagementId(engagementId);
    try {
      const response = await fetch(`/api/vendors/${vendorId}/assessments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engagement_id: engagementId,
          template_id: templateId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Could not assign the assessment.");
        return;
      }
      toast.success("Assessment assigned.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoadingEngagementId(null);
    }
  }

  if (engagements.length === 0) {
    return <p className="text-muted-foreground text-sm">No engagements yet.</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="divide-border divide-y rounded-md border">
        {engagements.map((engagement) => (
          <li key={engagement.id} className="space-y-3 px-4 py-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">{engagement.businessUnit}</span>
              <span className="text-muted-foreground">{engagement.status}</span>
            </div>

            {engagement.assessments.length > 0 ? (
              <ul className="space-y-1">
                {engagement.assessments.map((assessment) => (
                  <li
                    key={assessment.id}
                    className="text-muted-foreground flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      {assessment.templateName} v{assessment.templateVersion} —{" "}
                      {STATUS_LABEL[assessment.status] ?? assessment.status}
                    </span>
                    {["submitted", "under_review", "completed"].includes(
                      assessment.status,
                    ) ? (
                      <Link
                        href={`/assessments/${assessment.id}`}
                        className="text-primary ml-2 font-medium hover:underline"
                      >
                        Review Assessment ↗
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {engagement.assessments
              .filter((assessment) => assessment.status === "draft")
              .map((assessment) => (
                <div key={assessment.id} className="space-y-3">
                  <AssessmentChecklistEditor
                    assessmentId={assessment.id}
                    initialSchema={assessment.templateSnapshot}
                    initialUpdatedAt={assessment.updatedAt}
                  />
                  <SendQuestionnaireDialog
                    assessmentId={assessment.id}
                    recipients={recipients}
                  />
                </div>
              ))}

            {publishedTemplates.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No published templates available to assign yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={selectedTemplateByEngagement[engagement.id] ?? ""}
                  onValueChange={(value) =>
                    setSelectedTemplateByEngagement((prev) => ({
                      ...prev,
                      [engagement.id]: value as string,
                    }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Select a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {publishedTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name} (v{template.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={loadingEngagementId === engagement.id}
                  onClick={() => assign(engagement.id)}
                >
                  {loadingEngagementId === engagement.id
                    ? "Assigning…"
                    : "Assign"}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
