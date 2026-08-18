import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/domain/status-badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { History } from "lucide-react";

/**
 * Vendor scorecard's assessment history (UI Revamp Round 2 Phase E) — one row per
 * assessment, newest first (the service already sorts by `created_at` descending).
 */
export function AssessmentHistoryList({
  history,
}: {
  history: Array<{
    assessment_id: string;
    status: string;
    template_version: number;
    assigned_at: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  }>;
}) {
  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle>Assessment history</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No assessments yet</EmptyTitle>
              <EmptyDescription>
                Once a template is assigned, it appears here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-border -mx-6 divide-y">
            {history.map((a) => (
              <li key={a.assessment_id}>
                <Link
                  href={`/assessments/${a.assessment_id}`}
                  className="hover:bg-muted/60 flex items-center justify-between gap-3 px-6 py-2.5 text-sm transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">v{a.template_version}</span>
                    <StatusBadge status={a.status} />
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {a.reviewed_at
                      ? `reviewed ${a.reviewed_at.slice(0, 10)}`
                      : a.submitted_at
                        ? `submitted ${a.submitted_at.slice(0, 10)}`
                        : a.assigned_at
                          ? `assigned ${a.assigned_at.slice(0, 10)}`
                          : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
