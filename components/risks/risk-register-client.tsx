"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddCapTaskDialog } from "@/components/risks/add-cap-task-dialog";
import {
  SeverityBadge,
  type Severity,
} from "@/components/domain/severity-badge";
import { StatusBadge } from "@/components/domain/status-badge";

interface CapTaskItem {
  task_id: string;
  description: string;
  owner_type: "internal" | "vendor";
  owner_label: string;
  due_date: string;
  status: "open" | "in_progress" | "overdue" | "closed";
  closed_at: string | null;
  escalated_at: string | null;
}

interface RiskItem {
  id: string;
  vendor_id: string;
  vendor_name: string;
  assessment_id: string;
  control_id: string;
  title: string;
  description: string;
  severity: string;
  enterprise_risk_category: string;
  impact_level: string;
  residual_score: number;
  status: string;
  created_at: string;
  cap_tasks_count?: number;
  cap_tasks?: CapTaskItem[];
}

interface OverdueQueueItem {
  risk_id: string;
  task_id: string;
  risk_title: string;
  control_id: string;
  vendor_name: string;
  description: string;
  owner_label: string;
  due_date: string;
  newly_escalated: boolean;
}

interface RiskRegisterClientProps {
  initialRisks: RiskItem[];
  categories: string[];
  isProvisionalTaxonomy: boolean;
}

export function RiskRegisterClient({
  initialRisks,
  categories,
  isProvisionalTaxonomy,
}: RiskRegisterClientProps) {
  const router = useRouter();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [capDialogRisk, setCapDialogRisk] = useState<RiskItem | null>(null);
  const [overdueQueue, setOverdueQueue] = useState<OverdueQueueItem[] | null>(
    null,
  );
  const [overdueLoading, setOverdueLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // PLAN.md Phase 9 exit criterion: this GET both detects overdue CAPs and escalates any
  // that haven't been escalated yet — request-driven, triggered by this page load, no job
  // runner. Re-running it (e.g. a refresh) never re-sends an escalation already stamped
  // `escalated_at` server-side.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/risks/cap-tasks/overdue")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body) => {
        if (!cancelled) setOverdueQueue(body.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setOverdueQueue([]);
      })
      .finally(() => {
        if (!cancelled) setOverdueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRisks = initialRisks.filter((risk) => {
    if (severityFilter !== "all" && risk.severity !== severityFilter)
      return false;
    if (
      categoryFilter !== "all" &&
      risk.enterprise_risk_category !== categoryFilter
    )
      return false;
    if (statusFilter !== "all" && risk.status !== statusFilter) return false;
    return true;
  });

  async function handleCapStatusChange(
    riskId: string,
    taskId: string,
    status: string,
  ) {
    setUpdatingTaskId(taskId);
    try {
      const res = await fetch(`/api/risks/${riskId}/cap-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Overdue CAP Queue */}
      {overdueLoading ? null : overdueQueue && overdueQueue.length > 0 ? (
        <section className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-4">
          <h2 className="text-destructive text-sm font-semibold">
            Overdue Corrective Actions ({overdueQueue.length})
          </h2>
          <div className="bg-card divide-y rounded-md border">
            {overdueQueue.map((item) => (
              <div
                key={item.task_id}
                className="flex items-center justify-between gap-4 p-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-mono font-bold">
                      {item.control_id}
                    </span>
                    <span className="text-foreground font-medium">
                      {item.risk_title}
                    </span>
                    {item.newly_escalated ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-300"
                      >
                        Escalation sent
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground">
                    {item.description} — owned by {item.owner_label} (
                    {item.vendor_name})
                  </p>
                </div>
                <span className="text-destructive shrink-0 font-mono font-semibold">
                  Due {new Date(item.due_date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-xl font-bold">
            Unified Risk Register
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Workspace-wide register of Identified Risks mapped to enterprise
            categories with authoritative residual scores.
          </p>
        </div>

        <div className="text-right text-xs">
          <span className="text-muted-foreground block font-medium">
            Total Risks
          </span>
          <span className="text-primary font-mono text-lg font-bold">
            {filteredRisks.length}
          </span>
        </div>
      </div>

      {/* Provisional Taxonomy Banner */}
      {isProvisionalTaxonomy ? (
        <div className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <span>
            <strong className="font-semibold">
              Provisional Taxonomy Notice:
            </strong>{" "}
            Enterprise risk categories are using seeded defaults (Information
            Security, Data Privacy &amp; Protection, etc.).
          </span>
          <Badge
            variant="outline"
            className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-300"
          >
            Provisional
          </Badge>
        </div>
      ) : null}

      {/* Filters */}
      <div className="bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Severity:
          </span>
          <Select
            value={severityFilter}
            onValueChange={(val: string | null) =>
              setSeverityFilter(val ?? "all")
            }
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Category:
          </span>
          <Select
            value={categoryFilter}
            onValueChange={(val: string | null) =>
              setCategoryFilter(val ?? "all")
            }
          >
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium">
            Status:
          </span>
          <Select
            value={statusFilter}
            onValueChange={(val: string | null) =>
              setStatusFilter(val ?? "all")
            }
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="mitigating">Mitigating</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card overflow-hidden rounded-lg border">
        {filteredRisks.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            No identified risks match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-(--z-sticky-header)">
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Risk Title &amp; Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Residual Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>CAP Tasks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRisks.map((risk) => {
                  const isExpanded = expandedRiskId === risk.id;
                  const capTasks = risk.cap_tasks ?? [];
                  return (
                    <Fragment key={risk.id}>
                      <TableRow className="hover:bg-muted/20">
                        <TableCell className="font-mono font-medium">
                          {risk.control_id}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={`/vendors/${risk.vendor_id}`}
                            className="hover:underline"
                          >
                            {risk.vendor_name}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-64">
                          <span className="text-foreground block font-medium">
                            {risk.title}
                          </span>
                          {risk.description ? (
                            <p className="text-muted-foreground line-clamp-1 text-xs">
                              {risk.description}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {risk.enterprise_risk_category}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={risk.severity as Severity} />
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize">
                          {risk.impact_level}
                        </TableCell>
                        <TableCell className="text-primary font-mono font-semibold tabular-nums">
                          {risk.residual_score}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={risk.status} />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRiskId(isExpanded ? null : risk.id)
                            }
                            className="text-primary cursor-pointer font-medium hover:underline"
                          >
                            {capTasks.length} {isExpanded ? "▲" : "▼"}
                          </button>
                        </TableCell>
                        <TableCell className="space-x-3 text-right">
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            onClick={() => setCapDialogRisk(risk)}
                          >
                            + CAP
                          </Button>
                          <Link
                            href={`/assessments/${risk.assessment_id}`}
                            className="text-primary font-medium hover:underline"
                          >
                            Review ↗
                          </Link>
                        </TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableCell colSpan={10}>
                            {capTasks.length === 0 ? (
                              <p className="text-muted-foreground text-xs">
                                No corrective action tasks yet.
                              </p>
                            ) : (
                              <div className="bg-card divide-y rounded-md border">
                                {capTasks.map((task) => (
                                  <div
                                    key={task.task_id}
                                    className="flex flex-wrap items-center justify-between gap-3 p-2.5 text-xs"
                                  >
                                    <div className="min-w-0 space-y-0.5">
                                      <span className="text-foreground block font-medium">
                                        {task.description}
                                      </span>
                                      <span className="text-muted-foreground">
                                        Owner: {task.owner_label} (
                                        {task.owner_type}) — Due{" "}
                                        {new Date(
                                          task.due_date,
                                        ).toLocaleDateString()}
                                        {task.escalated_at
                                          ? " — escalation sent"
                                          : ""}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <StatusBadge status={task.status} />
                                      <Select
                                        value={task.status}
                                        onValueChange={(val: string | null) =>
                                          val &&
                                          handleCapStatusChange(
                                            risk.id,
                                            task.task_id,
                                            val,
                                          )
                                        }
                                        disabled={
                                          updatingTaskId === task.task_id
                                        }
                                      >
                                        <SelectTrigger className="h-7 w-32 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="open">
                                            Open
                                          </SelectItem>
                                          <SelectItem value="in_progress">
                                            In Progress
                                          </SelectItem>
                                          <SelectItem value="overdue">
                                            Overdue
                                          </SelectItem>
                                          <SelectItem value="closed">
                                            Closed
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {capDialogRisk ? (
        <AddCapTaskDialog
          riskId={capDialogRisk.id}
          riskTitle={capDialogRisk.title}
          vendorName={capDialogRisk.vendor_name}
          open={Boolean(capDialogRisk)}
          onOpenChange={(open) => {
            if (!open) setCapDialogRisk(null);
          }}
        />
      ) : null}
    </div>
  );
}
