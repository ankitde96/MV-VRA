import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import type { ReviewState } from "./review-state";

export type ReviewStatusFacet = "unmarked" | "non_compliant";

export interface ReviewFilters {
  statuses: ReviewStatusFacet[];
  missingEvidence: boolean;
  riskRaised: boolean;
}

export interface ReviewProgressSummary {
  reviewed: number;
  total: number;
  percentage: number;
}

export interface ReviewFacetCounts {
  unmarked: number;
  nonCompliant: number;
  missingEvidence: number;
  riskRaised: number;
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  statuses: [],
  missingEvidence: false,
  riskRaised: false,
};

export function hasMissingOrInsufficientEvidence(
  question: ReviewerQuestionItem,
): boolean {
  return (
    question.evidence.length === 0 ||
    question.evidence.some((evidence) => evidence.flag?.flag === "insufficient")
  );
}

export function hasActiveReviewFilters(
  filters: ReviewFilters,
  query: string,
): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.missingEvidence ||
    filters.riskRaised ||
    query.trim().length > 0
  );
}

export function getReviewProgress(
  questions: ReviewerQuestionItem[],
  reviewState: ReviewState,
): ReviewProgressSummary {
  const visible = questions.filter((question) => !question.is_suppressed);
  const reviewed = visible.filter(
    (question) => reviewState[question.control_id]?.verdict != null,
  ).length;
  return {
    reviewed,
    total: visible.length,
    percentage:
      visible.length === 0 ? 0 : Math.round((reviewed / visible.length) * 100),
  };
}

export function getReviewFacetCounts(
  questions: ReviewerQuestionItem[],
  reviewState: ReviewState,
): ReviewFacetCounts {
  const visible = questions.filter((question) => !question.is_suppressed);
  return {
    unmarked: visible.filter(
      (question) => reviewState[question.control_id]?.verdict == null,
    ).length,
    nonCompliant: visible.filter(
      (question) =>
        reviewState[question.control_id]?.verdict === "non_compliant",
    ).length,
    missingEvidence: visible.filter(hasMissingOrInsufficientEvidence).length,
    riskRaised: visible.filter(
      (question) => question.associated_risks.length > 0,
    ).length,
  };
}

export function filterReviewQuestions(
  questions: ReviewerQuestionItem[],
  reviewState: ReviewState,
  filters: ReviewFilters,
  query: string,
): ReviewerQuestionItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtering = hasActiveReviewFilters(filters, query);

  return questions.filter((question) => {
    // Preserve suppressed controls as historical context in the unfiltered view, but never
    // treat them as reviewer work or return them as filter/search matches.
    if (question.is_suppressed) return !filtering;

    const verdict = reviewState[question.control_id]?.verdict ?? null;
    if (
      filters.statuses.length > 0 &&
      !filters.statuses.some((status) =>
        status === "unmarked" ? verdict === null : verdict === "non_compliant",
      )
    ) {
      return false;
    }
    if (
      filters.missingEvidence &&
      !hasMissingOrInsufficientEvidence(question)
    ) {
      return false;
    }
    if (filters.riskRaised && question.associated_risks.length === 0)
      return false;
    if (
      normalizedQuery &&
      !question.control_id.toLocaleLowerCase().includes(normalizedQuery) &&
      !question.text.toLocaleLowerCase().includes(normalizedQuery)
    ) {
      return false;
    }
    return true;
  });
}

export function getKeyboardNavigableControlIds(
  questions: ReviewerQuestionItem[],
): string[] {
  return questions
    .filter((question) => !question.is_suppressed)
    .map((question) => question.control_id);
}

export function getReviewControlDomId(controlId: string): string {
  return `review-control-${encodeURIComponent(controlId)}`;
}

export function getReviewNoteDomId(controlId: string): string {
  return `review-note-${encodeURIComponent(controlId)}`;
}
