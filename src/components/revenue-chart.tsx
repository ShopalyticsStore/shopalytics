"use client";

import { useId, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { formatChartAxisTick, formatChartTooltipDate } from "@/lib/formater";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { revenueChartDemo } from "@/components/revenue-chart-data";
import { cn } from "@/lib/utils";

type PeriodDays = 7 | 14 | 30 | 60 | 90;

const xAxisIntervalByPeriod: Record<PeriodDays, number> = {
  7: 0,
  14: 1,
  30: 3,
  60: 4,
  90: 6,
};

export type RevenueRow = {
  date: string;
  revenue: number;
};

type RevenueChartProps = {
  data?: readonly RevenueRow[];
  title?: string;
  seriesLabel?: string;
  valueFormatter?: (value: number) => string;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
};

export function RevenueChart({
  data,
  title = "Revenue",
  seriesLabel = "Revenue",
  valueFormatter,
  footerHref = "#/reports",
  footerLabel = "View report",
  className = "md:col-span-2 lg:col-span-4",
}: RevenueChartProps = {}) {
  const chartUid = useId().replace(/:/g, "");
  const idAreaGradient = `revenue-area-grad-${chartUid}`;
  const [periodDays, setPeriodDays] = useState<PeriodDays>(60);

  const sourceData = data && data.length > 0 ? data : revenueChartDemo;
  const chartConfig = useMemo(
    () =>
      ({
        revenue: { label: seriesLabel, color: "var(--chart-1)" },
      }) satisfies ChartConfig,
    [seriesLabel],
  );

  const chartRows = useMemo(() => sourceData.slice(-periodDays), [sourceData, periodDays]);

  const growthPct = useMemo(() => {
    const first = chartRows[0]?.revenue ?? 0;
    const last = chartRows.at(-1)?.revenue ?? first;
    if (!first) return 0;
    return ((last - first) / first) * 100;
  }, [chartRows]);

  let xAxisMinTickGap: number | undefined;
  if (periodDays <= 7) {
    xAxisMinTickGap = undefined;
  } else {
    xAxisMinTickGap = Math.max(8, Math.min(52, Math.floor(periodDays / 2)));
  }

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      <CardHeader className="flex flex-col gap-3 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-balance">{title}</CardTitle>
        <Select
          onValueChange={(v) => setPeriodDays(Number(v) as PeriodDays)}
          value={String(periodDays)}
        >
          <SelectTrigger
            aria-label={`${title} time range`}
            className="w-full min-w-36 sm:w-fit"
            size="sm"
          >
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="60">Last 60 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer className="aspect-auto h-60 w-full p-0" config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={[...chartRows]}
            margin={{ left: 24, right: 8, top: 8, bottom: 0 }}
          >
            <defs>
              <linearGradient id={idAreaGradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="date"
              interval={xAxisIntervalByPeriod[periodDays]}
              minTickGap={xAxisMinTickGap}
              tickFormatter={(value) => formatChartAxisTick(String(value), periodDays)}
              tickLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="min-w-36"
                  indicator="line"
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as RevenueRow | undefined;
                    if (!row?.date) return "";
                    return formatChartTooltipDate(row.date, "short");
                  }}
                  formatter={(value, name, item) => {
                    const n = Number(value);
                    const display = valueFormatter ? valueFormatter(n) : n.toLocaleString();
                    return (
                      <>
                        <div
                          className="h-2.5 w-1 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: item.color as string }}
                        />
                        <span className="text-muted-foreground">{seriesLabel}</span>
                        <span className="ml-auto font-medium tabular-nums">{display}</span>
                      </>
                    );
                  }}
                />
              }
            />
            <Area
              dataKey="revenue"
              dot={false}
              fill={`url(#${idAreaGradient})`}
              stroke="var(--color-revenue)"
              strokeWidth={2}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t bg-muted py-2">
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Delta value={growthPct}>
            <DeltaIcon />
            <DeltaValue />
          </Delta>
          <p className="inline-flex text-pretty">vs first day in last {periodDays} days.</p>
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
