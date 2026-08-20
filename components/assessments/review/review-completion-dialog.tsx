"use client";

import { useState } from "react";
import {
  AlertCircleIcon,
  CalendarIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssessmentCompletionSummary } from "@/lib/services/assessment-report";

interface ReviewCompletionDialogProps {
  open: boolean;
  summary: AssessmentCompletionSummary | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (overrideIncompleteCapTasks: boolean) => void;
}

export function ReviewCompletionDialog({
  open,
  summary,
  submitting,
  onOpenChange,
  onConfirm,
}: ReviewCompletionDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setAcknowledged(false);
    onOpenChange(nextOpen);
  };
  const hasBlockers = Boolean(summary && !summary.can_complete);
  const hasCapWarning = Boolean(summary?.cap_completeness.incomplete_tasks);
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Complete assessment review</DialogTitle>
          <DialogDescription>
            Confirm the server-calculated review record before freezing this
            review as complete.
          </DialogDescription>
        </DialogHeader>
        {!summary ? (
          <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
            Loading completion summary…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [
                  "Reviewed",
                  `${summary.controls.reviewed}/${summary.controls.total}`,
                ],
                ["Compliant", summary.controls.compliant],
                ["Non-compliant", summary.controls.non_compliant],
                ["Risks", summary.risks.total],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-card p-3">
                  <span className="block text-xs text-muted-foreground">
                    {label}
                  </span>
                  <span className="mt-1 block text-lg font-semibold tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Risk severity distribution"
            >
              {Object.entries(summary.risks.by_severity).map(
                ([severity, count]) => (
                  <Badge
                    key={severity}
                    variant="outline"
                    className="capitalize"
                  >
                    {severity}: {count}
                  </Badge>
                ),
              )}
            </div>
            {hasBlockers ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Completion is blocked</AlertTitle>
                <AlertDescription>
                  <div>
                    Resolve these controls before completing the review.
                  </div>
                  {summary.blockers.unmarked_control_ids.length ? (
                    <div className="mt-1">
                      Unmarked:{" "}
                      {summary.blockers.unmarked_control_ids.join(", ")}
                    </div>
                  ) : null}
                  {summary.blockers.non_compliant_without_risk_control_ids
                    .length ? (
                    <div className="mt-1">
                      Non-compliant without risk:{" "}
                      {summary.blockers.non_compliant_without_risk_control_ids.join(
                        ", ",
                      )}
                    </div>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {hasCapWarning ? (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100">
                <TriangleAlertIcon />
                <AlertTitle>Incomplete corrective action details</AlertTitle>
                <AlertDescription className="text-current/80">
                  <div>
                    {summary.cap_completeness.incomplete_tasks} task
                    {summary.cap_completeness.incomplete_tasks === 1
                      ? " is"
                      : "s are"}{" "}
                    missing an owner or due date.
                  </div>
                  <ul className="mt-2 list-disc pl-4">
                    {summary.cap_completeness.issues.map((issue) => (
                      <li key={`${issue.risk_id}-${issue.task_id}`}>
                        {issue.risk_title}: {issue.task_description} — missing{" "}
                        {issue.missing_fields.join(" and ")}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium">
                    <Checkbox
                      checked={acknowledged}
                      onCheckedChange={(checked) =>
                        setAcknowledged(Boolean(checked))
                      }
                    />
                    I acknowledge these incomplete CAP details. This override
                    will be audited.
                  </label>
                </AlertDescription>
              </Alert>
            ) : null}
            {summary.insufficient_evidence.count > 0 ? (
              <Alert>
                <InfoIcon />
                <AlertTitle>Insufficient evidence noted</AlertTitle>
                <AlertDescription>
                  {summary.insufficient_evidence.count} control
                  {summary.insufficient_evidence.count === 1
                    ? " has"
                    : "s have"}{" "}
                  evidence flagged as insufficient:{" "}
                  {summary.insufficient_evidence.control_ids.join(", ")}. This
                  is informational and does not block completion.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <CalendarIcon className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Next review due</span>
              <span className="ml-auto font-medium">
                {summary.next_review_due
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                    }).format(new Date(summary.next_review_due))
                  : "Not scheduled (vendor tier unscored)"}
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(hasCapWarning && acknowledged)}
            disabled={
              !summary ||
              submitting ||
              hasBlockers ||
              (hasCapWarning && !acknowledged)
            }
          >
            {submitting ? "Completing…" : "Confirm completion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
