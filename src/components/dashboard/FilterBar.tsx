/**
 * The conversion filter stack: date range, channel, demographic segment,
 * review topic, sentiment, conversion state and product.
 *
 * The stack lives in React state and nothing persists it. Leaving or reloading
 * the dashboard loses it, which is the workflow problem the uTrace demo is
 * about; do not add local storage, a URL parameter or a saved view here.
 *
 * "Now" comes from the fixture clock so `Last 30 days` selects the same rows on
 * every run.
 */

import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { parseISO } from "date-fns";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { cn } from "@/lib/utils";
import {
  DATE_RANGE_PRESET_LABELS,
  matchDateRangePreset,
  presetDateRange,
  toUtcDateString,
  type DateRangePreset,
} from "@/lib/fixture/clock";
import type { DimensionRow, Sentiment } from "@/lib/db";

export interface FilterState {
  productIds: string[];
  trafficSourceIds: string[];
  demographicSegmentIds: string[];
  sentiments: Sentiment[];
  reviewTopicIds: string[];
  conversionStateIds: string[];
  startDate: string;
  endDate: string;
}

interface Props {
  state: FilterState;
  setState: (next: FilterState) => void;
  now: Date;
  products: DimensionRow[];
  trafficSources: DimensionRow[];
  segments: DimensionRow[];
  reviewTopics: DimensionRow[];
  conversionStates: DimensionRow[];
  onReset: () => void;
  activeCount: number;
}

const SENTIMENT_OPTIONS: readonly { id: Sentiment; name: string }[] = [
  { id: "positive", name: "Positive" },
  { id: "neutral", name: "Neutral" },
  { id: "negative", name: "Negative" },
];

const SELECTABLE_PRESETS: readonly Exclude<DateRangePreset, "custom">[] = [
  "last_7_days",
  "last_30_days",
  "last_90_days",
];

/**
 * The stack a freshly opened dashboard shows: the last 30 days, no dimension
 * narrowed, and the purchased cohort plotted, which makes the chart the
 * conversion rate.
 */
export function createDefaultFilterState(
  now: Date,
  defaultConversionStateIds: readonly string[],
): FilterState {
  const range = presetDateRange("last_30_days", now);
  return {
    productIds: [],
    trafficSourceIds: [],
    demographicSegmentIds: [],
    sentiments: [],
    reviewTopicIds: [],
    conversionStateIds: [...defaultConversionStateIds],
    startDate: range.startDate,
    endDate: range.endDate,
  };
}

export function activeFilterCount(filters: FilterState): number {
  return (
    filters.productIds.length +
    filters.trafficSourceIds.length +
    filters.demographicSegmentIds.length +
    filters.sentiments.length +
    filters.reviewTopicIds.length +
    filters.conversionStateIds.length
  );
}

export function FilterBar({
  state,
  setState,
  now,
  products,
  trafficSources,
  segments,
  reviewTopics,
  conversionStates,
  onReset,
  activeCount,
}: Props) {
  const [dateOpen, setDateOpen] = useState(false);
  const start = parseISO(state.startDate);
  const end = parseISO(state.endDate);
  const activePreset = matchDateRangePreset(
    { startDate: state.startDate, endDate: state.endDate },
    now,
  );

  return (
    <div
      className="rounded-xl border bg-card p-4"
      data-testid="conversion-filter-bar"
      data-utrace-visual-target="conversion_filter_bar"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Date range
          </span>
          <div className="flex items-center gap-1.5">
            {SELECTABLE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={activePreset === preset ? "default" : "outline"}
                className="h-9 font-normal"
                data-testid={`date-preset-${preset}`}
                data-utrace-target="conversion_filter_date_range"
                data-utrace-safe-value="safe.control_label"
                onClick={() => {
                  const range = presetDateRange(preset, now);
                  setState({ ...state, startDate: range.startDate, endDate: range.endDate });
                }}
              >
                {DATE_RANGE_PRESET_LABELS[preset]}
              </Button>
            ))}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={activePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  className="h-9 gap-2 font-normal"
                  data-testid="date-preset-custom"
                  data-utrace-target="conversion_filter_date_range"
                >
                  <CalendarIcon className="size-3.5 opacity-60" />
                  <span>
                    {state.startDate} to {state.endDate}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  defaultMonth={start}
                  selected={{ from: start, to: end }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setState({
                        ...state,
                        startDate: toUtcDateString(range.from),
                        endDate: toUtcDateString(range.to),
                      });
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <MultiSelectFilter
          label="Channel"
          utraceTarget="conversion_filter_channel"
          testId="filter-channel"
          options={trafficSources}
          selected={state.trafficSourceIds}
          onChange={(value) => setState({ ...state, trafficSourceIds: value })}
        />
        <MultiSelectFilter
          label="Segment"
          utraceTarget="conversion_filter_segment"
          testId="filter-segment"
          options={segments}
          selected={state.demographicSegmentIds}
          onChange={(value) => setState({ ...state, demographicSegmentIds: value })}
        />
        <MultiSelectFilter
          label="Review topic"
          utraceTarget="conversion_filter_review_topic"
          testId="filter-review-topic"
          options={reviewTopics}
          selected={state.reviewTopicIds}
          onChange={(value) => setState({ ...state, reviewTopicIds: value })}
        />
        <MultiSelectFilter
          label="Sentiment"
          utraceTarget="conversion_filter_sentiment"
          testId="filter-sentiment"
          options={SENTIMENT_OPTIONS}
          selected={state.sentiments}
          onChange={(value) => setState({ ...state, sentiments: value as Sentiment[] })}
        />
        <MultiSelectFilter
          label="Conversion state"
          utraceTarget="conversion_filter_conversion_state"
          testId="filter-conversion-state"
          options={conversionStates}
          selected={state.conversionStateIds}
          onChange={(value) => setState({ ...state, conversionStateIds: value })}
        />
        <MultiSelectFilter
          label="Product"
          utraceTarget="conversion_filter_product"
          testId="filter-product"
          options={products}
          selected={state.productIds}
          onChange={(value) => setState({ ...state, productIds: value })}
        />

        <div className={cn("ml-auto flex items-end gap-2 self-end")}>
          <span className="pb-2 text-xs text-muted-foreground">
            {activeCount} active filter{activeCount === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            data-testid="filter-reset"
            data-utrace-target="conversion_filter_reset"
            data-utrace-safe-value="safe.control_label"
            className="h-9 gap-1.5"
          >
            <X className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
