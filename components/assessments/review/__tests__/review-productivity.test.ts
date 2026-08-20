import { describe, expect, it } from "vitest";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import {
  filterReviewQuestions,
  getKeyboardNavigableControlIds,
  getReviewFacetCounts,
  getReviewProgress,
  type ReviewFilters,
} from "../review-productivity";
import {
  parseReviewUrlState,
  reviewFiltersToUrlUpdates,
} from "../review-url-state";
import type { ReviewState } from "../review-state";

function question(
  controlId: string,
  overrides: Partial<ReviewerQuestionItem> = {},
): ReviewerQuestionItem {
  return {
    control_id: controlId,
    text: `${controlId} question text`,
    type: "text",
    section_title: "Section",
    is_required: true,
    response_value: "answer",
    review_status: null,
    reviewer_note: "",
    evidence: [],
    is_suppressed: false,
    control_status: "passed",
    associated_risks: [],
    ...overrides,
  };
}

const questions = [
  question("CTRL-1", {
    text: "Encryption at rest",
    evidence: [
      {
        id: "evidence-1",
        filename: "policy.pdf",
        mime: "application/pdf",
        size: 10,
        uploaded_at: "2026-08-20T00:00:00.000Z",
        uploaded_by_label: "Vendor SPOC",
        download_url: "/evidence/1",
      },
    ],
  }),
  question("CTRL-2", {
    text: "Access review",
    associated_risks: [
      {
        id: "risk-1",
        title: "Access gap",
        severity: "high",
        residual_score: 42,
        status: "open",
      },
    ],
  }),
  question("CTRL-3", { is_suppressed: true, control_status: "suppressed" }),
];

const reviewState: ReviewState = {
  "CTRL-1": {
    verdict: "compliant",
    note: "",
    savedAt: null,
    saving: false,
    error: false,
  },
  "CTRL-2": {
    verdict: "non_compliant",
    note: "",
    savedAt: null,
    saving: false,
    error: false,
  },
  "CTRL-3": {
    verdict: null,
    note: "",
    savedAt: null,
    saving: false,
    error: false,
  },
};

describe("review productivity helpers", () => {
  it("excludes suppressed controls from progress, facets, and keyboard navigation", () => {
    expect(getReviewProgress(questions, reviewState)).toEqual({
      reviewed: 2,
      total: 2,
      percentage: 100,
    });
    expect(getReviewFacetCounts(questions, reviewState)).toEqual({
      unmarked: 0,
      nonCompliant: 1,
      missingEvidence: 1,
      riskRaised: 1,
    });
    expect(getKeyboardNavigableControlIds(questions)).toEqual([
      "CTRL-1",
      "CTRL-2",
    ]);
  });

  it("ORs statuses and ANDs them with evidence and risk facets", () => {
    const state = {
      ...reviewState,
      "CTRL-1": { ...reviewState["CTRL-1"]!, verdict: null },
    };
    const statusFilters: ReviewFilters = {
      statuses: ["unmarked", "non_compliant"],
      missingEvidence: false,
      riskRaised: false,
    };
    expect(
      filterReviewQuestions(questions, state, statusFilters, "").map(
        (item) => item.control_id,
      ),
    ).toEqual(["CTRL-1", "CTRL-2"]);

    expect(
      filterReviewQuestions(
        questions,
        state,
        { ...statusFilters, missingEvidence: true, riskRaised: true },
        "",
      ).map((item) => item.control_id),
    ).toEqual(["CTRL-2"]);
  });

  it("searches control id and text case-insensitively and omits suppressed matches", () => {
    const emptyFilters: ReviewFilters = {
      statuses: [],
      missingEvidence: false,
      riskRaised: false,
    };
    expect(
      filterReviewQuestions(questions, reviewState, emptyFilters, "ctrl-1"),
    ).toEqual([questions[0]]);
    expect(
      filterReviewQuestions(questions, reviewState, emptyFilters, "ACCESS"),
    ).toEqual([questions[1]]);
    expect(
      filterReviewQuestions(questions, reviewState, emptyFilters, "CTRL-3"),
    ).toEqual([]);
  });

  it("parses and serializes the persisted URL state defensively", () => {
    expect(parseReviewUrlState(new URLSearchParams())).toEqual({
      query: "",
      filters: {
        statuses: [],
        missingEvidence: false,
        riskRaised: false,
      },
      collapsedSections: [],
      focusedControlId: null,
    });
    const params = new URLSearchParams(
      "q=access&review=unmarked,invalid,non_compliant&evidence=missing&risk=raised&collapsed=0,2,nope,-1&focus=CTRL-2",
    );
    expect(parseReviewUrlState(params)).toEqual({
      query: "access",
      filters: {
        statuses: ["unmarked", "non_compliant"],
        missingEvidence: true,
        riskRaised: true,
      },
      collapsedSections: [0, 2],
      focusedControlId: "CTRL-2",
    });
    expect(
      reviewFiltersToUrlUpdates({
        statuses: ["unmarked"],
        missingEvidence: false,
        riskRaised: true,
      }),
    ).toEqual({ review: "unmarked", evidence: null, risk: "raised" });
  });
});
