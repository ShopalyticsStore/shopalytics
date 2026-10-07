/**
 * The browser's view of the data layer: one POST per action to
 * `/api/shopalytics`. Errors surface the server's message rather than a generic
 * failure, so a misconfigured runtime is visible in the dashboard.
 */

import type {
  AnalyticsFilters,
  ConversionStateRow,
  DashboardContext,
  DimensionRow,
  KpiWithBaseline,
  ProductRow,
  ProductSentiment,
  ReviewRow,
  SavedConversionView,
  SavedViewFilters,
  SegmentRow,
  TrendPoint,
} from "./types";

type ApiBody =
  | { action: "saveConversionView"; name: string; filters: SavedViewFilters }
  | { action: "savedConversionViews" }
  | { action: "dashboardContext" }
  | { action: "products"; accountId: string }
  | { action: "trafficSources" }
  | { action: "demographicSegments" }
  | { action: "reviewTopics" }
  | { action: "conversionStates" }
  | { action: "kpis"; filters: AnalyticsFilters }
  | { action: "productBreakdown"; filters: AnalyticsFilters }
  | { action: "conversionTrend"; filters: AnalyticsFilters }
  | { action: "reviews"; filters: AnalyticsFilters; limit: number }
  | { action: "segmentBreakdown"; accountId: string; startDate: string; endDate: string }
  | { action: "productSentiment"; accountId: string };

async function shopalyticsApi<T>(body: ApiBody): Promise<T> {
  const response = await fetch("/api/shopalytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(
      payload?.error ?? `Shopalytics data request "${body.action}" failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

export function getDashboardContext(): Promise<DashboardContext> {
  return shopalyticsApi({ action: "dashboardContext" });
}

export function getSavedConversionViews(): Promise<SavedConversionView[]> {
  return shopalyticsApi({ action: "savedConversionViews" });
}

export function saveConversionView(
  name: string,
  filters: SavedViewFilters,
): Promise<SavedConversionView> {
  return shopalyticsApi({ action: "saveConversionView", name, filters });
}

export function getProducts(accountId: string): Promise<DimensionRow[]> {
  return shopalyticsApi({ action: "products", accountId });
}

export function getTrafficSources(): Promise<DimensionRow[]> {
  return shopalyticsApi({ action: "trafficSources" });
}

export function getDemographicSegments(): Promise<DimensionRow[]> {
  return shopalyticsApi({ action: "demographicSegments" });
}

export function getReviewTopics(): Promise<DimensionRow[]> {
  return shopalyticsApi({ action: "reviewTopics" });
}

export function getConversionStates(): Promise<ConversionStateRow[]> {
  return shopalyticsApi({ action: "conversionStates" });
}

export function getKpis(filters: AnalyticsFilters): Promise<KpiWithBaseline> {
  return shopalyticsApi({ action: "kpis", filters });
}

export function getProductBreakdown(filters: AnalyticsFilters): Promise<ProductRow[]> {
  return shopalyticsApi({ action: "productBreakdown", filters });
}

export function getConversionTrend(filters: AnalyticsFilters): Promise<TrendPoint[]> {
  return shopalyticsApi({ action: "conversionTrend", filters });
}

export function getReviews(filters: AnalyticsFilters, limit: number): Promise<ReviewRow[]> {
  return shopalyticsApi({ action: "reviews", filters, limit });
}

export function getSegmentBreakdown(
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<SegmentRow[]> {
  return shopalyticsApi({ action: "segmentBreakdown", accountId, startDate, endDate });
}

export function getProductSentiment(accountId: string): Promise<ProductSentiment[]> {
  return shopalyticsApi({ action: "productSentiment", accountId });
}
