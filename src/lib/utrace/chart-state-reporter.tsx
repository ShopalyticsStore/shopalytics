"use client";

/**
 * Bridges the dashboard's chart-state channel to uTrace milestones.
 *
 * `SCENARIO.md` requires the conversion display to be observed rather than
 * inferred from an API response or the participant's confirmation. The channel
 * at `window.__shopalyticsChartState` already publishes the three facts that
 * prove it — the applied filter values, the displayed series identity, and
 * rendering completion — so this component subscribes to it and records each
 * one as a registered workflow milestone on the shared observation runtime.
 *
 * Every attribute passes a signed safe-value rule. Nothing customer-authored
 * crosses this boundary: dimension names are the labels already printed in the
 * dashboard chrome, counts are integers, and the series identity is a stable
 * key built from conversion-state keys.
 *
 * Outside the preview profile the runtime never becomes ready, so this
 * component subscribes to nothing and records nothing.
 */

import { useEffect } from "react";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";

import {
  CHART_STATE_GLOBAL_KEY,
  type ChartStateChannel,
  type ChartStateEvent,
  type ChartStateHost,
} from "./chart-state";

type MilestoneAttribute = Readonly<{ name: string; ruleId: string; value: string }>;

/**
 * How long to keep looking for a ready runtime. The gate withholds the
 * application subtree until the runtime is ready, so in a preview this
 * resolves on the first tick; the bound exists so a production build, where
 * the runtime never becomes ready, stops looking.
 */
const READY_POLL_INTERVAL_MS = 100;
const READY_POLL_ATTEMPTS = 20;

export function UTraceChartStateReporter(): null {
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let attempts = 0;

    const attach = (): boolean => {
      const status = utracePreviewStatus();
      if (status.phase !== "ready") {
        return false;
      }
      const channel = (window as unknown as ChartStateHost)[CHART_STATE_GLOBAL_KEY];
      if (channel === undefined) {
        return false;
      }
      unsubscribe = subscribe(channel, status.session.annotations.milestone);
      return true;
    };

    if (attach()) {
      return () => {
        unsubscribe?.();
      };
    }
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attach() || attempts >= READY_POLL_ATTEMPTS) {
        window.clearInterval(timer);
      }
    }, READY_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, []);

  return null;
}

type RecordMilestone = (request: {
  readonly milestoneId: string;
  readonly severity: string | null;
  readonly priority: string | null;
  readonly entityDefinitionId: string | null;
  readonly entityInstanceRef: string | null;
  readonly attributes: readonly MilestoneAttribute[];
}) => unknown;

function subscribe(channel: ChartStateChannel, record: RecordMilestone): () => void {
  const publish = (event: ChartStateEvent): void => {
    const milestone = describe(event);
    record({
      milestoneId: milestone.milestoneId,
      severity: "info",
      priority: "normal",
      entityDefinitionId: milestone.entityInstanceRef === null ? null : "conversion_view",
      entityInstanceRef: milestone.entityInstanceRef,
      attributes: milestone.attributes,
    });
  };

  // The channel's current state is already published, so the first snapshot is
  // reported before subscribing: a runtime that became ready after the first
  // render would otherwise miss the filter stack the page started with.
  const snapshot = channel.snapshot();
  if (snapshot.filters !== null) {
    publish({
      type: "filters_applied",
      sequence: snapshot.sequence,
      occurredAt: new Date().toISOString(),
      filters: snapshot.filters,
    });
  }
  return channel.subscribe(publish);
}

interface DescribedMilestone {
  readonly milestoneId: string;
  readonly entityInstanceRef: string | null;
  readonly attributes: readonly MilestoneAttribute[];
}

function describe(event: ChartStateEvent): DescribedMilestone {
  switch (event.type) {
    case "saved_view_created":
    case "saved_view_reopened":
      return {
        milestoneId: event.type,
        entityInstanceRef: null,
        attributes: [{ name: "view_name", ruleId: "safe.view_name", value: event.viewName }],
      };
    case "filters_applied": {
      const filters = event.filters;
      return {
        milestoneId: "conversion_filters_applied",
        entityInstanceRef: null,
        attributes: [
          { name: "date_range", ruleId: "safe.date_range_preset", value: filters.dateRange.preset },
          ...dimension("channels", filters.channels),
          ...dimension("segments", filters.demographicSegments),
          ...dimension("review_topics", filters.reviewTopics),
          ...dimension("conversion_states", filters.conversionStates),
          ...dimension("products", filters.products),
          {
            name: "sentiments",
            ruleId: "safe.dimension_name",
            value:
              filters.sentiments.length === 0 ? "all" : [...filters.sentiments].sort().join(", "),
          },
        ],
      };
    }
    case "series_displayed":
      return {
        milestoneId: "conversion_series_displayed",
        entityInstanceRef: event.series.seriesId,
        attributes: [
          { name: "series_id", ruleId: "safe.series_id", value: event.series.seriesId },
          { name: "series_label", ruleId: "safe.series_label", value: event.series.label },
          {
            name: "point_count",
            ruleId: "safe.selection_count",
            value: String(Math.min(event.series.pointCount, 9999)),
          },
        ],
      };
    case "render_completed":
      return {
        milestoneId: "conversion_render_completed",
        entityInstanceRef: null,
        attributes: [
          { name: "surface", ruleId: "safe.surface_id", value: event.surface },
          { name: "status", ruleId: "safe.render_status", value: event.status },
          {
            name: "row_count",
            ruleId: "safe.selection_count",
            value: String(Math.min(event.rowCount, 9999)),
          },
        ],
      };
  }
}

/**
 * One attribute per dimension: the selected names, or `all` when the dimension
 * is unrestricted. The names are the dashboard's own labels, which the
 * `safe.dimension_name` rule bounds.
 */
function dimension(
  name: string,
  selected: readonly Readonly<{ id: string; name: string }>[],
): readonly MilestoneAttribute[] {
  return [
    {
      name,
      ruleId: "safe.dimension_name",
      value:
        selected.length === 0
          ? "all"
          : selected
              .map((entry) => entry.name)
              .slice()
              .sort()
              .join(", "),
    },
  ];
}
