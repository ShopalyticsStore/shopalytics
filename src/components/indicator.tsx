import { cn } from "@/lib/utils";

export function StatusIndicator({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: "default" | "success" | "warning" | "destructive" | "muted";
}) {
  const color =
    variant === "success"
      ? "bg-emerald-500"
      : variant === "warning"
        ? "bg-amber-500"
        : variant === "destructive"
          ? "bg-red-500"
          : variant === "muted"
            ? "bg-muted-foreground"
            : "bg-primary";
  return <span className={cn("inline-flex h-2 w-2 rounded-full", color, className)} {...props} />;
}
