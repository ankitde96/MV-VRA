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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlarmClockOff } from "lucide-react";
import type { WorkspaceKriSummary } from "@/lib/services/analytics";

const chartConfig = {
  d0to30: { label: "0-30 days", color: "var(--color-chart-1)" },
  d31to60: { label: "31-60 days", color: "var(--color-chart-2)" },
  d61to90: { label: "61-90 days", color: "var(--color-chart-3)" },
  d90plus: { label: "90+ days", color: "var(--color-chart-5)" },
} satisfies ChartConfig;

/**
 * DESIGN-SYSTEM.md §5: "Bar — comparison, not part-to-whole" for open CAPs by age bucket.
 * Comparison axis, not the risk-severity axis — deliberately uses the generic chart-1..5
 * ramp, not the risk-severity tokens, since age bucket (not severity) is what's being
 * compared here. Horizontal orientation (like `TierComparisonChart`), not vertical — with
 * only 2-3 workspaces, full workspace names as vertical-bar x-axis category labels collided
 * with the legend row in the initial build (caught during live browser verification, not
 * assumed); horizontal bars give names a full-width y-axis instead.
 */
export function CapAgeBucketChart({
  workspaces,
}: {
  workspaces: WorkspaceKriSummary[];
}) {
  const [showTable, setShowTable] = useState(false);
  const rows = workspaces.map((w) => ({
    name: w.workspace_name,
    ...w.cap_age_buckets,
  }));
  const hasData = rows.some(
    (r) => r.d0to30 + r.d31to60 + r.d61to90 + r.d90plus > 0,
  );

  if (!hasData) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Overdue CAPs by age</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlarmClockOff />
              </EmptyMedia>
              <EmptyTitle>No overdue corrective actions</EmptyTitle>
              <EmptyDescription>
                Every CAP task across your authorized workspaces is on schedule.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Overdue CAPs by age</CardTitle>
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
                <TableHead className="text-right">0-30d</TableHead>
                <TableHead className="text-right">31-60d</TableHead>
                <TableHead className="text-right">61-90d</TableHead>
                <TableHead className="text-right">90+d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.d0to30}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.d31to60}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.d61to90}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.d90plus}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: Math.max(140, rows.length * 64) }}
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
              <Bar dataKey="d0to30" fill="var(--color-d0to30)" radius={4} />
              <Bar dataKey="d31to60" fill="var(--color-d31to60)" radius={4} />
              <Bar dataKey="d61to90" fill="var(--color-d61to90)" radius={4} />
              <Bar dataKey="d90plus" fill="var(--color-d90plus)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
