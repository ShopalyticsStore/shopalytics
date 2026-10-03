"use client";

import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getConversionStates,
  getDashboardContext,
  getProductBreakdown,
  getProductSentiment,
  type AnalyticsFilters,
  type ProductRow,
  type ProductSentiment,
} from "@/lib/db";
import { presetDateRange, resolveDashboardNow } from "@/lib/fixture/clock";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const [contextQuery, statesQuery] = useQueries({
    queries: [
      { queryKey: ["dashboard-context"], queryFn: getDashboardContext },
      { queryKey: ["conversion-states"], queryFn: getConversionStates },
    ],
  });
  const accountId = contextQuery.data?.account.id;
  const purchasedStateIds = useMemo(
    () =>
      (statesQuery.data ?? [])
        .filter((state) => state.key === "purchased")
        .map((state) => state.id),
    [statesQuery.data],
  );

  // Account-wide product breakdown over the last 90 days, purchased cohort.
  const filters = useMemo<AnalyticsFilters | null>(() => {
    if (accountId === undefined || statesQuery.data === undefined) return null;
    const now = resolveDashboardNow(contextQuery.data?.fixtureClock ?? null, new Date());
    const range = presetDateRange("last_90_days", now);
    return {
      accountId,
      productIds: [],
      trafficSourceIds: [],
      demographicSegmentIds: [],
      sentiments: [],
      reviewTopicIds: [],
      conversionStateIds: purchasedStateIds,
      startDate: range.startDate,
      endDate: range.endDate,
    };
  }, [accountId, contextQuery.data, purchasedStateIds, statesQuery.data]);

  const productsQ = useQuery({
    queryKey: ["all-products", filters],
    queryFn: () => getProductBreakdown(filters!),
    enabled: filters !== null,
  });
  const sentimentQ = useQuery({
    queryKey: ["product-sentiment", accountId],
    queryFn: () => getProductSentiment(accountId!),
    enabled: accountId !== undefined,
  });

  const sentimentMap = useMemo(() => {
    const m = new Map<string, ProductSentiment>();
    (sentimentQ.data ?? []).forEach((s) => m.set(s.productId, s));
    return m;
  }, [sentimentQ.data]);

  const rows = (productsQ.data ?? []).filter((r) =>
    r.productName.toLowerCase().includes(q.toLowerCase()),
  );

  const selectedRow = selected
    ? (productsQ.data ?? []).find((p) => p.productId === selected)
    : null;
  const selectedSent = selected ? sentimentMap.get(selected) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Per-product conversion, revenue, and review sentiment over the last 90 days."
      />

      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="h-9 pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} products</span>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="overflow-x-auto p-0 [&:last-child]:pb-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Product</th>
                <th className="px-5 py-2.5 text-right font-medium">Sessions</th>
                <th className="px-5 py-2.5 text-right font-medium">Purchases</th>
                <th className="px-5 py-2.5 text-right font-medium">Conv. rate</th>
                <th className="px-5 py-2.5 text-right font-medium">Revenue</th>
                <th className="px-5 py-2.5 font-medium">Sentiment</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No products match
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const s = sentimentMap.get(r.productId);
                  return (
                    <tr
                      key={r.productId}
                      onClick={() => setSelected(r.productId)}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/25"
                    >
                      <td className="px-5 py-3 font-medium">{r.productName}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtInt(r.sessions)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtInt(r.purchases)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {fmtPct(r.conversionRate)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {fmtUsd(r.revenueCents)}
                      </td>
                      <td className="px-5 py-3">
                        <SentimentBar s={s} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedRow && (
        <ProductDrawer
          row={selectedRow}
          sentiment={selectedSent}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function SentimentBar({ s }: { s?: ProductSentiment }) {
  if (!s || s.total === 0) return <span className="text-xs text-muted-foreground">No reviews</span>;
  const pos = (s.positive / s.total) * 100;
  const neu = (s.neutral / s.total) * 100;
  const neg = (s.negative / s.total) * 100;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-muted">
        <div className="bg-emerald-500" style={{ width: `${pos}%` }} />
        <div className="bg-muted-foreground/40" style={{ width: `${neu}%` }} />
        <div className="bg-rose-500" style={{ width: `${neg}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {s.avgRating.toFixed(1)}★ · {s.total}
      </span>
    </div>
  );
}

function ProductDrawer({
  row,
  sentiment,
  onClose,
}: {
  row: ProductRow;
  sentiment?: ProductSentiment;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-xl border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b px-6 py-5">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              Product
            </div>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">
              {row.productName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Sessions" value={fmtInt(row.sessions)} />
            <Stat label="Purchases" value={fmtInt(row.purchases)} />
            <Stat label="Conv. rate" value={fmtPct(row.conversionRate)} />
            <Stat label="Revenue" value={fmtUsd(row.revenueCents)} />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Review sentiment
            </div>
            {sentiment && sentiment.total > 0 ? (
              <div className="space-y-2">
                <SentimentBar s={sentiment} />
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Pill label="Positive" value={sentiment.positive} tone="good" />
                  <Pill label="Neutral" value={sentiment.neutral} tone="neutral" />
                  <Pill label="Negative" value={sentiment.negative} tone="bad" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No reviews collected.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Pill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "neutral" | "bad";
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-500"
      : tone === "bad"
        ? "bg-rose-500/10 text-rose-500"
        : "bg-muted text-muted-foreground";
  return (
    <div className={cn("rounded-md px-2.5 py-2", cls)}>
      <div className="text-[10px] font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="font-display text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}
