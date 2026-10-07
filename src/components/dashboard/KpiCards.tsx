import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { fmtDelta, fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import type { KpiWithBaseline } from "@/lib/db";
import { cn } from "@/lib/utils";

interface Props {
  data: KpiWithBaseline;
  /** The conversion-state cohort the dashboard is plotting. */
  seriesLabel: string;
}

function Delta({
  filtered,
  baseline,
  goodWhen,
}: {
  filtered: number;
  baseline: number;
  goodWhen: "up" | "down";
}) {
  const delta = fmtDelta(filtered, baseline);
  const quality =
    delta.direction === "flat" ? "neutral" : delta.direction === goodWhen ? "good" : "bad";
  const color =
    quality === "good"
      ? "text-success"
      : quality === "bad"
        ? "text-critical"
        : "text-muted-foreground";
  const Icon =
    delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className={cn("mt-1 flex items-center gap-1 text-xs", color)}>
      <Icon className="size-3.5" />
      <span>{delta.label}</span>
    </div>
  );
}

function Kpi({
  label,
  value,
  filtered,
  baseline,
  goodWhen,
  testId,
}: {
  label: string;
  value: string;
  filtered: number;
  baseline: number;
  goodWhen: "up" | "down";
  testId: string;
}) {
  return (
    <Card
      className="gap-0 p-4"
      data-testid={testId}
      data-utrace-visual-target="conversion_kpi_cards"
      data-utrace-safe-value="safe.control_label"
      aria-label={`${label}: ${value}`}
    >
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 text-xl font-semibold leading-7 tabular-nums tracking-tight">
        {value}
      </div>
      <Delta filtered={filtered} baseline={baseline} goodWhen={goodWhen} />
    </Card>
  );
}

/** The four numbers the conversion dashboard leads with. */
export function KpiCards({ data, seriesLabel }: Props) {
  const filtered = data.filtered;
  const baseline = data.baseline;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi
        testId="kpi-sessions"
        label="Sessions"
        value={fmtInt(filtered.sessions)}
        filtered={filtered.sessions}
        baseline={baseline.sessions}
        goodWhen="up"
      />
      <Kpi
        testId="kpi-series-share"
        label={seriesLabel}
        value={fmtPct(filtered.stateShare)}
        filtered={filtered.stateShare}
        baseline={baseline.stateShare}
        goodWhen="up"
      />
      <Kpi
        testId="kpi-conversion-rate"
        label="Conversion rate"
        value={fmtPct(filtered.conversionRate)}
        filtered={filtered.conversionRate}
        baseline={baseline.conversionRate}
        goodWhen="up"
      />
      <Kpi
        testId="kpi-revenue"
        label="Revenue"
        value={fmtUsd(filtered.revenueCents)}
        filtered={filtered.revenueCents}
        baseline={baseline.revenueCents}
        goodWhen="up"
      />
    </div>
  );
}
