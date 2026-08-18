"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
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

const chartConfig = {
  tier1: { label: "Tier 1", color: "var(--color-risk-critical)" },
  tier2: { label: "Tier 2", color: "var(--color-risk-high)" },
  tier3: { label: "Tier 3", color: "var(--color-risk-low)" },
  unscored: { label: "Unscored", color: "var(--color-risk-neutral)" },
} satisfies ChartConfig;

/**
 * DESIGN-SYSTEM.md §5: stacked bar for tier distribution, chosen deliberately over a pie
 * ("hard for accessibility"). Non-negotiable per §5: "a data-table alternative" — the
 * `showTable` toggle satisfies that rather than the chart being the only rendering.
 */
export function TierDistributionChart({
  data,
}: {
  data: { tier1: number; tier2: number; tier3: number; unscored: number };
}) {
  const [showTable, setShowTable] = useState(false);
  const chartId = useId();
  const chartData = [{ name: "Vendors", ...data }];

  return (
    <Card className="shadow-(--shadow-card)">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Vendors by tier</CardTitle>
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
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Tier 1</TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.tier1}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Tier 2</TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.tier2}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Tier 3</TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.tier3}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Unscored</TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.unscored}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <BarChart
              id={chartId}
              data={chartData}
              layout="vertical"
              margin={{ left: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="tier1"
                stackId="a"
                fill="var(--color-tier1)"
                radius={[4, 0, 0, 4]}
              />
              <Bar dataKey="tier2" stackId="a" fill="var(--color-tier2)" />
              <Bar dataKey="tier3" stackId="a" fill="var(--color-tier3)" />
              <Bar
                dataKey="unscored"
                stackId="a"
                fill="var(--color-unscored)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
