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
import { TrendingUp } from "lucide-react";

const chartConfig = {
  opened: { label: "Risks opened", color: "var(--color-primary)" },
  closed: { label: "Risks closed", color: "var(--color-risk-low)" },
} satisfies ChartConfig;

/**
 * DESIGN-SYSTEM.md §5: line/area for time-series, 20% opacity fill. Weekly buckets over the
 * trailing 12 weeks (lib/services/dashboard.ts). Table alternative is mandatory per §5.
 */
export function RiskTrendChart({
  data,
}: {
  data: Array<{ week: string; opened: number; closed: number }>;
}) {
  const [showTable, setShowTable] = useState(false);
  // recharts derives its internal SVG clipPathId from a module-level auto-increment
  // counter unless given a stable `id` — that counter diverges between the SSR pass and
  // the client hydration pass once multiple charts exist on one page, producing a real
  // (if cosmetic) hydration mismatch. React.useId() is exactly the SSR-safe id source this
  // needs, so threading it into `id` below removes the mismatch at its root.
  const chartId = useId();

  if (data.length === 0) {
    return (
      <Card className="shadow-(--shadow-card)">
        <CardHeader>
          <CardTitle>Risk posture over time</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <TrendingUp />
              </EmptyMedia>
              <EmptyTitle>No risk data yet</EmptyTitle>
              <EmptyDescription>
                Once risks are raised against assessments, the trend appears
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-(--shadow-card)">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Risk posture over time</CardTitle>
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
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Closed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.week}>
                  <TableCell>{row.week}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.opened}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.closed}
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
                dataKey="opened"
                type="monotone"
                fill="var(--color-opened)"
                fillOpacity={0.2}
                stroke="var(--color-opened)"
              />
              <Area
                dataKey="closed"
                type="monotone"
                fill="var(--color-closed)"
                fillOpacity={0.2}
                stroke="var(--color-closed)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
