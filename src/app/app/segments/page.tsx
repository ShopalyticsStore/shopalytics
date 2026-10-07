"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardContext, getSegmentBreakdown, type SegmentRow } from "@/lib/db";
import { presetDateRange, resolveDashboardNow } from "@/lib/fixture/clock";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";

export default function SegmentsPage() {
  const ctx = useQuery({ queryKey: ["dashboard-context"], queryFn: getDashboardContext });
  const accountId = ctx.data?.account.id;
  const range = useMemo(() => {
    if (ctx.data === undefined) return null;
    return presetDateRange("last_30_days", resolveDashboardNow(ctx.data.fixtureClock, new Date()));
  }, [ctx.data]);

  const segQ = useQuery({
    queryKey: ["segments-breakdown", accountId, range],
    queryFn: () => getSegmentBreakdown(range!.startDate, range!.endDate),
    enabled: accountId !== undefined && range !== null,
  });

  const rows = useMemo(() => segQ.data ?? [], [segQ.data]);

  // Account-wide baseline CVR
  const totals = useMemo(() => {
    const s = rows.reduce((a, r) => a + r.sessions, 0);
    const p = rows.reduce((a, r) => a + r.purchases, 0);
    return { sessions: s, purchases: p, cvr: s > 0 ? p / s : 0 };
  }, [rows]);

  // Group by demographic segment
  const byDemo = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        sessions: number;
        purchases: number;
        revenueCents: number;
        sources: SegmentRow[];
      }
    >();
    for (const r of rows) {
      const cur = map.get(r.segmentId) ?? {
        name: r.segmentName,
        sessions: 0,
        purchases: 0,
        revenueCents: 0,
        sources: [],
      };
      cur.sessions += r.sessions;
      cur.purchases += r.purchases;
      cur.revenueCents += r.revenueCents;
      cur.sources.push(r);
      map.set(r.segmentId, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({
        id,
        ...v,
        cvr: v.sessions > 0 ? v.purchases / v.sessions : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [rows]);

  // Group by source
  const bySource = useMemo(() => {
    const map = new Map<string, { name: string; sessions: number; purchases: number }>();
    for (const r of rows) {
      const cur = map.get(r.sourceId) ?? { name: r.sourceName, sessions: 0, purchases: 0 };
      cur.sessions += r.sessions;
      cur.purchases += r.purchases;
      map.set(r.sourceId, cur);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, ...v, cvr: v.sessions > 0 ? v.purchases / v.sessions : 0 }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [rows]);

  // Watchlist: bottom 5 CVR combos with meaningful traffic
  const watchlist = useMemo(() => {
    return rows
      .filter((r) => r.sessions > 300)
      .sort((a, b) => a.conversionRate - b.conversionRate)
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Audience"
        title="Segments"
        description="Demographic and acquisition cohorts that drive conversion at Dudulemon. Last 30 days."
      />

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-row items-center justify-between border-b py-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="size-4 text-critical" />
            <CardTitle>Watchlist · underperforming cohorts</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Baseline {fmtPct(totals.cvr)}</span>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0 [&:last-child]:pb-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2 font-medium">Segment</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Sessions</th>
                <th className="px-4 py-2 text-right font-medium">Conv. rate</th>
                <th className="px-4 py-2 text-right font-medium">Δ vs baseline</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((r) => {
                const delta = r.conversionRate - totals.cvr;
                return (
                  <tr
                    key={`${r.segmentId}-${r.sourceId}`}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted"
                  >
                    <td className="px-4 py-2.5 font-medium">{r.segmentName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.sourceName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtInt(r.sessions)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtPct(r.conversionRate)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={delta < 0 ? "text-critical" : "text-success"}>
                        {delta >= 0 ? "+" : ""}
                        {(delta * 100).toFixed(2)}pp
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SegmentList
          title="By demographic segment"
          rows={byDemo.map((d) => ({
            id: d.id,
            label: d.name,
            sessions: d.sessions,
            cvr: d.cvr,
            revenueCents: d.revenueCents,
          }))}
          baselineCvr={totals.cvr}
        />
        <SegmentList
          title="By acquisition source"
          rows={bySource.map((d) => ({
            id: d.id,
            label: d.name,
            sessions: d.sessions,
            cvr: d.cvr,
          }))}
          baselineCvr={totals.cvr}
        />
      </div>
    </div>
  );
}

function SegmentList({
  title,
  rows,
  baselineCvr,
}: {
  title: string;
  rows: { id: string; label: string; sessions: number; cvr: number; revenueCents?: number }[];
  baselineCvr: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.sessions));
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0 [&:last-child]:pb-0">
        {rows.map((r) => {
          const delta = r.cvr - baselineCvr;
          return (
            <div key={r.id} className="px-4 py-3 transition-colors hover:bg-muted">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">{r.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmtInt(r.sessions)} sessions
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${(r.sessions / max) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs tabular-nums">{fmtPct(r.cvr)}</span>
                <span
                  className={`w-16 text-right text-xs tabular-nums ${
                    delta < 0 ? "text-critical" : "text-success"
                  }`}
                >
                  {delta >= 0 ? "+" : ""}
                  {(delta * 100).toFixed(2)}pp
                </span>
                {r.revenueCents !== undefined && (
                  <span className="hidden w-20 text-right text-xs tabular-nums text-muted-foreground sm:inline">
                    {fmtUsd(r.revenueCents)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
