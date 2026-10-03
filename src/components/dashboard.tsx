import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import { ArrowRightIcon, StarIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/PageHeader";
import { DashboardStats, type Stat } from "@/components/stats";
import { RevenueChart, type RevenueRow } from "@/components/revenue-chart";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { RefundReturnRateChart } from "@/components/refund-return-rate-chart";
import { QuickActions } from "@/components/quick-actions";
import {
  ShareBarList,
  ShareBarListContent,
  ShareBarListFill,
  ShareBarListItem,
  ShareBarListLabel,
  ShareBarListValue,
} from "@/components/share-bar-list";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getConversionStates,
  getConversionTrend,
  getDashboardContext,
  getKpis,
  getProductBreakdown,
  getReviews,
  getSegmentBreakdown,
} from "@/lib/db";
import type { AnalyticsFilters } from "@/lib/db";
import {
  presetDateRange,
  resolveDashboardNow,
  shiftUtcDays,
  toUtcDateString,
} from "@/lib/fixture/clock";

/**
 * The overview is a fixed, unfiltered 90-day summary. The filter stack that the
 * uTrace demo is about lives on the conversion dashboard, and duplicating it
 * here would give the same workflow two different memories.
 */
function useOverviewScope(): {
  filters: AnalyticsFilters | null;
  accountId: string | undefined;
  accountName: string | undefined;
  now: Date | null;
} {
  const [contextQuery, statesQuery] = useQueries({
    queries: [
      { queryKey: ["dashboard-context"], queryFn: getDashboardContext },
      { queryKey: ["conversion-states"], queryFn: getConversionStates },
    ],
  });

  const context = contextQuery.data;
  const states = statesQuery.data;
  const now = useMemo(
    () => (context === undefined ? null : resolveDashboardNow(context.fixtureClock, new Date())),
    [context],
  );

  const filters = useMemo<AnalyticsFilters | null>(() => {
    if (context === undefined || states === undefined || now === null) return null;
    const range = presetDateRange("last_90_days", now);
    return {
      accountId: context.account.id,
      productIds: [],
      trafficSourceIds: [],
      demographicSegmentIds: [],
      sentiments: [],
      reviewTopicIds: [],
      conversionStateIds: states
        .filter((state) => state.key === "purchased")
        .map((state) => state.id),
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }, [context, now, states]);

  return {
    filters,
    accountId: context?.account.id,
    accountName: context?.account.name,
    now,
  };
}

export function Dashboard() {
  const { filters, accountId, accountName, now } = useOverviewScope();

  const [kpisQ, trendQ, productsQ, reviewsQ, segmentsQ] = useQueries({
    queries: [
      {
        queryKey: ["dash-kpis", filters],
        queryFn: () => getKpis(filters!),
        enabled: filters !== null,
      },
      {
        queryKey: ["dash-trend", filters],
        queryFn: () => getConversionTrend(filters!),
        enabled: filters !== null,
      },
      {
        queryKey: ["dash-products", filters],
        queryFn: () => getProductBreakdown(filters!),
        enabled: filters !== null,
      },
      {
        queryKey: ["dash-reviews", filters],
        queryFn: () => getReviews(filters!, 100),
        enabled: filters !== null,
      },
      {
        queryKey: ["dash-segments", accountId, filters?.startDate, filters?.endDate],
        queryFn: () => getSegmentBreakdown(accountId!, filters!.startDate, filters!.endDate),
        enabled: filters !== null,
      },
    ],
  });

  const kpis = kpisQ.data;
  const trend = useMemo(() => trendQ.data ?? [], [trendQ.data]);
  const products = useMemo(
    () =>
      (productsQ.data ?? [])
        .slice()
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 6),
    [productsQ.data],
  );
  const reviews = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data]);
  const segments = useMemo(() => segmentsQ.data ?? [], [segmentsQ.data]);

  const aov = kpis
    ? kpis.filtered.purchases > 0
      ? kpis.filtered.revenueCents / kpis.filtered.purchases
      : 0
    : 0;
  const baselineAov = kpis
    ? kpis.baseline.purchases > 0
      ? kpis.baseline.revenueCents / kpis.baseline.purchases
      : 0
    : 0;

  // Stats — Shopalytics KPIs, formatted for the efferd stat-card layout.
  const stats: readonly Stat[] = useMemo(() => {
    if (!kpis) return [];
    return [
      {
        label: "Total revenue",
        value: fmtUsd(kpis.filtered.revenueCents),
        delta: pctDelta(kpis.filtered.revenueCents, kpis.baseline.revenueCents),
        hint: "vs prior 90 days",
      },
      {
        label: "Orders",
        value: fmtInt(kpis.filtered.purchases),
        delta: pctDelta(kpis.filtered.purchases, kpis.baseline.purchases),
        hint: "vs prior 90 days",
      },
      {
        label: "Average order value",
        value: fmtUsd(aov),
        delta: pctDelta(aov, baselineAov),
        hint: "vs prior 90 days",
      },
      {
        label: "Store conversion",
        value: fmtPct(kpis.filtered.conversionRate),
        delta: pctDelta(kpis.filtered.conversionRate, kpis.baseline.conversionRate),
        hint: "vs prior 90 days",
      },
    ];
  }, [kpis, aov, baselineAov]);

  // Daily revenue series for the efferd RevenueChart — derived from trend × AOV
  // so the curve mirrors real purchase volume per day.
  const revenueSeries: RevenueRow[] = useMemo(() => {
    if (!trend.length) return [];
    const perOrder = aov || baselineAov || 15_000;
    return trend.map((d) => ({
      date: d.date,
      revenue: Math.round((d.purchases * perOrder) / 100), // dollars
    }));
  }, [trend, aov, baselineAov]);

  // Traffic-source revenue mix for the efferd pie chart.
  const sourceMix = useMemo(() => {
    const totals = new Map<string, { name: string; revenue: number }>();
    segments.forEach((s) => {
      const cur = totals.get(s.sourceId) ?? { name: s.sourceName, revenue: 0 };
      cur.revenue += s.revenueCents;
      totals.set(s.sourceId, cur);
    });
    const sum = Array.from(totals.values()).reduce((a, v) => a + v.revenue, 0) || 1;
    return Array.from(totals.values())
      .map((v) => ({
        category: v.name,
        share: Math.round((v.revenue / sum) * 100),
      }))
      .sort((a, b) => b.share - a.share);
  }, [segments]);

  // Positive-sentiment over the last 7 days, day-bucketed from review data.
  const sentimentSeries = useMemo(() => {
    const days: { date: Date; key: string; total: number; positive: number }[] = [];
    const anchor = now ?? new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const day = shiftUtcDays(anchor, -offset);
      days.push({ date: day, key: toUtcDateString(day), total: 0, positive: 0 });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    reviews.forEach((r) => {
      const bucket = byKey.get(r.date.slice(0, 10));
      if (bucket) {
        bucket.total++;
        if (r.sentiment === "positive") bucket.positive++;
      }
    });
    return days.map((d) => ({
      day: format(d.date, "EEE"),
      returnRate: d.total > 0 ? Math.round((d.positive / d.total) * 100) : 0,
    }));
  }, [now, reviews]);
  const positivePct = useMemo(() => {
    if (!reviews.length) return 0;
    const pos = reviews.filter((r) => r.sentiment === "positive").length;
    return (pos / reviews.length) * 100;
  }, [reviews]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow={`Workspace \u00b7 ${accountName ?? "Dudulemon"}`}
        title="Overview"
        description="Funnel performance, top products and voice of customer across the last 90 days."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStats stats={stats} />
      </div>

      {/* Hero revenue chart — efferd RevenueChart fed with Shopalytics
			    daily revenue series. */}
      <RevenueChart
        data={revenueSeries}
        title="Revenue"
        seriesLabel="Revenue"
        valueFormatter={(v) =>
          v.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })
        }
        footerHref="/app/products"
        footerLabel="Product report"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RefundReturnRateChart
          data={sentimentSeries}
          currentValue={positivePct}
          title="Review sentiment"
          description="Daily positive share · last 7 days"
          valueLabel="positive reviews"
          footerHref="/app/reviews"
          footerLabel="Review inbox"
          className="lg:col-span-2"
          seriesLabel="Positive %"
        />
        <CategoryRankChart
          data={sourceMix}
          title="Revenue by traffic source"
          description="Last 90 days"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b py-3">
            <div className="space-y-1">
              <CardTitle>Top products by revenue</CardTitle>
              <CardDescription>Last 90 days</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" className="text-muted-foreground">
              <Link href="/app/products">
                All products
                <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 [&:last-child]:pb-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Product</th>
                  <th className="px-4 py-2 text-right font-medium">Sessions</th>
                  <th className="px-4 py-2 text-right font-medium">Conv.</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.productId}
                      className="border-b transition-colors last:border-b-0 hover:bg-muted"
                    >
                      <td className="px-4 py-2.5 font-medium">{p.productName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(p.sessions)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtPct(p.conversionRate)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fmtUsd(p.revenueCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 border-b py-3">
            <div className="space-y-1">
              <CardTitle>Recent reviews</CardTitle>
              <CardDescription>Most recent customer feedback</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0 [&:last-child]:pb-0">
            <ul className="divide-y">
              {reviews.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</li>
              ) : (
                reviews.slice(0, 5).map((r) => (
                  <li key={r.id} className="px-4 py-3 transition-colors hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <StarIcon
                            key={i}
                            className={cn(
                              "size-3",
                              i < r.rating
                                ? "fill-rating text-rating"
                                : "fill-none text-muted-foreground/40",
                            )}
                          />
                        ))}
                      </div>
                      <Badge
                        variant={
                          r.sentiment === "positive"
                            ? "success"
                            : r.sentiment === "negative"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {r.sentiment}
                      </Badge>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {format(parseISO(r.date), "MMM d")}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{r.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.productName} · {r.trafficSourceName}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="min-h-96 gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b py-3">
            <CardTitle>Traffic source mix</CardTitle>
            <CardDescription>Revenue share by acquisition channel · last 90 days</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 p-0 [&:last-child]:pb-0">
            <ShareBarList aria-label="Revenue share by traffic source">
              {sourceMix.map((row) => (
                <ShareBarListItem key={row.category} value={row.share}>
                  <ShareBarListContent>
                    <ShareBarListLabel>{row.category}</ShareBarListLabel>
                    <ShareBarListValue>{row.share}%</ShareBarListValue>
                  </ShareBarListContent>
                  <ShareBarListFill />
                </ShareBarListItem>
              ))}
            </ShareBarList>
          </CardContent>
        </Card>
        <QuickActions />
      </div>
    </div>
  );
}

function pctDelta(current?: number, baseline?: number): number {
  if (!current || !baseline) return 0;
  return ((current - baseline) / baseline) * 100;
}
