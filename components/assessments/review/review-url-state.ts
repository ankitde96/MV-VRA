import type { ReviewFilters, ReviewStatusFacet } from "./review-productivity";

export interface ReviewUrlState {
  query: string;
  filters: ReviewFilters;
  collapsedSections: number[];
  focusedControlId: string | null;
}

const VALID_STATUSES = new Set<ReviewStatusFacet>([
  "unmarked",
  "non_compliant",
]);

export function parseReviewUrlState(
  searchParams: Pick<URLSearchParams, "get">,
): ReviewUrlState {
  const statuses = (searchParams.get("review") ?? "")
    .split(",")
    .filter((value): value is ReviewStatusFacet =>
      VALID_STATUSES.has(value as ReviewStatusFacet),
    );
  const collapsedSections = (searchParams.get("collapsed") ?? "")
    .split(",")
    .filter((value) => value.length > 0)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0);

  return {
    query: searchParams.get("q") ?? "",
    filters: {
      statuses: [...new Set(statuses)],
      missingEvidence: searchParams.get("evidence") === "missing",
      riskRaised: searchParams.get("risk") === "raised",
    },
    collapsedSections: [...new Set(collapsedSections)],
    focusedControlId: searchParams.get("focus") || null,
  };
}

export function reviewFiltersToUrlUpdates(
  filters: ReviewFilters,
): Record<string, string | null> {
  return {
    review: filters.statuses.length > 0 ? filters.statuses.join(",") : null,
    evidence: filters.missingEvidence ? "missing" : null,
    risk: filters.riskRaised ? "raised" : null,
  };
}
