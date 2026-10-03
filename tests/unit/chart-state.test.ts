import { describe, expect, test } from "vitest";

import {
  CHART_STATE_GLOBAL_KEY,
  CHART_STATE_PROTOCOL_VERSION,
  buildSeriesIdentity,
  createChartStateChannel,
  installChartStateChannel,
  type AppliedFilterValues,
  type ChartStateEvent,
  type ChartStateHost,
} from "@/lib/utrace/chart-state";

const FILTERS: AppliedFilterValues = {
  dateRange: { preset: "last_30_days", startDate: "2026-08-16", endDate: "2026-09-14" },
  products: [],
  channels: [{ id: "11111111-1111-4111-8111-111111111111", name: "TikTok" }],
  demographicSegments: [{ id: "22222222-2222-4222-8222-222222222222", name: "Women 25-34" }],
  reviewTopics: [{ id: "33333333-3333-4333-8333-333333333333", name: "Sizing" }],
  sentiments: ["negative"],
  conversionStates: [{ id: "44444444-4444-4444-8444-444444444444", name: "Purchased" }],
};

const STATE_KEYS = new Map([
  ["44444444-4444-4444-8444-444444444444", "purchased"],
  ["55555555-5555-4555-8555-555555555555", "cart_drop_off"],
]);

describe("the chart state channel", () => {
  test("publishes applied filters, series identity and rendering completion in order", () => {
    const channel = createChartStateChannel();
    const seen: ChartStateEvent[] = [];
    channel.subscribe((event) => seen.push(event));

    const at = new Date("2026-09-14T09:00:05Z");
    channel.applyFilters(FILTERS, at);
    channel.displaySeries(
      "conversion_trend",
      buildSeriesIdentity(FILTERS.conversionStates, STATE_KEYS, [
        { date: "2026-08-16" },
        { date: "2026-09-14" },
      ]),
      at,
    );
    channel.completeRender("conversion_trend", "rendered", 30, at);

    expect(seen.map((event) => event.type)).toEqual([
      "filters_applied",
      "series_displayed",
      "render_completed",
    ]);
    expect(seen.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(seen.every((event) => event.occurredAt === "2026-09-14T09:00:05.000Z")).toBe(true);
  });

  test("the snapshot carries the latest state for a consumer that attaches late", () => {
    const channel = createChartStateChannel();
    const at = new Date("2026-09-14T09:00:05Z");

    expect(channel.snapshot()).toEqual({
      protocolVersion: CHART_STATE_PROTOCOL_VERSION,
      sequence: 0,
      filters: null,
      series: null,
      renders: {},
    });

    channel.applyFilters(FILTERS, at);
    channel.completeRender("review_list", "empty", 0, at);
    const snapshot = channel.snapshot();

    expect(snapshot.sequence).toBe(2);
    expect(snapshot.filters?.channels[0]?.name).toBe("TikTok");
    expect(snapshot.renders.review_list).toEqual({
      status: "empty",
      rowCount: 0,
      occurredAt: "2026-09-14T09:00:05.000Z",
    });
  });

  test("unsubscribing stops delivery without affecting other listeners", () => {
    const channel = createChartStateChannel();
    const kept: ChartStateEvent[] = [];
    const dropped: ChartStateEvent[] = [];
    channel.subscribe((event) => kept.push(event));
    const unsubscribe = channel.subscribe((event) => dropped.push(event));

    const at = new Date("2026-09-14T09:00:05Z");
    channel.applyFilters(FILTERS, at);
    unsubscribe();
    channel.applyFilters(FILTERS, at);

    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
  });

  test("a different conversion state is a different series identity", () => {
    const purchased = buildSeriesIdentity(FILTERS.conversionStates, STATE_KEYS, []);
    const dropOff = buildSeriesIdentity(
      [{ id: "55555555-5555-4555-8555-555555555555", name: "Cart drop-off" }],
      STATE_KEYS,
      [],
    );
    const both = buildSeriesIdentity(
      [
        { id: "55555555-5555-4555-8555-555555555555", name: "Cart drop-off" },
        { id: "44444444-4444-4444-8444-444444444444", name: "Purchased" },
      ],
      STATE_KEYS,
      [],
    );

    expect(purchased.seriesId).toBe("purchased");
    expect(dropOff.seriesId).toBe("cart_drop_off");
    expect(both.seriesId).toBe("cart_drop_off+purchased");
    expect(purchased.label).toBe("Purchased share of sessions");
    expect(purchased.seriesId).not.toBe(dropOff.seriesId);
  });

  test("the series reports the plotted range and an empty selection", () => {
    const series = buildSeriesIdentity(FILTERS.conversionStates, STATE_KEYS, [
      { date: "2026-08-16" },
      { date: "2026-09-01" },
      { date: "2026-09-14" },
    ]);

    expect(series.pointCount).toBe(3);
    expect(series.firstDate).toBe("2026-08-16");
    expect(series.lastDate).toBe("2026-09-14");

    const none = buildSeriesIdentity([], STATE_KEYS, []);
    expect(none.seriesId).toBe("none");
    expect(none.firstDate).toBeNull();
  });

  test("an unknown conversion state is an error, not a silently dropped key", () => {
    expect(() =>
      buildSeriesIdentity(
        [{ id: "66666666-6666-4666-8666-666666666666", name: "Unknown" }],
        STATE_KEYS,
        [],
      ),
    ).toThrowError(/has no key/u);
  });

  test("a negative row count is refused", () => {
    const channel = createChartStateChannel();

    expect(() =>
      channel.completeRender("product_breakdown", "rendered", -1, new Date()),
    ).toThrowError(/non-negative integer/u);
  });

  test("the host gets exactly one channel", () => {
    const host: ChartStateHost = {};

    const first = installChartStateChannel(host);
    const second = installChartStateChannel(host);

    expect(second).toBe(first);
    expect(host[CHART_STATE_GLOBAL_KEY]).toBe(first);
  });
});
