"use client";

import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import { ChevronDownIcon } from "lucide-react";
import { ReviewQuestionRow } from "./review-question-row";
import type { ReviewState, ReviewVerdict } from "./review-state";

interface ReviewSectionProps {
  title: string;
  questions: ReviewerQuestionItem[];
  sectionIndex: number;
  expanded: boolean;
  filtersActive: boolean;
  focusedControlId: string | null;
  reviewState: ReviewState;
  isCompleted: boolean;
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
  onToggle: () => void;
  onFocusControl: (controlId: string) => void;
  onRetry: (controlId: string) => void;
  onEvidenceFlagChange: (
    controlId: string,
    evidenceId: string,
    flag: "insufficient" | null,
    note: string,
  ) => Promise<boolean>;
}

export function ReviewSection({
  title,
  questions,
  sectionIndex,
  expanded,
  filtersActive,
  focusedControlId,
  reviewState,
  isCompleted,
  onVerdictChange,
  onNoteChange,
  onRaiseRisk,
  onToggle,
  onFocusControl,
  onRetry,
  onEvidenceFlagChange,
}: ReviewSectionProps) {
  const contentId = `review-section-${sectionIndex}`;
  return (
    <section className="bg-card rounded-lg border">
      <h3>
        <button
          type="button"
          className="focus-visible:ring-ring flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold outline-none focus-visible:ring-3"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
          disabled={filtersActive}
          title={
            filtersActive
              ? "Matched sections stay expanded while filters are active"
              : undefined
          }
        >
          <span>{title}</span>
          <span className="text-muted-foreground flex items-center gap-2 text-xs font-normal tabular-nums">
            {questions.length} control{questions.length === 1 ? "" : "s"}
            <ChevronDownIcon
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </h3>
      {expanded ? (
        <div id={contentId} className="space-y-4 border-t p-4">
          {questions.map((question) => (
            <ReviewQuestionRow
              key={question.control_id}
              question={question}
              review={reviewState[question.control_id]!}
              isCompleted={isCompleted}
              isFocused={focusedControlId === question.control_id}
              onVerdictChange={onVerdictChange}
              onNoteChange={onNoteChange}
              onRaiseRisk={onRaiseRisk}
              onFocusControl={onFocusControl}
              onRetry={onRetry}
              onEvidenceFlagChange={onEvidenceFlagChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
