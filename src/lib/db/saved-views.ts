import { z } from "zod";

import type { AnalyticsFilters } from "./types";
import { presetDateRange, type DateRangePreset } from "@/lib/fixture/clock";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
export const savedViewFiltersSchema = z
  .object({
    productIds: z.array(uuid),
    trafficSourceIds: z.array(uuid),
    demographicSegmentIds: z.array(uuid),
    sentiments: z.array(z.enum(["positive", "neutral", "negative"])),
    reviewTopicIds: z.array(uuid),
    conversionStateIds: z.array(uuid),
    startDate: date,
    endDate: date,
  })
  .strict();
export const datePresetSchema = z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"]);
export const viewNameSchema = z.string().trim().min(1).max(60);

export interface SavedView {
  id: string;
  name: string;
  filters: AnalyticsFilters;
  datePreset: DateRangePreset;
}

export function resolveSavedView(view: SavedView, now: Date): AnalyticsFilters {
  const filters = savedViewFiltersSchema.parse(view.filters);
  return view.datePreset === "custom"
    ? filters
    : { ...filters, ...presetDateRange(view.datePreset, now) };
}
