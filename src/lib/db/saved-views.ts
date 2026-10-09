import { z } from "zod";

import type { AnalyticsFilters } from "./types";
import { presetDateRange, type DateRangePreset } from "@/lib/fixture/clock";

const ids = z.array(z.string().uuid());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
export const savedViewFiltersSchema = z
  .object({
    productIds: ids,
    trafficSourceIds: ids,
    demographicSegmentIds: ids,
    sentiments: z.array(z.enum(["positive", "neutral", "negative"])),
    reviewTopicIds: ids,
    conversionStateIds: ids,
    dateRange: z.discriminatedUnion("preset", [
      z.object({ preset: z.literal("custom"), startDate: date, endDate: date }).strict(),
      z.object({ preset: z.enum(["last_7_days", "last_30_days", "last_90_days"]) }).strict(),
    ]),
  })
  .strict();

export const viewNameSchema = z.string().trim().min(1).max(60);
export type SavedViewFilters = z.infer<typeof savedViewFiltersSchema>;
export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
}

export function captureView(filters: AnalyticsFilters, preset: DateRangePreset): SavedViewFilters {
  const { startDate, endDate, ...dimensions } = filters;
  return {
    ...dimensions,
    dateRange: preset === "custom" ? { preset, startDate, endDate } : { preset },
  };
}

export function restoreView(saved: SavedViewFilters, now: Date): AnalyticsFilters {
  const { dateRange, ...dimensions } = saved;
  const range =
    dateRange.preset === "custom"
      ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
      : presetDateRange(dateRange.preset, now);
  return { ...dimensions, ...range };
}
