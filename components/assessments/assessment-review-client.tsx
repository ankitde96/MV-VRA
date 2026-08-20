"use client";

import { useCallback, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RaiseRiskDialog } from "@/components/risks/raise-risk-dialog";
import {
  SeverityBadge,
  type Severity,
} from "@/components/domain/severity-badge";
import { StatusBadge } from "@/components/domain/status-badge";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { ReviewSection } from "@/components/assessments/review/review-section";
import { ReviewToolbar } from "@/components/assessments/review/review-toolbar";
import { ReviewShortcutsDialog } from "@/components/assessments/review/review-shortcuts-dialog";
import {
  createInitialReviewState,
  reviewStateReducer,
  type ReviewVerdict,
} from "@/components/assessments/review/review-state";
import {
  REVIEW_SEARCH_INPUT_ID,
  useReviewProductivity,
} from "@/hooks/use-review-productivity";

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
    cap_completeness: {
      incomplete_tasks: number;
      issues: Array<{
        risk_id: string;
        risk_title: string;
        task_id: string;
        task_description: string;
        missing_fields: Array<"owner" | "due_date">;
      }>;
    };
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
    cap_completeness,
    metrics,
  } = initialData;

  const [dialogControlId, setDialogControlId] = useState<string | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [completing, setCompleting] = useState(false);
  const [capWarningAcknowledged, setCapWarningAcknowledged] = useState(false);
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

  async function handleCompleteReview() {
    setCompleting(true);
    try {
      if ((await flushVerdicts()).some((saved) => !saved)) return;
      const res = await fetch(
        `/api/assessments/${assessment.id}/complete-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            override_incomplete_cap_tasks:
              cap_completeness.incomplete_tasks > 0 && capWarningAcknowledged,
          }),
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
      dispatchReviewState({ type: "save_started", controlId });
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
        dispatchReviewState({ type: "save_started", controlId });
        scheduleVerdict(controlId, {
          review_status: verdict,
          reviewer_note: reviewerNote,
        });
      }
    },
    [scheduleVerdict],
  );

  const retryVerdict = useCallback(
    (controlId: string) => {
      const current = reviewState[controlId];
      if (!current?.verdict) return;
      dispatchReviewState({ type: "save_started", controlId });
      scheduleVerdict(controlId, {
        review_status: current.verdict,
        reviewer_note: current.note,
      });
    },
    [reviewState, scheduleVerdict],
  );

  const updateEvidenceFlag = useCallback(
    async (
      controlId: string,
      evidenceId: string,
      flag: "insufficient" | null,
      note: string,
    ) => {
      try {
        const response = await fetch(
          `/api/assessments/${assessment.id}/responses/${controlId}/evidence/${evidenceId}/flag`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ flag, note }),
          },
        );
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          toast.error(
            body?.message ?? "The evidence annotation could not be saved.",
          );
          return false;
        }
        toast.success(
          flag ? "Evidence marked insufficient." : "Evidence flag cleared.",
        );
        router.refresh();
        return true;
      } catch {
        toast.error("The evidence annotation could not be saved.");
        return false;
      }
    },
    [assessment.id, router],
  );

  const markVerdictFromKeyboard = useCallback(
    (controlId: string, verdict: Exclude<ReviewVerdict, null>) => {
      const current = reviewState[controlId];
      if (current) saveVerdict(controlId, verdict, current.note);
    },
    [reviewState, saveVerdict],
  );
  const {
    filters,
    searchQuery,
    setSearchQuery,
    focusedControlId,
    shortcutsOpen,
    setShortcutsOpen,
    progress,
    facetCounts,
    filteredControlIds,
    filtersActive,
    collapsedSectionSet,
    visibleSections,
    toggleStatusFilter,
    toggleMissingEvidence,
    toggleRiskRaised,
    clearProductivityFilters,
    toggleAllSections,
    toggleSection,
    focusControl,
  } = useReviewProductivity({
    questions,
    reviewState,
    canEdit: !isCompleted,
    onMarkVerdict: markVerdictFromKeyboard,
  });

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
      setDialogTitle(`${controlId}: ${text.slice(0, 72)}`);
      setDialogDescription(
        guidanceText ??
          `The vendor response for ${controlId} was marked non-compliant. Document the resulting risk and required remediation.`,
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
              <Button
                onClick={handleCompleteReview}
                disabled={
                  completing ||
                  (cap_completeness.incomplete_tasks > 0 &&
                    !capWarningAcknowledged)
                }
                title={
                  cap_completeness.incomplete_tasks > 0 &&
                  !capWarningAcknowledged
                    ? "Acknowledge the incomplete CAP warning before completing"
                    : undefined
                }
              >
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

      {!isCompleted && cap_completeness.incomplete_tasks > 0 ? (
        <section
          id="cap-completeness-warning"
          className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100"
          role="status"
        >
          <div>
            <p className="font-semibold">
              {cap_completeness.incomplete_tasks} corrective action task
              {cap_completeness.incomplete_tasks === 1 ? "" : "s"} need
              completion details
            </p>
            <p className="mt-1 text-xs opacity-80">
              Add the missing owner or due date in the risk register. This is an
              advisory warning and may be explicitly overridden without
              weakening the existing review gates.
            </p>
          </div>
          <ul className="space-y-1 text-xs">
            {cap_completeness.issues.map((issue) => (
              <li key={`${issue.risk_id}-${issue.task_id}`}>
                <span className="font-medium">{issue.risk_title}:</span>{" "}
                {issue.task_description} — missing{" "}
                {issue.missing_fields.join(" and ")}
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-2 text-xs font-medium">
            <Checkbox
              checked={capWarningAcknowledged}
              onCheckedChange={(checked) =>
                setCapWarningAcknowledged(Boolean(checked))
              }
              aria-describedby="cap-completeness-warning"
            />
            I acknowledge these incomplete CAP details and want to complete the
            review anyway. This override will be audited.
          </label>
        </section>
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
        <div>
          <h2 className="text-foreground text-base font-semibold">
            Questionnaire Evaluation
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Filter the visible review set or use keyboard shortcuts to move and
            mark controls quickly.
          </p>
        </div>

        <ReviewToolbar
          progress={progress}
          facetCounts={facetCounts}
          filters={filters}
          query={searchQuery}
          matchingCount={filteredControlIds.length}
          allSectionsExpanded={filtersActive || collapsedSectionSet.size === 0}
          sectionsLockedOpen={filtersActive}
          searchInputId={REVIEW_SEARCH_INPUT_ID}
          onQueryChange={setSearchQuery}
          onToggleStatus={toggleStatusFilter}
          onToggleMissingEvidence={toggleMissingEvidence}
          onToggleRiskRaised={toggleRiskRaised}
          onClearFilters={clearProductivityFilters}
          onToggleAllSections={toggleAllSections}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          evidenceExportUrl={
            questions.some((question) => question.evidence.length > 0)
              ? `/api/assessments/${assessment.id}/evidence/export`
              : null
          }
        />

        {visibleSections.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
            No controls match the current review filters.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleSections.map((section) => (
              <ReviewSection
                key={section.title}
                title={section.title}
                questions={section.questions}
                sectionIndex={section.index}
                expanded={
                  filtersActive ||
                  section.questions.some(
                    (question) => question.control_id === focusedControlId,
                  ) ||
                  !collapsedSectionSet.has(section.index)
                }
                filtersActive={filtersActive}
                focusedControlId={focusedControlId}
                reviewState={reviewState}
                isCompleted={isCompleted}
                onVerdictChange={saveVerdict}
                onNoteChange={saveReviewerNote}
                onRaiseRisk={openRaiseRiskModal}
                onToggle={() => toggleSection(section.index)}
                onFocusControl={focusControl}
                onRetry={retryVerdict}
                onEvidenceFlagChange={updateEvidenceFlag}
              />
            ))}
          </div>
        )}
      </section>

      <ReviewShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

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
