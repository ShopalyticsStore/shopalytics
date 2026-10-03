/** Display formatting for Shopalytics numbers. */

/** A ratio as a percentage with two decimals, or an em dash when undefined. */
export function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "\u2014";
  return `${(value * 100).toFixed(2)}%`;
}

export function fmtInt(value: number): string {
  return value.toLocaleString("en-US");
}

export function fmtUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export type Delta = Readonly<{ label: string; direction: "up" | "down" | "flat" }>;

/** The relative change against the account-wide baseline for the same slice. */
export function fmtDelta(filtered: number, baseline: number): Delta {
  if (baseline === 0 || !Number.isFinite(filtered) || !Number.isFinite(baseline)) {
    return { label: "\u2014", direction: "flat" };
  }
  const relative = (filtered - baseline) / baseline;
  const direction: Delta["direction"] =
    Math.abs(relative) < 0.005 ? "flat" : relative > 0 ? "up" : "down";
  const sign = relative > 0 ? "+" : "";
  return { label: `${sign}${(relative * 100).toFixed(1)}% vs baseline`, direction };
}
