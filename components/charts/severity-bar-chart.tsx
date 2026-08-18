"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  count: { label: "Open risks" },
} satisfies ChartConfig;

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "var(--color-risk-critical)",
  High: "var(--color-risk-high)",
  Medium: "var(--color-risk-medium)",
  Low: "var(--color-risk-low)",
};

/**
 * DESIGN-SYSTEM.md §5: "horizontal bar, grouped, sorted descending" for open CAPs / risk
 * comparisons. Used by the executive roll-up, one chart per workspace.
 */
export function SeverityBarChart({
  data,
}: {
  data: { critical: number; high: number; medium: number; low: number };
}) {
  const chartId = useId();
  const rows = [
    { severity: "Critical", count: data.critical },
    { severity: "High", count: data.high },
    { severity: "Medium", count: data.medium },
    { severity: "Low", count: data.low },
  ].sort((a, b) => b.count - a.count);

  return (
    <ChartContainer config={chartConfig} className="h-40 w-full">
      <BarChart id={chartId} data={rows} layout="vertical" margin={{ left: 0 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="severity"
          type="category"
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={4}>
          {rows.map((row) => (
            <Cell key={row.severity} fill={SEVERITY_COLOR[row.severity]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
