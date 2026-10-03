import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

import { Card } from "@/components/ui/card";
import type { TrendPoint } from "@/lib/db";

interface Props {
  data: TrendPoint[];
  /** The conversion-state cohort being plotted, as the chart labels it. */
  seriesLabel: string;
  /** Stable identity of that cohort, reported to the uTrace chart state. */
  seriesId: string;
}

/**
 * The daily share of sessions that ended in the selected conversion states.
 * Selecting `Purchased` makes this the conversion rate; selecting a drop-off
 * state makes it that drop-off rate over the same denominator.
 */
export function TrendChart({ data, seriesLabel, seriesId }: Props) {
  const chartData = data.map((point) => ({
    date: point.date,
    share: Number((point.stateShare * 100).toFixed(3)),
  }));

  return (
    <Card
      className="p-5"
      data-testid="conversion-trend"
      data-series-id={seriesId}
      data-utrace-target="conversion_trend_chart"
      data-utrace-entity={`conversion_view:${seriesId}`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{seriesLabel} over time</h3>
        <span className="text-xs text-muted-foreground">Daily, % of sessions</span>
      </div>
      <div className="mt-4 h-64 w-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data for the current filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(value: string) => format(parseISO(value), "MMM d")}
                interval="preserveStartEnd"
                minTickGap={32}
                stroke="var(--color-border)"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(value: number) => `${value}%`}
                width={48}
                stroke="var(--color-border)"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={(value: string) => format(parseISO(value), "EEE, MMM d")}
                formatter={(value: number) => [`${value.toFixed(2)}%`, seriesLabel]}
              />
              <Line
                type="monotone"
                dataKey="share"
                name={seriesLabel}
                stroke="var(--color-foreground)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
