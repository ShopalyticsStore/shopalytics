/**
 * The conversion filter stack: date range, channel, demographic segment,
 * review topic, sentiment, conversion state and product.
 *
 * The stack lives in React state; the dashboard can save and restore it as a
 * named view for the signed-in user.
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

/** One preset in the segmented date control; the applied one reads as pressed. */
const SEGMENT =
  "rounded-none border-r border-border px-3 text-sm first:rounded-l-lg last:rounded-r-lg last:border-r-0 hover:bg-muted data-[active=true]:bg-secondary data-[active=true]:font-semibold data-[active=true]:shadow-button-pressed";

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
      className="flex flex-wrap items-center gap-2"
      data-testid="conversion-filter-bar"
      data-utrace-visual-target="conversion_filter_bar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-card shadow-button">
          {SELECTABLE_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant="ghost"
              className={SEGMENT}
              data-active={activePreset === preset}
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
        </div>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 px-2.5 text-sm data-[active=true]:bg-secondary data-[active=true]:shadow-button-pressed"
              data-active={activePreset === "custom"}
              data-testid="date-preset-custom"
              data-utrace-target="conversion_filter_date_range"
              data-utrace-safe-value="safe.control_label"
              aria-label={`Custom range: ${state.startDate} to ${state.endDate}`}
            >
              <CalendarIcon className="text-foreground/70" />
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

      <div className="flex w-full flex-wrap items-center gap-2">
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

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {activeCount} active filter{activeCount === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            data-testid="filter-reset"
            data-utrace-target="conversion_filter_reset"
            data-utrace-safe-value="safe.control_label"
            className="gap-1 px-2 text-sm"
          >
            <X className="size-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
