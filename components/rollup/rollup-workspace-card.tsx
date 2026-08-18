"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBarChart } from "@/components/charts/severity-bar-chart";
import type { WorkspaceRollup } from "@/lib/services/executive-rollup";

/**
 * DESIGN-SYSTEM.md §5: every chart needs a data-table alternative. Keeps the original
 * tables (UI-REVAMP-PLAN.md Phase 3 — "move them behind a 'View as table' toggle rather
 * than deleting them") instead of replacing them outright.
 */
export function RollupWorkspaceCard({
  workspace,
}: {
  workspace: WorkspaceRollup;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className="shadow-(--shadow-card)">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{workspace.workspace_name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {workspace.role.replace("_", " ")}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "View as chart" : "View as table"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showTable ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                Vendors by tier
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Tier 1</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.vendors_by_tier.tier1}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tier 2</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.vendors_by_tier.tier2}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Tier 3</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.vendors_by_tier.tier3}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Unscored</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.vendors_by_tier.unscored}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                Open risks by severity
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Critical</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.open_risks_by_severity.critical}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>High</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.open_risks_by_severity.high}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Medium</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.open_risks_by_severity.medium}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Low</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {workspace.open_risks_by_severity.low}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase">
              Open risks by severity
            </h3>
            <SeverityBarChart data={workspace.open_risks_by_severity} />
          </div>
        )}

        <p className="text-muted-foreground mt-4 text-xs">
          {workspace.overdue_cap_tasks} overdue corrective action
          {workspace.overdue_cap_tasks === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  );
}
