"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
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
import { Activity } from "lucide-react";

const chartConfig = {
  total_residual: {
    label: "Total residual exposure",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

/**
 * Sum of open risks' residual_score, trended weekly (lib/services/analytics.ts
 * getWorkspaceAnalytics().kri.residual_exposure_trend) — the KRI framework's "residual
 * risk exposure, trended" (docs/UI-REVAMP-2-PLAN.md). A rising line means the portfolio's
 * carried risk is growing even if no single risk changed severity — an aggregate signal
 * `risk-trend-chart.tsx`'s opened/closed counts can't show on their own.
 */
export function ResidualExposureChart({
  data,
}: {
  data: Array<{ week: string; total_residual: number }>;
}) {
  const [showTable, setShowTable] = useState(false);
  const chartId = useId();

  if (data.length === 0) {
    return (
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Residual exposure trend</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyTitle>No trend data yet</EmptyTitle>
              <EmptyDescription>
                Once risks are raised, total carried exposure appears here week
                over week.
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
        <CardTitle>Residual exposure trend</CardTitle>
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
                <TableHead>Week</TableHead>
                <TableHead className="text-right">
                  Total residual score
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.week}>
                  <TableCell>{row.week}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.total_residual}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <AreaChart
              id={chartId}
              data={data}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="total_residual"
                type="monotone"
                fill="var(--color-total_residual)"
                fillOpacity={0.2}
                stroke="var(--color-total_residual)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
