"use client";

/**
 * The conversion dashboard: the surface the uTrace demo is about.
 *
 * Named views persist the complete filter stack for the signed-in user.
 *
 * Every applied filter, the displayed series identity and each surface's
 * rendering completion are published to the uTrace chart-state channel, so the
 * demo can observe the restored state rather than infer it from an API
 * response or a spoken confirmation.
 */

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueries } from "@tanstack/react-query";

import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FilterBar,
  activeFilterCount,
  createDefaultFilterState,
  type FilterState,
} from "@/components/dashboard/FilterBar";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { ProductTable } from "@/components/dashboard/ProductTable";
import { ReviewsPanel } from "@/components/dashboard/ReviewsPanel";
import { TrendChart } from "@/components/dashboard/TrendChart";
import {
  getConversionTrend,
  getSavedViews,
  saveView,
  getKpis,
  getProductBreakdown,
  getReviews,
  type AnalyticsFilters,
  type ConversionStateRow,
  type DashboardContext,
  type DimensionRow,
  type SavedView,
} from "@/lib/db";
import {
  matchDateRangePreset,
  presetDateRange,
  resolveDashboardNow,
  DATE_RANGE_PRESET_LABELS,
} from "@/lib/fixture/clock";
import {
  buildSeriesIdentity,
  type AppliedFilterValues,
  type SelectedDimension,
} from "@/lib/utrace/chart-state";
import { UTraceChartStateReporter, reportSavedView } from "@/lib/utrace/chart-state-reporter";
import { useChartStateChannel } from "@/lib/utrace/use-chart-state";

export type ConversionDimensions = Readonly<{
  products: DimensionRow[];
  trafficSources: DimensionRow[];
  segments: DimensionRow[];
  reviewTopics: DimensionRow[];
  conversionStates: ConversionStateRow[];
}>;

interface Props {
  context: DashboardContext;
  now: Date;
  dimensions: ConversionDimensions;
}

const REVIEW_LIMIT = 200;

function selectedDimensions(
  options: readonly DimensionRow[],
  selectedIds: readonly string[],
): SelectedDimension[] {
  return selectedIds.map((id) => {
    const option = options.find((candidate) => candidate.id === id);
    if (option === undefined) {
      throw new Error(`the filter selected "${id}", which is not an available option`);
    }
    return { id: option.id, name: option.name };
  });
}

export function ConversionDashboard({ context, now, dimensions }: Props) {
  const channel = useChartStateChannel();
  const defaultConversionStateIds = useMemo(
    () =>
      dimensions.conversionStates
        .filter((state) => state.key === "purchased")
        .map((state) => state.id),
    [dimensions.conversionStates],
  );
  const [filterState, setFilterState] = useState<FilterState>(() =>
    createDefaultFilterState(now, defaultConversionStateIds),
  );

  const { datePreset, ...filters }: { datePreset?: FilterState["datePreset"] } & AnalyticsFilters =
    filterState;
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [viewError, setViewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getSavedViews()
      .then((views) => {
        if (active) setSavedViews(views);
      })
      .catch((error: unknown) => {
        if (active)
          setViewError(error instanceof Error ? error.message : "Could not load saved views");
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveCurrentView() {
    setSaving(true);
    setViewError(null);
    const preset = datePreset ?? matchDateRangePreset(filters, now);
    try {
      const view = await saveView({
        name: viewName.trim(),
        filters,
        dateRange:
          preset === "custom"
            ? { mode: "absolute", startDate: filters.startDate, endDate: filters.endDate }
            : { mode: "relative", preset },
      });
      setSavedViews((views) => [...views.filter((entry) => entry.name !== view.name), view]);
      reportSavedView("saved_view_created", view.name);
      setViewName("");
    } catch (error) {
      setViewError(error instanceof Error ? error.message : "Could not save view");
    } finally {
      setSaving(false);
    }
  }

  function reopenView(view: SavedView) {
    const range = view.dateRange;
    const dates =
      range.mode === "relative"
        ? presetDateRange(range.preset, resolveDashboardNow(context.fixtureClock, new Date()))
        : { startDate: range.startDate, endDate: range.endDate };
    setFilterState({
      ...view.filters,
      ...dates,
      datePreset: range.mode === "relative" ? range.preset : "custom",
    });
    reportSavedView("saved_view_reopened", view.name);
  }

  const appliedFilters = useMemo<AppliedFilterValues>(
    () => ({
      dateRange: {
        preset:
          filterState.datePreset ??
          matchDateRangePreset(
            { startDate: filterState.startDate, endDate: filterState.endDate },
            now,
          ),
        startDate: filterState.startDate,
        endDate: filterState.endDate,
      },
      products: selectedDimensions(dimensions.products, filterState.productIds),
      channels: selectedDimensions(dimensions.trafficSources, filterState.trafficSourceIds),
      demographicSegments: selectedDimensions(
        dimensions.segments,
        filterState.demographicSegmentIds,
      ),
      reviewTopics: selectedDimensions(dimensions.reviewTopics, filterState.reviewTopicIds),
      sentiments: filterState.sentiments,
      conversionStates: selectedDimensions(
        dimensions.conversionStates,
        filterState.conversionStateIds,
      ),
    }),
    [dimensions, filterState, now],
  );

  const stateKeysById = useMemo(
    () => new Map(dimensions.conversionStates.map((state) => [state.id, state.key])),
    [dimensions.conversionStates],
  );

  // Keeping the previous result while a new filter stack loads means an empty
  // surface always means "no rows matched", never "still loading".
  const [kpisQuery, trendQuery, productsQuery, reviewsQuery] = useQueries({
    queries: [
      {
        queryKey: ["conversion-kpis", filters],
        queryFn: () => getKpis(filters),
        placeholderData: keepPreviousData,
      },
      {
        queryKey: ["conversion-trend", filters],
        queryFn: () => getConversionTrend(filters),
        placeholderData: keepPreviousData,
      },
      {
        queryKey: ["conversion-products", filters],
        queryFn: () => getProductBreakdown(filters),
        placeholderData: keepPreviousData,
      },
      {
        queryKey: ["conversion-reviews", filters],
        queryFn: () => getReviews(filters, REVIEW_LIMIT),
        placeholderData: keepPreviousData,
      },
    ],
  });

  const trend = useMemo(() => trendQuery.data ?? [], [trendQuery.data]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const series = useMemo(
    () => buildSeriesIdentity(appliedFilters.conversionStates, stateKeysById, trend),
    [appliedFilters.conversionStates, stateKeysById, trend],
  );

  useEffect(() => {
    channel.applyFilters(appliedFilters, new Date());
  }, [channel, appliedFilters]);

  useEffect(() => {
    if (trendQuery.data === undefined) return;
    const at = new Date();
    channel.displaySeries("conversion_trend", series, at);
    channel.completeRender(
      "conversion_trend",
      trend.length === 0 ? "empty" : "rendered",
      trend.length,
      at,
    );
  }, [channel, series, trend, trendQuery.data]);

  useEffect(() => {
    if (kpisQuery.data === undefined) return;
    channel.completeRender("conversion_kpis", "rendered", 1, new Date());
  }, [channel, kpisQuery.data]);

  useEffect(() => {
    if (productsQuery.data === undefined) return;
    channel.completeRender(
      "product_breakdown",
      products.length === 0 ? "empty" : "rendered",
      products.length,
      new Date(),
    );
  }, [channel, products, productsQuery.data]);

  useEffect(() => {
    if (reviewsQuery.data === undefined) return;
    channel.completeRender(
      "review_list",
      reviews.length === 0 ? "empty" : "rendered",
      reviews.length,
      new Date(),
    );
  }, [channel, reviews, reviewsQuery.data]);

  const failure = [kpisQuery.error, trendQuery.error, productsQuery.error, reviewsQuery.error].find(
    (error): error is Error => error instanceof Error,
  );

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="conversion-dashboard"
      data-utrace-surface="conversion_dashboard"
    >
      <UTraceChartStateReporter />
      <PageHeader
        eyebrow={`Workspace \u00b7 ${context.account.name}`}
        title="Conversion"
        description="Funnel performance by channel, segment, review topic and conversion state."
      />

      <FilterBar
        state={filterState}
        setState={setFilterState}
        now={now}
        products={dimensions.products}
        trafficSources={dimensions.trafficSources}
        segments={dimensions.segments}
        reviewTopics={dimensions.reviewTopics}
        conversionStates={dimensions.conversionStates}
        activeCount={activeFilterCount(filterState)}
        onReset={() => setFilterState(createDefaultFilterState(now, defaultConversionStateIds))}
        savedViewControls={
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Label htmlFor="saved-view-name">View name</Label>
            <Input
              id="saved-view-name"
              className="w-56"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
              maxLength={60}
              placeholder="Name this filter stack"
              data-utrace-target="saved_view_name_field"
              data-utrace-safe-value="safe.view_name"
            />
            <Button
              size="sm"
              disabled={saving || !/^[\w ,'-]{1,60}$/u.test(viewName.trim())}
              onClick={() => void saveCurrentView()}
              data-utrace-target="saved_view_save_control"
              data-utrace-safe-value="safe.control_label"
            >
              {saving ? "Saving…" : "Save view"}
            </Button>
            {savedViews.map((view) => (
              <Button
                key={view.name}
                size="sm"
                variant="outline"
                onClick={() => reopenView(view)}
                title={
                  view.dateRange.mode === "relative"
                    ? `${DATE_RANGE_PRESET_LABELS[view.dateRange.preset]} (relative)`
                    : `${view.dateRange.startDate} to ${view.dateRange.endDate} (absolute)`
                }
                data-utrace-target="saved_view_reopen_control"
              >
                {view.name}
              </Button>
            ))}
            {viewError !== null && (
              <p role="alert" className="text-sm text-critical">
                {viewError}
              </p>
            )}
          </div>
        }
      />

      {failure !== undefined && (
        <div
          role="alert"
          data-testid="conversion-error"
          className="rounded-xl border border-critical-fill/25 bg-critical-surface p-4 text-sm text-critical"
        >
          {failure.message}
        </div>
      )}

      {kpisQuery.data === undefined ? (
        <DashboardSkeleton />
      ) : (
        <>
          <KpiCards data={kpisQuery.data} seriesLabel={series.label} />

          <TrendChart data={trend} seriesLabel={series.label} seriesId={series.seriesId} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ProductTable rows={products} seriesLabel={series.label} />
            <ReviewsPanel rows={reviews} />
          </div>
        </>
      )}
    </div>
  );
}
