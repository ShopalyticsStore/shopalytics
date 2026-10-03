"use client";

import React from "react";
import { LabelList, Pie, PieChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

export type CategoryMixDatum = {
  category: string;
  share: number;
};

const SLICE_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const MAX_NAMED_SLICES = 4;

const DEMO_DATA: readonly CategoryMixDatum[] = [
  { category: "Apparel", share: 22 },
  { category: "Accessories", share: 22 },
  { category: "Footwear", share: 18 },
  { category: "Home & living", share: 14 },
  { category: "Beauty", share: 11 },
  { category: "Outlet", share: 8 },
  { category: "Sports", share: 5 },
];

function consolidateTopFourAndOthers(data: readonly CategoryMixDatum[]): CategoryMixDatum[] {
  if (data.length <= MAX_NAMED_SLICES) return [...data];
  const sorted = [...data].sort((a, b) => b.share - a.share);
  const head = sorted.slice(0, MAX_NAMED_SLICES);
  const tail = sorted.slice(MAX_NAMED_SLICES);
  const othersShare = tail.reduce((sum, row) => sum + row.share, 0);
  return [...head, { category: "Others", share: othersShare }];
}

type SliceRow = {
  key: string;
  category: string;
  share: number;
  fill: string;
};

function buildSlices(data: readonly CategoryMixDatum[]): {
  chartConfig: ChartConfig;
  pieData: SliceRow[];
} {
  const chartConfig: ChartConfig = { share: { label: "Share" } };
  const pieData: SliceRow[] = data.map((row, i) => {
    const key = `s${i}`;
    const color = SLICE_PALETTE[i % SLICE_PALETTE.length];
    chartConfig[key] = { label: row.category, color };
    return {
      key,
      category: row.category,
      share: row.share,
      fill: `var(--color-${key})`,
    };
  });
  return { chartConfig, pieData };
}

type CategoryRankChartProps = {
  data?: readonly CategoryMixDatum[];
  title?: string;
  description?: string;
};

export function CategoryRankChart({
  data,
  title = "Revenue Share by Category",
  description = "Last 7 days.",
}: CategoryRankChartProps = {}) {
  const source = data && data.length > 0 ? data : DEMO_DATA;
  const { chartConfig, pieData } = React.useMemo(
    () => buildSlices(consolidateTopFourAndOthers(source)),
    [source],
  );

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="pt-4 pb-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="my-auto p-0">
        <ChartContainer className="aspect-auto h-72 w-full" config={chartConfig}>
          <PieChart accessibilityLayer>
            <Pie
              cornerRadius={4}
              data={pieData}
              dataKey="share"
              innerRadius={50}
              nameKey="key"
              outerRadius="88%"
              stroke="var(--card)"
              strokeWidth={4}
            >
              <LabelList
                className="fill-background font-medium"
                dataKey="share"
                fill="currentColor"
                fontWeight={500}
                formatter={(label: unknown) => {
                  const n = Number(label);
                  return Number.isFinite(n) ? `${n}%` : String(label ?? "");
                }}
                position="inside"
                stroke="none"
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent className="flex flex-wrap gap-3 pt-2" nameKey="key" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
