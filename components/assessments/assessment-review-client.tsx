"use client";

import { useCallback, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RaiseRiskDialog } from "@/components/risks/raise-risk-dialog";
import {
  SeverityBadge,
  type Severity,
} from "@/components/domain/severity-badge";
import { StatusBadge } from "@/components/domain/status-badge";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { ReviewSection } from "@/components/assessments/review/review-section";
import {
  createInitialReviewState,
  reviewStateReducer,
  type ReviewVerdict,
} from "@/components/assessments/review/review-state";

interface AssessmentReviewClientProps {
  initialData: {
    assessment: {
      id: string;
      status: string;
      template_version: number;
      overall_score: number | null | undefined;
      assigned_at: string | null;
      submitted_at: string | null;
      reviewed_at: string | null;
    };
    vendor: {
      id: string;
      legal_name: string;
      domain: string;
    };
    engagement: {
      id: string;
      business_unit: string;
      inherent_risk_score: number | null;
      inherent_risk_tier: number | null | undefined;
    };
    questions: ReviewerQuestionItem[];
    risks: Array<{
      id: string;
      control_id: string;
      title: string;
      description: string;
      severity: string;
      enterprise_risk_category: string;
      impact_level: string;
      residual_score: number;
      status: string;
    }>;
    enterprise_risk_categories: string[];
    is_provisional_taxonomy: boolean;
    metrics: {
      total: number;
      answered: number;
      passed: number;
      exception: number;
      failed: number;
      missing: number;
      suppressed: number;
      risks_count: number;
    };
  };
}

export function AssessmentReviewClient({
  initialData,
}: AssessmentReviewClientProps) {
  const router = useRouter();
  const {
    assessment,
    vendor,
    engagement,
    questions,
    risks,
    enterprise_risk_categories,
    is_provisional_taxonomy,
    metrics,
  } = initialData;

  const [dialogControlId, setDialogControlId] = useState<string | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [completing, setCompleting] = useState(false);
  const [resending, setResending] = useState(false);
  const [reviewState, dispatchReviewState] = useReducer(
    reviewStateReducer,
    questions,
    createInitialReviewState,
  );
  const persistVerdict = useCallback(
    async (
      controlId: string,
      review: {
        review_status: "compliant" | "non_compliant";
        reviewer_note: string;
      },
    ) => {
      const response = await fetch(
        `/api/assessments/${assessment.id}/responses/${controlId}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(review),
        },
      );
      if (response.ok) {
        dispatchReviewState({
          type: "save_succeeded",
          controlId,
          savedAt: new Date(),
        });
      } else {
        dispatchReviewState({ type: "save_failed", controlId });
        toast.error("The review verdict could not be saved.");
      }
      return response.ok;
    },
    [assessment.id],
  );
  const { schedule: scheduleVerdict, flush: flushVerdicts } =
    useDebouncedAutosave({
      onSave: persistVerdict,
    });

  const isCompleted = assessment.status === "completed";

  // Group questions by section
  const sectionsMap = new Map<string, ReviewerQuestionItem[]>();
  for (const q of questions) {
    sectionsMap.set(q.section_title, [
      ...(sectionsMap.get(q.section_title) ?? []),
      q,
    ]);
  }

  async function handleCompleteReview() {
    setCompleting(true);
    try {
      if ((await flushVerdicts()).some((saved) => !saved)) return;
      const res = await fetch(
        `/api/assessments/${assessment.id}/complete-review`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message ?? "Failed to complete review.");
        return;
      }
      toast.success("Review completed.");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  const saveVerdict = useCallback(
    (
      controlId: string,
      reviewStatus: Exclude<ReviewVerdict, null>,
      reviewerNote: string,
    ) => {
      dispatchReviewState({
        type: "verdict_changed",
        controlId,
        verdict: reviewStatus,
      });
      scheduleVerdict(controlId, {
        review_status: reviewStatus,
        reviewer_note: reviewerNote,
      });
    },
    [scheduleVerdict],
  );

  const saveReviewerNote = useCallback(
    (controlId: string, reviewerNote: string, verdict: ReviewVerdict) => {
      dispatchReviewState({
        type: "note_changed",
        controlId,
        note: reviewerNote,
      });
      if (verdict) {
        scheduleVerdict(controlId, {
          review_status: verdict,
          reviewer_note: reviewerNote,
        });
      }
    },
    [scheduleVerdict],
  );

  async function handleResend() {
    setResending(true);
    try {
      if ((await flushVerdicts()).some((saved) => !saved)) return;
      const response = await fetch(`/api/assessments/${assessment.id}/resend`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        toast.error(body?.message ?? "Could not return the questionnaire.");
        return;
      }
      toast.success("Questionnaire returned to the vendor.");
      router.refresh();
    } finally {
      setResending(false);
    }
  }

  const openRaiseRiskModal = useCallback(
    (controlId: string, text: string, guidanceText?: string) => {
      setDialogControlId(controlId);
      setDialogTitle(`Risk Exception: ${controlId} - ${text.slice(0, 50)}`);
      setDialogDescription(
        guidanceText ?? `Control failure detected for ${controlId}`,
      );
    },
    [],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-xl font-bold">
              {vendor.legal_name}
            </h1>
            <StatusBadge status={assessment.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Engagement:{" "}
            <span className="text-foreground font-medium">
              {engagement.business_unit}
            </span>{" "}
            | Template Version: v{assessment.template_version}
            {engagement.inherent_risk_score !== null
              ? ` | Inherent Score: ${engagement.inherent_risk_score}`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-card rounded-lg border p-3 text-right shadow-(--shadow-card)">
            <span className="text-muted-foreground block text-xs font-medium tracking-wider uppercase">
              Overall Assessment Score
            </span>
            <span className="text-primary font-mono text-2xl font-bold">
              {assessment.overall_score !== null ? assessment.overall_score : 0}
            </span>
            <span className="text-muted-foreground block font-mono text-[10px]">
              Sum of Constituent Risks
            </span>
          </div>

          {!isCompleted ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? "Returning…" : "Request changes"}
              </Button>
              <Button onClick={handleCompleteReview} disabled={completing}>
                {completing ? "Completing…" : "Complete Review"}
              </Button>
            </div>
          ) : (
            <Button variant="outline" disabled>
              Review Completed
            </Button>
          )}
        </div>
      </div>

      {/* Provisional Taxonomy Alert if applicable */}
      {is_provisional_taxonomy ? (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>
            <strong className="font-semibold">
              Provisional Risk Taxonomy:
            </strong>{" "}
            Enterprise risk categories are using seeded defaults. Workspace
            taxonomy can be configured in settings.
          </span>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-300"
          >
            Provisional
          </Badge>
        </div>
      ) : null}

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Total Controls
          </span>
          <span className="text-lg font-bold">{metrics.total}</span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Passed
          </span>
          <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.passed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Exceptions
          </span>
          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {metrics.exception}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Failed
          </span>
          <span className="text-destructive text-lg font-bold">
            {metrics.failed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Missing
          </span>
          <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {metrics.missing}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Suppressed
          </span>
          <span className="text-muted-foreground text-lg font-bold">
            {metrics.suppressed}
          </span>
        </div>
        <div className="bg-card rounded-md border p-3 shadow-(--shadow-card)">
          <span className="text-muted-foreground block text-xs font-medium">
            Risks Raised
          </span>
          <span className="text-primary font-mono text-lg font-bold">
            {metrics.risks_count}
          </span>
        </div>
      </div>

      {/* Raised Risks Section if any exist */}
      {risks.length > 0 ? (
        <section className="bg-card space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold">
              Identified Risks Raised ({risks.length})
            </h2>
            <Link
              href="/risks"
              className="text-primary text-xs hover:underline"
            >
              View in Risk Register →
            </Link>
          </div>
          <div className="divide-y rounded-md border">
            {risks.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono font-bold">
                      {r.control_id}
                    </span>
                    <span className="text-foreground font-medium">
                      {r.title}
                    </span>
                    <SeverityBadge severity={r.severity as Severity} />
                  </div>
                  <p className="text-muted-foreground">
                    Category: {r.enterprise_risk_category} | Impact:{" "}
                    {r.impact_level}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-muted-foreground block text-xs">
                    Residual Score
                  </span>
                  <span className="text-primary text-sm font-bold">
                    {r.residual_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Question Responses Evaluation by Section */}
      <section className="space-y-6">
        <h2 className="text-foreground text-base font-semibold">
          Questionnaire Evaluation
        </h2>

        {[...sectionsMap.entries()].map(([sectionTitle, sectionQuestions]) => (
          <ReviewSection
            key={sectionTitle}
            title={sectionTitle}
            questions={sectionQuestions}
            reviewState={reviewState}
            isCompleted={isCompleted}
            onVerdictChange={saveVerdict}
            onNoteChange={saveReviewerNote}
            onRaiseRisk={openRaiseRiskModal}
          />
        ))}
      </section>

      {/* Raise Risk Dialog Modal */}
      {dialogControlId ? (
        <RaiseRiskDialog
          assessmentId={assessment.id}
          controlId={dialogControlId}
          defaultTitle={dialogTitle}
          defaultDescription={dialogDescription}
          categories={enterprise_risk_categories}
          inherentScore={engagement.inherent_risk_score}
          open={Boolean(dialogControlId)}
          onOpenChange={(open) => {
            if (!open) setDialogControlId(null);
          }}
        />
      ) : null}
    </div>
  );
}
