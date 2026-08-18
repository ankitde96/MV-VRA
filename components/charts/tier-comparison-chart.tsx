"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WorkspaceKriSummary } from "@/lib/services/analytics";

const chartConfig = {
  tier1: { label: "Tier 1", color: "var(--color-risk-critical)" },
  tier2: { label: "Tier 2", color: "var(--color-risk-high)" },
  tier3: { label: "Tier 3", color: "var(--color-risk-low)" },
  unscored: { label: "Unscored", color: "var(--color-risk-neutral)" },
} satisfies ChartConfig;

/**
 * DESIGN-SYSTEM.md §5: "Horizontal bar, grouped, sorted descending" for vendors per tier per
 * workspace — specified for the executive roll-up in Round 1 but never built (Round 1 only
 * shipped a single-workspace stacked bar, `tier-distribution-chart.tsx`). Sorted by Tier 1
 * count descending, per spec, so the highest-exposure workspace reads first.
 */
export function TierComparisonChart({
  workspaces,
}: {
  workspaces: WorkspaceKriSummary[];
}) {
  const [showTable, setShowTable] = useState(false);
  const rows = [...workspaces]
    .sort((a, b) => b.vendors_by_tier.tier1 - a.vendors_by_tier.tier1)
    .map((w) => ({ name: w.workspace_name, ...w.vendors_by_tier }));

  return (
    <Card className="glass-panel">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Vendors per tier, per workspace</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? "View as chart" : "View as table"}
        </Button>
      </CardHeader>
      <CardContent>
        {showTable ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead className="text-right">Tier 1</TableHead>
                <TableHead className="text-right">Tier 2</TableHead>
                <TableHead className="text-right">Tier 3</TableHead>
                <TableHead className="text-right">Unscored</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.tier1}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.tier2}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.tier3}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.unscored}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: Math.max(120, rows.length * 56) }}
          >
            <BarChart data={rows} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="tier1" fill="var(--color-tier1)" radius={4} />
              <Bar dataKey="tier2" fill="var(--color-tier2)" radius={4} />
              <Bar dataKey="tier3" fill="var(--color-tier3)" radius={4} />
              <Bar dataKey="unscored" fill="var(--color-unscored)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
