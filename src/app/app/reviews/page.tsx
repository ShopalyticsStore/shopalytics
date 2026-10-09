"use client";

/**
 * The review inbox. It shares the conversion filter stack so a topic or
 * sentiment means the same thing on both surfaces, and it loses that stack on
 * navigation exactly as the conversion dashboard does.
 */

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import { PageHeader } from "@/components/app/PageHeader";
import {
  FilterBar,
  activeFilterCount,
  createDefaultFilterState,
  type FilterState,
} from "@/components/dashboard/FilterBar";
import { ReviewsPanel } from "@/components/dashboard/ReviewsPanel";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import {
  getConversionStates,
  getDashboardContext,
  getDemographicSegments,
  getProducts,
  getReviewTopics,
  getReviews,
  getTrafficSources,
  type AnalyticsFilters,
  type ConversionStateRow,
  type DashboardContext,
  type DimensionRow,
} from "@/lib/db";
import { resolveDashboardNow } from "@/lib/fixture/clock";

const REVIEW_LIMIT = 200;

export default function ReviewsPage() {
  const [contextQuery, sourcesQuery, segmentsQuery, topicsQuery, statesQuery] = useQueries({
    queries: [
      { queryKey: ["dashboard-context"], queryFn: getDashboardContext },
      { queryKey: ["traffic-sources"], queryFn: getTrafficSources },
      { queryKey: ["segments"], queryFn: getDemographicSegments },
      { queryKey: ["review-topics"], queryFn: getReviewTopics },
      { queryKey: ["conversion-states"], queryFn: getConversionStates },
    ],
  });

  const accountId = contextQuery.data?.account.id;
  const productsQuery = useQueries({
    queries: [
      {
        queryKey: ["products", accountId],
        queryFn: getProducts,
        enabled: accountId !== undefined,
      },
    ],
  })[0];

  const failure = [
    contextQuery.error,
    sourcesQuery.error,
    segmentsQuery.error,
    topicsQuery.error,
    statesQuery.error,
    productsQuery.error,
  ].find((error): error is Error => error instanceof Error);

  if (failure !== undefined) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-critical-fill/25 bg-critical-surface p-4 text-sm text-critical"
      >
        {failure.message}
      </div>
    );
  }

  if (
    contextQuery.data === undefined ||
    sourcesQuery.data === undefined ||
    segmentsQuery.data === undefined ||
    topicsQuery.data === undefined ||
    statesQuery.data === undefined ||
    productsQuery.data === undefined
  ) {
    return <DashboardSkeleton />;
  }

  return (
    <LoadedReviews
      context={contextQuery.data}
      products={productsQuery.data}
      trafficSources={sourcesQuery.data}
      segments={segmentsQuery.data}
      reviewTopics={topicsQuery.data}
      conversionStates={statesQuery.data}
    />
  );
}

function LoadedReviews({
  context,
  products,
  trafficSources,
  segments,
  reviewTopics,
  conversionStates,
}: {
  context: DashboardContext;
  products: DimensionRow[];
  trafficSources: DimensionRow[];
  segments: DimensionRow[];
  reviewTopics: DimensionRow[];
  conversionStates: ConversionStateRow[];
}) {
  const now = resolveDashboardNow(context.fixtureClock, new Date());
  const defaultConversionStateIds = useMemo(
    () => conversionStates.filter((state) => state.key === "purchased").map((state) => state.id),
    [conversionStates],
  );
  const [filterState, setFilterState] = useState<FilterState>(() =>
    createDefaultFilterState(now, defaultConversionStateIds),
  );

  const filters: AnalyticsFilters = {
    productIds: filterState.productIds,
    trafficSourceIds: filterState.trafficSourceIds,
    demographicSegmentIds: filterState.demographicSegmentIds,
    sentiments: filterState.sentiments,
    reviewTopicIds: filterState.reviewTopicIds,
    conversionStateIds: filterState.conversionStateIds,
    startDate: filterState.startDate,
    endDate: filterState.endDate,
  };

  const reviewsQuery = useQueries({
    queries: [
      { queryKey: ["reviews-page", filters], queryFn: () => getReviews(filters, REVIEW_LIMIT) },
    ],
  })[0];

  const rows = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const counts = useMemo(
    () => ({
      total: rows.length,
      positive: rows.filter((row) => row.sentiment === "positive").length,
      neutral: rows.filter((row) => row.sentiment === "neutral").length,
      negative: rows.filter((row) => row.sentiment === "negative").length,
    }),
    [rows],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Voice of customer"
        title="Reviews"
        description="Filter customer reviews by channel, segment, topic and sentiment."
      />

      <FilterBar
        state={filterState}
        setState={setFilterState}
        now={now}
        products={products}
        trafficSources={trafficSources}
        segments={segments}
        reviewTopics={reviewTopics}
        conversionStates={conversionStates}
        activeCount={activeFilterCount(filterState)}
        onReset={() => setFilterState(createDefaultFilterState(now, defaultConversionStateIds))}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryStat label="Reviews" value={counts.total} tone="plain" />
        <SummaryStat label="Positive" value={counts.positive} tone="good" />
        <SummaryStat label="Neutral" value={counts.neutral} tone="plain" />
        <SummaryStat label="Negative" value={counts.negative} tone="bad" />
      </div>
      <ReviewsPanel rows={rows} />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "plain";
}) {
  const toneClass =
    tone === "good" ? "text-success" : tone === "bad" ? "text-critical" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-sm font-semibold">{label}</div>
      <div className={`mt-1 text-xl font-semibold leading-7 tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
