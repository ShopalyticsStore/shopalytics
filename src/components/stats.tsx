import { Card } from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

export type Stat = {
  label: string;
  value: string;
  delta: number;
  hint: string;
};

const DEMO_STATS: readonly Stat[] = [
  { label: "Total revenue", value: "$284,920", delta: 8.2, hint: "vs prior 30 days" },
  { label: "Orders", value: "1,842", delta: 4.1, hint: "vs prior 30 days" },
  { label: "Average order value", value: "$154.60", delta: -1.3, hint: "vs prior 30 days" },
  { label: "Store conversion", value: "3.06%", delta: 0.6, hint: "vs prior 30 days" },
] as const;

export function DashboardStats({ stats = DEMO_STATS }: { stats?: readonly Stat[] } = {}) {
  return (
    <>
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </>
  );
}

function StatCard({ stat }: { stat: Stat }) {
  const { label, value, delta, hint } = stat;
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <div className="flex min-h-24 flex-col justify-between gap-4 px-5 py-4">
        <div className="text-sm font-normal leading-none text-muted-foreground">{label}</div>
        <p className="text-balance text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </p>
      </div>
      <div className="flex min-h-12 items-center gap-2 border-t bg-muted/35 px-5 py-3 text-sm">
        <Delta value={delta}>
          <DeltaIcon />
          <DeltaValue className="leading-none" />
        </Delta>
        <span className="text-pretty text-muted-foreground">{hint}</span>
      </div>
    </Card>
  );
}
