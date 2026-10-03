"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { cn } from "@/lib/utils";

export type RefundReturnPoint = { day: string; returnRate: number };

const DEMO_DATA: readonly RefundReturnPoint[] = [
  { day: "Mon", returnRate: 2.2 },
  { day: "Tue", returnRate: 1.5 },
  { day: "Wed", returnRate: 3.1 },
  { day: "Thu", returnRate: 4.8 },
  { day: "Fri", returnRate: 2.4 },
  { day: "Sat", returnRate: 3.2 },
  { day: "Sun", returnRate: 3.9 },
];

const chartConfigDefault = {
  returnRate: { label: "Return %", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Props = {
  data?: readonly RefundReturnPoint[];
  currentValue?: number;
  title?: string;
  description?: string;
  valueLabel?: string;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
  seriesLabel?: string;
};

export function RefundReturnRateChart({
  data,
  currentValue,
  title = "Return rate",
  description = "Last 7 days",
  valueLabel = "of orders refunded",
  footerHref = "#/orders/returns",
  footerLabel = "Returns desk",
  className = "md:col-span-2",
  seriesLabel,
}: Props = {}) {
  const series = data && data.length > 0 ? data : DEMO_DATA;
  const headline = currentValue ?? series.reduce((a, b) => a + b.returnRate, 0) / series.length;

  const first = series[0];
  const lastW = series.at(-1) ?? first;
  const trendPct =
    first.returnRate > 0 ? ((lastW.returnRate - first.returnRate) / first.returnRate) * 100 : 0;

  const chartConfig: ChartConfig = seriesLabel
    ? { returnRate: { label: seriesLabel, color: "var(--chart-1)" } }
    : chartConfigDefault;

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <CardHeader className="flex flex-col px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-right">{headline.toFixed(1)}%</CardTitle>
          <CardDescription>{valueLabel}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="mt-auto px-6 pb-6">
        <ChartContainer className="aspect-auto h-56 w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={[...series]}
            margin={{ left: 12, right: 12, top: 12, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              axisLine={false}
              dataKey="day"
              interval={1}
              minTickGap={8}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line
              dataKey="returnRate"
              dot={false}
              stroke="var(--color-returnRate)"
              strokeWidth={2.5}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="border-t bg-muted/20 px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-muted-foreground text-xs">
          <Delta value={trendPct}>
            <DeltaIcon />
            <DeltaValue />
          </Delta>
          <span className="inline-flex min-w-0 text-pretty">
            vs first day (last {series.length} days)
          </span>
        </div>
        <Button asChild className="text-muted-foreground" size="xs" variant="ghost">
          <Link href={footerHref}>
            {footerLabel}
            <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
