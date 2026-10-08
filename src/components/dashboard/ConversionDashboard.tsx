"use client";

/**
 * The conversion dashboard: the surface the uTrace demo is about.
 *
 * Named filter sets persist for the signed-in user and restore the entire stack.
 *
 * Every applied filter, the displayed series identity and each surface's
 * rendering completion are published to the uTrace chart-state channel, so the
 * demo can observe the restored state rather than infer it from an API
 * response or a spoken confirmation.
 */

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { PageHeader } from "@/components/app/PageHeader";
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
  reopenView,
  getKpis,
  getProductBreakdown,
  getReviews,
  type AnalyticsFilters,
  type ConversionStateRow,
  type DashboardContext,
  type DimensionRow,
} from "@/lib/db";
import {
  buildSeriesIdentity,
  type AppliedFilterValues,
  type SelectedDimension,
} from "@/lib/utrace/chart-state";
import { UTraceChartStateReporter } from "@/lib/utrace/chart-state-reporter";
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

  const { datePreset, ...filters }: { datePreset: FilterState["datePreset"] } & AnalyticsFilters =
    filterState;
  const [viewName, setViewName] = useState("");
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewBusy, setViewBusy] = useState(false);
  const savedViews = useQuery({
    queryKey: ["saved-conversion-views", context.account.id, context.user.id],
    queryFn: getSavedViews,
  });

  async function saveCurrentView() {
    setViewBusy(true);
    setViewError(null);
    try {
      const view = await saveView(viewName.trim(), filters, datePreset);
      channel.savedView("saved_view_created", view.id, view.name, new Date());
      setViewName("");
      await savedViews.refetch();
    } catch (error) {
      setViewError(error instanceof Error ? error.message : "Could not save filter set");
    } finally {
      setViewBusy(false);
    }
  }

  async function openSavedView(id: string) {
    setViewBusy(true);
    setViewError(null);
    try {
      const view = await reopenView(id);
      setFilterState({ ...view.filters, datePreset: view.datePreset });
      channel.savedView("saved_view_reopened", view.id, view.name, new Date());
    } catch (error) {
      setViewError(error instanceof Error ? error.message : "Could not reopen filter set");
    } finally {
      setViewBusy(false);
    }
  }

  const appliedFilters = useMemo<AppliedFilterValues>(
    () => ({
      dateRange: {
        preset: filterState.datePreset,
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
    [dimensions, filterState],
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
      />

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCurrentView();
        }}
      >
        <label htmlFor="saved-view-name" className="text-sm">
          Filter set name
        </label>
        <input
          id="saved-view-name"
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          value={viewName}
          onChange={(event) => setViewName(event.target.value)}
          maxLength={60}
          pattern="[A-Za-z0-9_ ,'-]{1,60}"
          required
          data-testid="saved-view-name"
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          disabled={viewBusy || !/^[\w ,'-]{1,60}$/u.test(viewName.trim())}
          data-testid="saved-view-save"
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          Save filter set
        </Button>
        {savedViews.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            variant="outline"
            disabled={viewBusy}
            onClick={() => void openSavedView(view.id)}
            data-testid="saved-view-reopen"
            data-utrace-target="saved_view_reopen_control"
          >
            {view.name}
          </Button>
        ))}
      </form>
      {(viewError || savedViews.error) && (
        <div role="alert" className="text-sm text-critical">
          {viewError ?? savedViews.error?.message}
        </div>
      )}

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
