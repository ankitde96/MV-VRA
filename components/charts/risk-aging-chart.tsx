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
import { CalendarClock } from "lucide-react";
import type { RiskAgingBucket } from "@/lib/services/analytics";

const chartConfig = {
  critical: { label: "Critical", color: "var(--color-risk-critical)" },
  high: { label: "High", color: "var(--color-risk-high)" },
  medium: { label: "Medium", color: "var(--color-risk-medium)" },
  low: { label: "Low", color: "var(--color-risk-low)" },
} satisfies ChartConfig;

/**
 * How long open risks have been sitting unresolved, stacked by severity. Uses the locked
 * risk-severity palette (DESIGN-SYSTEM.md §3), never the generic chart-1..5 ramp — severity
 * is the one place color carries meaning and must match every badge/table cell exactly.
 *
 * The `dataviz` skill's validator flags this exact 4-color set: light-mode critical↔high
 * (#b91c1c↔#b45309) sits at normal-vision ΔE 9.1, below the 15 floor even for full color
 * vision — a real, pre-existing finding, not introduced here. The palette is locked
 * (DECISIONS.md 028/§2) so it cannot be re-stepped for this chart alone; the always-visible
 * legend + tooltip labels below are the mitigation the validator itself prescribes for a
 * WARN/FAIL band ("legal only with secondary encoding") — never rely on the stacked
 * segment's color alone to tell critical from high.
 */
export function RiskAgingChart({ data }: { data: RiskAgingBucket[] }) {
  const [showTable, setShowTable] = useState(false);
  const hasData = data.some((b) => b.critical + b.high + b.medium + b.low > 0);

  if (!hasData) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Risk aging</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock />
              </EmptyMedia>
              <EmptyTitle>No open risks</EmptyTitle>
              <EmptyDescription>
                Open risks will appear here bucketed by how long they&apos;ve
                been unresolved.
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
        <CardTitle>Risk aging</CardTitle>
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
                <TableHead>Age</TableHead>
                <TableHead className="text-right">Critical</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="text-right">Medium</TableHead>
                <TableHead className="text-right">Low</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.bucket}>
                  <TableCell>{row.bucket} days</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.critical}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.high}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.medium}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.low}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="bucket"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `${v}d`}
              />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="critical"
                stackId="severity"
                fill="var(--color-critical)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="high"
                stackId="severity"
                fill="var(--color-high)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="medium"
                stackId="severity"
                fill="var(--color-medium)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="low"
                stackId="severity"
                fill="var(--color-low)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
