"use client";

/**
 * Loads the dashboard context and every filter dimension before rendering the
 * conversion dashboard, so the filter stack can be initialised in one pass from
 * the fixture clock instead of being corrected after the dimensions arrive.
 */

import { useQueries } from "@tanstack/react-query";

import { ConversionDashboard } from "@/components/dashboard/ConversionDashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import {
  getConversionStates,
  getDashboardContext,
  getDemographicSegments,
  getProducts,
  getReviewTopics,
  getTrafficSources,
} from "@/lib/db";
import { resolveDashboardNow } from "@/lib/fixture/clock";

export default function ConversionPage() {
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
        queryFn: () => getProducts(accountId!),
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
        data-testid="conversion-load-error"
        className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-400"
      >
        {failure.message}
      </div>
    );
  }

  const context = contextQuery.data;
  const products = productsQuery.data;
  const trafficSources = sourcesQuery.data;
  const segments = segmentsQuery.data;
  const reviewTopics = topicsQuery.data;
  const conversionStates = statesQuery.data;

  if (
    context === undefined ||
    products === undefined ||
    trafficSources === undefined ||
    segments === undefined ||
    reviewTopics === undefined ||
    conversionStates === undefined
  ) {
    return <DashboardSkeleton />;
  }

  const now = resolveDashboardNow(context.fixtureClock, new Date());

  return (
    <ConversionDashboard
      context={context}
      now={now}
      dimensions={{ products, trafficSources, segments, reviewTopics, conversionStates }}
    />
  );
}
