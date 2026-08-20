"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReviewerQuestionItem } from "@/lib/services/assessment-review";
import {
  filterReviewQuestions,
  getKeyboardNavigableControlIds,
  getReviewControlDomId,
  getReviewFacetCounts,
  getReviewProgress,
  hasActiveReviewFilters,
  type ReviewFilters,
  type ReviewStatusFacet,
} from "@/components/assessments/review/review-productivity";
import { reviewFiltersToUrlUpdates } from "@/components/assessments/review/review-url-state";
import type {
  ReviewState,
  ReviewVerdict,
} from "@/components/assessments/review/review-state";
import { useReviewKeyboardShortcuts } from "@/hooks/use-review-keyboard-shortcuts";
import { useReviewUrlState } from "@/hooks/use-review-url-state";

export const REVIEW_SEARCH_INPUT_ID = "review-control-search";

interface UseReviewProductivityOptions {
  questions: ReviewerQuestionItem[];
  reviewState: ReviewState;
  canEdit: boolean;
  onMarkVerdict: (
    controlId: string,
    verdict: Exclude<ReviewVerdict, null>,
  ) => void;
}

export function useReviewProductivity({
  questions,
  reviewState,
  canEdit,
  onMarkVerdict,
}: UseReviewProductivityOptions) {
  const {
    query: persistedQuery,
    filters,
    collapsedSections,
    focusedControlId: persistedFocusedControlId,
    updateReviewUrlState,
  } = useReviewUrlState();
  const [searchQuery, setSearchQuery] = useState(persistedQuery);
  const [focusedControlId, setFocusedControlId] = useState<string | null>(
    persistedFocusedControlId,
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const restoredFocus = useRef(false);

  const sections = useMemo(() => {
    const grouped = new Map<string, ReviewerQuestionItem[]>();
    for (const question of questions) {
      grouped.set(question.section_title, [
        ...(grouped.get(question.section_title) ?? []),
        question,
      ]);
    }
    return [...grouped.entries()].map(([title, sectionQuestions], index) => ({
      title,
      questions: sectionQuestions,
      index,
    }));
  }, [questions]);
  const filteredQuestions = useMemo(
    () => filterReviewQuestions(questions, reviewState, filters, searchQuery),
    [filters, questions, reviewState, searchQuery],
  );
  const filteredControlIds = useMemo(
    () => getKeyboardNavigableControlIds(filteredQuestions),
    [filteredQuestions],
  );
  const filteredControlIdSet = useMemo(
    () => new Set(filteredQuestions.map((question) => question.control_id)),
    [filteredQuestions],
  );
  const progress = useMemo(
    () => getReviewProgress(questions, reviewState),
    [questions, reviewState],
  );
  const facetCounts = useMemo(
    () => getReviewFacetCounts(questions, reviewState),
    [questions, reviewState],
  );
  const filtersActive = hasActiveReviewFilters(filters, searchQuery);
  const collapsedSectionSet = useMemo(
    () => new Set(collapsedSections),
    [collapsedSections],
  );
  const visibleSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          questions: section.questions.filter((question) =>
            filteredControlIdSet.has(question.control_id),
          ),
        }))
        .filter((section) => section.questions.length > 0),
    [filteredControlIdSet, sections],
  );

  useEffect(() => {
    if (searchQuery === persistedQuery) return;
    const timeout = window.setTimeout(() => {
      updateReviewUrlState({ q: searchQuery.trim() || null });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [persistedQuery, searchQuery, updateReviewUrlState]);

  const setReviewFilters = useCallback(
    (nextFilters: ReviewFilters) => {
      updateReviewUrlState(reviewFiltersToUrlUpdates(nextFilters));
    },
    [updateReviewUrlState],
  );
  const toggleStatusFilter = useCallback(
    (status: ReviewStatusFacet) => {
      setReviewFilters({
        ...filters,
        statuses: filters.statuses.includes(status)
          ? filters.statuses.filter((item) => item !== status)
          : [...filters.statuses, status],
      });
    },
    [filters, setReviewFilters],
  );
  const toggleMissingEvidence = useCallback(() => {
    setReviewFilters({
      ...filters,
      missingEvidence: !filters.missingEvidence,
    });
  }, [filters, setReviewFilters]);
  const toggleRiskRaised = useCallback(() => {
    setReviewFilters({ ...filters, riskRaised: !filters.riskRaised });
  }, [filters, setReviewFilters]);
  const focusControl = useCallback(
    (controlId: string) => {
      setFocusedControlId(controlId);
      if (controlId !== persistedFocusedControlId) {
        updateReviewUrlState({ focus: controlId });
      }
    },
    [persistedFocusedControlId, updateReviewUrlState],
  );
  const markCompliant = useCallback(
    (controlId: string) => onMarkVerdict(controlId, "compliant"),
    [onMarkVerdict],
  );
  const markNonCompliant = useCallback(
    (controlId: string) => onMarkVerdict(controlId, "non_compliant"),
    [onMarkVerdict],
  );
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);

  useReviewKeyboardShortcuts({
    controlIds: filteredControlIds,
    focusedControlId,
    canEdit,
    searchInputId: REVIEW_SEARCH_INPUT_ID,
    onFocusControl: focusControl,
    onMarkCompliant: markCompliant,
    onMarkNonCompliant: markNonCompliant,
    onOpenHelp: openShortcuts,
  });

  useEffect(() => {
    if (
      focusedControlId &&
      filteredControlIds.length > 0 &&
      !filteredControlIds.includes(focusedControlId)
    ) {
      const frame = window.requestAnimationFrame(() => {
        focusControl(filteredControlIds[0]!);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [filteredControlIds, focusControl, focusedControlId]);

  useEffect(() => {
    if (restoredFocus.current || !persistedFocusedControlId) return;
    const frame = window.requestAnimationFrame(() => {
      const row = document.getElementById(
        getReviewControlDomId(persistedFocusedControlId),
      );
      if (!row) return;
      restoredFocus.current = true;
      setFocusedControlId(persistedFocusedControlId);
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [persistedFocusedControlId, visibleSections]);

  const updateCollapsedSections = useCallback(
    (next: Set<number>) => {
      updateReviewUrlState({
        collapsed:
          next.size > 0
            ? [...next].sort((left, right) => left - right).join(",")
            : null,
      });
    },
    [updateReviewUrlState],
  );
  const toggleSection = useCallback(
    (sectionIndex: number) => {
      if (filtersActive) return;
      if (
        focusedControlId &&
        sections[sectionIndex]?.questions.some(
          (question) => question.control_id === focusedControlId,
        )
      ) {
        setFocusedControlId(null);
        updateReviewUrlState({ focus: null });
      }
      const next = new Set(collapsedSectionSet);
      if (next.has(sectionIndex)) next.delete(sectionIndex);
      else next.add(sectionIndex);
      updateCollapsedSections(next);
    },
    [
      collapsedSectionSet,
      filtersActive,
      focusedControlId,
      sections,
      updateCollapsedSections,
      updateReviewUrlState,
    ],
  );
  const toggleAllSections = useCallback(() => {
    if (filtersActive) return;
    if (collapsedSectionSet.size === 0) {
      setFocusedControlId(null);
      updateReviewUrlState({ focus: null });
    }
    updateCollapsedSections(
      collapsedSectionSet.size === 0
        ? new Set(sections.map((section) => section.index))
        : new Set(),
    );
  }, [
    collapsedSectionSet.size,
    filtersActive,
    sections,
    updateCollapsedSections,
    updateReviewUrlState,
  ]);
  const clearProductivityFilters = useCallback(() => {
    setSearchQuery("");
    updateReviewUrlState({
      q: null,
      review: null,
      evidence: null,
      risk: null,
    });
  }, [updateReviewUrlState]);

  return {
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
  };
}
