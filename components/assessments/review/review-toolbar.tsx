"use client";

import {
  ChevronsUpDownIcon,
  DownloadIcon,
  KeyboardIcon,
  RotateCcwIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type {
  ReviewFacetCounts,
  ReviewFilters,
  ReviewProgressSummary,
  ReviewStatusFacet,
} from "./review-productivity";

interface ReviewToolbarProps {
  progress: ReviewProgressSummary;
  facetCounts: ReviewFacetCounts;
  filters: ReviewFilters;
  query: string;
  matchingCount: number;
  allSectionsExpanded: boolean;
  sectionsLockedOpen: boolean;
  searchInputId: string;
  onQueryChange: (query: string) => void;
  onToggleStatus: (status: ReviewStatusFacet) => void;
  onToggleMissingEvidence: () => void;
  onToggleRiskRaised: () => void;
  onClearFilters: () => void;
  onToggleAllSections: () => void;
  onOpenShortcuts: () => void;
  evidenceExportUrl: string | null;
  reportCsvUrl: string;
  reportPdfUrl: string;
}

function FacetButton({
  pressed,
  count,
  children,
  onClick,
}: {
  pressed: boolean;
  count: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="xs"
      variant={pressed ? "default" : "outline"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
      <span
        className={
          pressed
            ? "text-primary-foreground/75 tabular-nums"
            : "text-muted-foreground tabular-nums"
        }
      >
        {count}
      </span>
    </Button>
  );
}

export function ReviewToolbar({
  progress,
  facetCounts,
  filters,
  query,
  matchingCount,
  allSectionsExpanded,
  sectionsLockedOpen,
  searchInputId,
  onQueryChange,
  onToggleStatus,
  onToggleMissingEvidence,
  onToggleRiskRaised,
  onClearFilters,
  onToggleAllSections,
  onOpenShortcuts,
  evidenceExportUrl,
  reportCsvUrl,
  reportPdfUrl,
}: ReviewToolbarProps) {
  const hasFilters =
    filters.statuses.length > 0 ||
    filters.missingEvidence ||
    filters.riskRaised ||
    query.trim().length > 0;

  return (
    <div className="bg-background/95 sticky top-2 z-(--z-sticky-header) space-y-3 rounded-lg border p-3 shadow-(--shadow-float) supports-backdrop-filter:backdrop-blur-md">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Progress
          value={progress.percentage}
          className="min-w-48 flex-1 gap-x-3 gap-y-1"
          aria-label={`${progress.reviewed} of ${progress.total} visible controls reviewed`}
        >
          <ProgressLabel className="text-xs font-semibold">
            Review progress
          </ProgressLabel>
          <span className="text-muted-foreground ml-auto text-sm tabular-nums">
            {progress.reviewed} / {progress.total} reviewed
          </span>
        </Progress>

        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search control ID or question…"
            className="pr-14 pl-8"
            aria-label="Search review controls"
          />
          <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            /
          </kbd>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground mr-1 text-[11px] font-semibold tracking-wide uppercase">
          Show
        </span>
        <FacetButton
          pressed={filters.statuses.includes("unmarked")}
          count={facetCounts.unmarked}
          onClick={() => onToggleStatus("unmarked")}
        >
          Unmarked
        </FacetButton>
        <FacetButton
          pressed={filters.statuses.includes("non_compliant")}
          count={facetCounts.nonCompliant}
          onClick={() => onToggleStatus("non_compliant")}
        >
          Non-compliant
        </FacetButton>
        <FacetButton
          pressed={filters.missingEvidence}
          count={facetCounts.missingEvidence}
          onClick={onToggleMissingEvidence}
        >
          Missing evidence
        </FacetButton>
        <FacetButton
          pressed={filters.riskRaised}
          count={facetCounts.riskRaised}
          onClick={onToggleRiskRaised}
        >
          Risk raised
        </FacetButton>

        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {matchingCount} visible
        </span>
        {hasFilters ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onClearFilters}
          >
            <RotateCcwIcon />
            Reset
          </Button>
        ) : null}
        {evidenceExportUrl ? (
          <Button
            size="xs"
            variant="outline"
            render={<a href={evidenceExportUrl} />}
          >
            <DownloadIcon />
            Download evidence ZIP
          </Button>
        ) : null}
        <Button size="xs" variant="outline" render={<a href={reportCsvUrl} />}>
          <DownloadIcon />
          CSV report
        </Button>
        <Button size="xs" variant="outline" render={<a href={reportPdfUrl} />}>
          <DownloadIcon />
          PDF report
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={onToggleAllSections}
          disabled={sectionsLockedOpen}
          title={
            sectionsLockedOpen
              ? "Matched sections stay expanded while filters are active"
              : undefined
          }
        >
          <ChevronsUpDownIcon />
          {allSectionsExpanded ? "Collapse all" : "Expand all"}
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          onClick={onOpenShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <KeyboardIcon />
        </Button>
      </div>
    </div>
  );
}
