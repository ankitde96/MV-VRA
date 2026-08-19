"use client";

import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import { ReviewQuestionRow } from "./review-question-row";
import type { ReviewState, ReviewVerdict } from "./review-state";

interface ReviewSectionProps {
  title: string;
  questions: ReviewerQuestionItem[];
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
}

export function ReviewSection({
  title,
  questions,
  reviewState,
  isCompleted,
  onVerdictChange,
  onNoteChange,
  onRaiseRisk,
}: ReviewSectionProps) {
  return (
    <div className="bg-card space-y-3 rounded-lg border p-4">
      <h3 className="text-foreground border-b pb-2 text-sm font-semibold">
        {title}
      </h3>
      <div className="space-y-4 pt-1">
        {questions.map((question) => (
          <ReviewQuestionRow
            key={question.control_id}
            question={question}
            review={reviewState[question.control_id]!}
            isCompleted={isCompleted}
            onVerdictChange={onVerdictChange}
            onNoteChange={onNoteChange}
            onRaiseRisk={onRaiseRisk}
          />
        ))}
      </div>
    </div>
  );
}
