/**
 * Safe structured chart state.
 *
 * The uTrace demo has to observe, not infer, three things about the conversion
 * dashboard: which filter values are applied, which series is on screen, and
 * when rendering finished. This module is the product-side surface for that.
 * It publishes typed events and keeps the latest snapshot; the uTrace browser
 * SDK's annotations read it. There is no SDK dependency here, and nothing in
 * this module reaches the network.
 *
 * Everything published is safe by construction: dimension identifiers and
 * display names that already appear in the dashboard chrome, dates, counts and
 * a series identity. No customer record, no review body, no credential.
 *
 * Integration contract for `@utrace/browser-sdk`:
 *   - `installChartStateChannel(window)` attaches the channel at
 *     `window.__shopalyticsChartState` before the dashboard renders.
 *   - the annotation layer calls `snapshot()` for the current state and
 *     `subscribe(listener)` for subsequent events; `subscribe` returns an
 *     unsubscribe function and never throws.
 *   - events carry a monotonic `sequence` per channel so a consumer that
 *     attaches late can tell whether it missed anything.
 */

import type { DateRangePreset } from "@/lib/fixture/clock";

export const CHART_STATE_GLOBAL_KEY = "__shopalyticsChartState";

export const CHART_STATE_PROTOCOL_VERSION = "shopalytics-chart-state-v1";

/** The dashboard surfaces that report state. */
export type ChartSurface =
  "conversion_trend" | "conversion_kpis" | "product_breakdown" | "review_list";

export type Sentiment = "positive" | "neutral" | "negative";

/** One selected dimension value, as the dashboard labels it. */
export type SelectedDimension = Readonly<{ id: string; name: string }>;

export type AppliedDateRange = Readonly<{
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
}>;

/** The complete filter stack the dashboard has applied. */
export type AppliedFilterValues = Readonly<{
  dateRange: AppliedDateRange;
  products: readonly SelectedDimension[];
  channels: readonly SelectedDimension[];
  demographicSegments: readonly SelectedDimension[];
  reviewTopics: readonly SelectedDimension[];
  sentiments: readonly Sentiment[];
  conversionStates: readonly SelectedDimension[];
}>;

/**
 * What the chart is plotting. `seriesId` is stable for a given set of
 * conversion states, so a restored view that plots a different cohort is
 * visible as a different series rather than as a similar-looking line.
 */
export type SeriesIdentity = Readonly<{
  seriesId: string;
  label: string;
  metric: "conversion_state_share";
  conversionStateKeys: readonly string[];
  pointCount: number;
  firstDate: string | null;
  lastDate: string | null;
}>;

export type RenderStatus = "rendered" | "empty";

export type ChartStateEvent =
  | Readonly<{
      type: "saved_view_created" | "saved_view_reopened";
      sequence: number;
      occurredAt: string;
      viewId: string;
      viewName: string;
    }>
  | Readonly<{
      type: "filters_applied";
      sequence: number;
      occurredAt: string;
      filters: AppliedFilterValues;
    }>
  | Readonly<{
      type: "series_displayed";
      sequence: number;
      occurredAt: string;
      surface: ChartSurface;
      series: SeriesIdentity;
    }>
  | Readonly<{
      type: "render_completed";
      sequence: number;
      occurredAt: string;
      surface: ChartSurface;
      status: RenderStatus;
      rowCount: number;
    }>;

export type SurfaceRenderState = Readonly<{
  status: RenderStatus;
  rowCount: number;
  occurredAt: string;
}>;

export type ChartStateSnapshot = Readonly<{
  protocolVersion: string;
  sequence: number;
  filters: AppliedFilterValues | null;
  series: SeriesIdentity | null;
  renders: Readonly<Partial<Record<ChartSurface, SurfaceRenderState>>>;
}>;

export type ChartStateListener = (event: ChartStateEvent) => void;

export type ChartStateChannel = Readonly<{
  savedView: (
    type: "saved_view_created" | "saved_view_reopened",
    viewId: string,
    viewName: string,
    occurredAt: Date,
  ) => ChartStateEvent;
  protocolVersion: string;
  /** Records the filter values the dashboard applied. */
  applyFilters: (filters: AppliedFilterValues, occurredAt: Date) => ChartStateEvent;
  /** Records which series a surface is displaying. */
  displaySeries: (
    surface: ChartSurface,
    series: SeriesIdentity,
    occurredAt: Date,
  ) => ChartStateEvent;
  /** Records that a surface finished rendering. */
  completeRender: (
    surface: ChartSurface,
    status: RenderStatus,
    rowCount: number,
    occurredAt: Date,
  ) => ChartStateEvent;
  /** The latest state. Safe to call before anything has been published. */
  snapshot: () => ChartStateSnapshot;
  /** Subscribes to subsequent events. Returns an unsubscribe function. */
  subscribe: (listener: ChartStateListener) => () => void;
}>;

/** Builds the series identity for a set of selected conversion states. */
export function buildSeriesIdentity(
  conversionStates: readonly SelectedDimension[],
  stateKeysById: ReadonlyMap<string, string>,
  points: readonly Readonly<{ date: string }>[],
): SeriesIdentity {
  const keys = conversionStates
    .map((state) => {
      const key = stateKeysById.get(state.id);
      if (key === undefined) {
        throw new Error(`conversion state "${state.id}" has no key in the current dimensions`);
      }
      return key;
    })
    .slice()
    .sort();
  const label =
    conversionStates.length === 0
      ? "No conversion state selected"
      : `${conversionStates
          .map((state) => state.name)
          .slice()
          .sort()
          .join(" + ")} share of sessions`;

  return Object.freeze({
    seriesId: keys.length === 0 ? "none" : keys.join("+"),
    label,
    metric: "conversion_state_share",
    conversionStateKeys: Object.freeze(keys),
    pointCount: points.length,
    firstDate: points.length === 0 ? null : points[0]!.date,
    lastDate: points.length === 0 ? null : points[points.length - 1]!.date,
  });
}

/** Creates an independent channel. Each document owns one. */
export function createChartStateChannel(): ChartStateChannel {
  const listeners = new Set<ChartStateListener>();
  let sequence = 0;
  let filters: AppliedFilterValues | null = null;
  let series: SeriesIdentity | null = null;
  const renders: Partial<Record<ChartSurface, SurfaceRenderState>> = {};

  function emit(event: ChartStateEvent): ChartStateEvent {
    for (const listener of listeners) {
      listener(event);
    }
    return event;
  }

  function applyFilters(next: AppliedFilterValues, occurredAt: Date): ChartStateEvent {
    sequence += 1;
    filters = next;
    return emit(
      Object.freeze({
        type: "filters_applied",
        sequence,
        occurredAt: occurredAt.toISOString(),
        filters: next,
      }),
    );
  }

  function displaySeries(
    surface: ChartSurface,
    next: SeriesIdentity,
    occurredAt: Date,
  ): ChartStateEvent {
    sequence += 1;
    series = next;
    return emit(
      Object.freeze({
        type: "series_displayed",
        sequence,
        occurredAt: occurredAt.toISOString(),
        surface,
        series: next,
      }),
    );
  }

  function completeRender(
    surface: ChartSurface,
    status: RenderStatus,
    rowCount: number,
    occurredAt: Date,
  ): ChartStateEvent {
    if (!Number.isInteger(rowCount) || rowCount < 0) {
      throw new Error(`rowCount must be a non-negative integer, received ${rowCount}`);
    }
    sequence += 1;
    const isoTime = occurredAt.toISOString();
    renders[surface] = Object.freeze({ status, rowCount, occurredAt: isoTime });
    return emit(
      Object.freeze({
        type: "render_completed",
        sequence,
        occurredAt: isoTime,
        surface,
        status,
        rowCount,
      }),
    );
  }

  function snapshot(): ChartStateSnapshot {
    return Object.freeze({
      protocolVersion: CHART_STATE_PROTOCOL_VERSION,
      sequence,
      filters,
      series,
      renders: Object.freeze({ ...renders }),
    });
  }

  function subscribe(listener: ChartStateListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return Object.freeze({
    protocolVersion: CHART_STATE_PROTOCOL_VERSION,
    savedView(type, viewId, viewName, occurredAt) {
      sequence += 1;
      return emit(
        Object.freeze({ type, sequence, viewId, viewName, occurredAt: occurredAt.toISOString() }),
      );
    },
    applyFilters,
    displaySeries,
    completeRender,
    snapshot,
    subscribe,
  });
}

export type ChartStateHost = { [CHART_STATE_GLOBAL_KEY]?: ChartStateChannel };

/**
 * Returns the host's channel, creating and attaching it on first use. One
 * channel per document: a second call returns the same object so the SDK and
 * the dashboard observe the same sequence.
 */
export function installChartStateChannel(host: ChartStateHost): ChartStateChannel {
  const existing = host[CHART_STATE_GLOBAL_KEY];
  if (existing !== undefined) {
    return existing;
  }
  const channel = createChartStateChannel();
  host[CHART_STATE_GLOBAL_KEY] = channel;
  return channel;
}
