"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import type { ReviewItemState, ReviewVerdict } from "./review-state";
import {
  getReviewControlDomId,
  getReviewNoteDomId,
} from "./review-productivity";
import { ReviewEvidenceList } from "./review-evidence-list";

const CONTROL_STATUS_BADGES: Record<
  ReviewerQuestionItem["control_status"],
  { label: string; className: string }
> = {
  passed: {
    label: "Passed",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  exception: {
    label: "Exception",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  missing: {
    label: "Missing",
    className:
      "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  suppressed: {
    label: "Suppressed",
    className: "bg-muted text-muted-foreground border-border",
  },
};

interface ReviewQuestionRowProps {
  question: ReviewerQuestionItem;
  review: ReviewItemState;
  isCompleted: boolean;
  isFocused: boolean;
  onVerdictChange: (
    controlId: string,
    verdict: Exclude<ReviewVerdict, null>,
    note: string,
  ) => void;
  onNoteChange: (
    controlId: string,
    note: string,
    verdict: ReviewVerdict,
  ) => void;
  onRaiseRisk: (controlId: string, text: string, guidanceText?: string) => void;
  onFocusControl: (controlId: string) => void;
  onRetry: (controlId: string) => void;
  onEvidenceFlagChange: (
    controlId: string,
    evidenceId: string,
    flag: "insufficient" | null,
    note: string,
  ) => Promise<boolean>;
}

export const ReviewQuestionRow = memo(function ReviewQuestionRow({
  question,
  review,
  isCompleted,
  isFocused,
  onVerdictChange,
  onNoteChange,
  onRaiseRisk,
  onFocusControl,
  onRetry,
  onEvidenceFlagChange,
}: ReviewQuestionRowProps) {
  const statusBadge = CONTROL_STATUS_BADGES[question.control_status];

  return (
    <div
      id={getReviewControlDomId(question.control_id)}
      data-review-control={question.control_id}
      tabIndex={-1}
      onFocus={() => onFocusControl(question.control_id)}
      className={`scroll-mt-44 space-y-3 rounded-md border p-4 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
        isFocused ? "border-primary/60 ring-2 ring-primary/15" : ""
      } ${question.is_suppressed ? "bg-muted/40 opacity-75" : "bg-background"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-mono text-xs font-bold">
              {question.control_id}
            </span>
            <Badge variant="outline" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
            {question.is_required ? (
              <span className="text-muted-foreground text-[10px]">
                (Required)
              </span>
            ) : null}
          </div>
          <p className="text-foreground text-sm font-medium">{question.text}</p>
        </div>

        {!question.is_suppressed && !isCompleted ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onRaiseRisk(
                question.control_id,
                question.text,
                question.suggested_guidance?.suggested_remediation,
              )
            }
          >
            Raise Risk
          </Button>
        ) : null}
      </div>

      {!question.is_suppressed && !isCompleted ? (
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={review.verdict === "compliant" ? "default" : "outline"}
              onClick={() =>
                onVerdictChange(question.control_id, "compliant", review.note)
              }
            >
              Compliant
            </Button>
            <Button
              size="sm"
              variant={
                review.verdict === "non_compliant" ? "destructive" : "outline"
              }
              onClick={() =>
                onVerdictChange(
                  question.control_id,
                  "non_compliant",
                  review.note,
                )
              }
            >
              Non-compliant
            </Button>
          </div>
          <Textarea
            id={getReviewNoteDomId(question.control_id)}
            aria-label={`Reviewer note for ${question.control_id}`}
            value={review.note}
            placeholder="Explain what the vendor should change"
            onChange={(event) =>
              onNoteChange(
                question.control_id,
                event.target.value,
                review.verdict,
              )
            }
          />
          {review.error ? (
            <div
              className="text-destructive flex items-center gap-2 text-[11px]"
              role="alert"
            >
              <span>Save failed.</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onRetry(question.control_id)}
              >
                Retry
              </Button>
            </div>
          ) : review.saving ? (
            <p className="text-muted-foreground text-[11px]" aria-live="polite">
              Saving…
            </p>
          ) : review.savedAt ? (
            <p className="text-muted-foreground text-[11px]" aria-live="polite">
              Saved{" "}
              {review.savedAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="bg-muted/20 space-y-1 rounded border p-2">
        <span className="text-muted-foreground text-[11px] font-semibold">
          Vendor Answer:
        </span>
        <div className="text-foreground font-mono text-xs">
          {question.response_value !== null &&
          question.response_value !== undefined ? (
            Array.isArray(question.response_value) ? (
              question.response_value.join(", ")
            ) : (
              String(question.response_value)
            )
          ) : (
            <span className="text-muted-foreground italic">
              No answer provided
            </span>
          )}
        </div>

        {question.evidence.length > 0 ? (
          <ReviewEvidenceList
            controlId={question.control_id}
            evidence={question.evidence}
            canEdit={!question.is_suppressed && !isCompleted}
            onFlagChange={onEvidenceFlagChange}
          />
        ) : null}
      </div>

      {question.suggested_guidance ? (
        <div className="space-y-1 rounded border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs text-blue-900 dark:text-blue-200">
          <span className="block font-semibold">
            Suggested Mitigation Guidance:
          </span>
          <p>{question.suggested_guidance.suggested_remediation}</p>
        </div>
      ) : null}

      {question.associated_risks.length > 0 ? (
        <div className="border-primary/30 bg-primary/5 space-y-1 rounded border p-2.5">
          <span className="text-primary block text-xs font-semibold">
            Associated Identified Risks ({question.associated_risks.length}):
          </span>
          {question.associated_risks.map((risk) => (
            <div
              key={risk.id}
              className="flex items-center justify-between font-mono text-xs"
            >
              <span>{risk.title}</span>
              <span className="text-primary font-bold">
                Score: {risk.residual_score}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
});
