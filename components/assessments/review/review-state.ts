import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";

export type ReviewVerdict = ReviewerQuestionItem["review_status"];

export interface ReviewItemState {
  verdict: ReviewVerdict;
  note: string;
  savedAt: Date | null;
  error: boolean;
}

export type ReviewState = Record<string, ReviewItemState>;

export type ReviewStateAction =
  | { type: "verdict_changed"; controlId: string; verdict: ReviewVerdict }
  | { type: "note_changed"; controlId: string; note: string }
  | { type: "save_succeeded"; controlId: string; savedAt: Date }
  | { type: "save_failed"; controlId: string };

export function createInitialReviewState(
  questions: ReviewerQuestionItem[],
): ReviewState {
  return Object.fromEntries(
    questions.map((question) => [
      question.control_id,
      {
        verdict: question.review_status,
        note: question.reviewer_note,
        savedAt: null,
        error: false,
      },
    ]),
  );
}

export function reviewStateReducer(
  state: ReviewState,
  action: ReviewStateAction,
): ReviewState {
  const current = state[action.controlId];
  if (!current) return state;

  switch (action.type) {
    case "verdict_changed":
      return {
        ...state,
        [action.controlId]: { ...current, verdict: action.verdict },
      };
    case "note_changed":
      return {
        ...state,
        [action.controlId]: { ...current, note: action.note },
      };
    case "save_succeeded":
      return {
        ...state,
        [action.controlId]: {
          ...current,
          savedAt: action.savedAt,
          error: false,
        },
      };
    case "save_failed":
      return {
        ...state,
        [action.controlId]: { ...current, error: true },
      };
  }
}
