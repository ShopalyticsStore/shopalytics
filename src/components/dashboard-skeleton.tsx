import { cn } from "@/lib/utils";

export function DashboardSkeleton() {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 lg:grid-cols-4",
        "*:min-h-24 *:w-full *:animate-pulse *:rounded-xl *:bg-foreground/[0.06]",
      )}
    >
      <div />
      <div />
      <div />
      <div />
      <div className="col-span-2 min-h-80! lg:col-span-4" />
      <div className="col-span-2 min-h-92! lg:col-span-2" />
      <div className="col-span-2 min-h-92! lg:col-span-2" />
    </div>
  );
}
