"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  tier1: { label: "Tier 1", color: "var(--color-risk-critical)" },
  tier2: { label: "Tier 2", color: "var(--color-risk-high)" },
  tier3: { label: "Tier 3", color: "var(--color-risk-low)" },
  unscored: { label: "Unscored", color: "var(--color-risk-neutral)" },
} satisfies ChartConfig;

export function VendorsByBusinessUnitChart({
  data,
}: {
  data: Array<{
    business_unit: string;
    tier1: number;
    tier2: number;
    tier3: number;
    unscored: number;
  }>;
}) {
  return (
    <Card className="rounded-lg border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Vendors by tier &amp; business unit</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            No vendor data yet.
          </p>
        ) : (
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="business_unit"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="tier1" stackId="tier" fill="var(--color-tier1)" />
              <Bar dataKey="tier2" stackId="tier" fill="var(--color-tier2)" />
              <Bar dataKey="tier3" stackId="tier" fill="var(--color-tier3)" />
              <Bar
                dataKey="unscored"
                stackId="tier"
                fill="var(--color-unscored)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
