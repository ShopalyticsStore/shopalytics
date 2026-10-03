"use client";

/**
 * React access to the chart-state channel.
 *
 * The channel is installed on `window` so the uTrace browser SDK can find it at
 * `window.__shopalyticsChartState` without importing application code. During
 * server rendering there is no window, so the hook returns a detached channel
 * that nothing subscribes to; the browser installs the real one on mount.
 */

import { useRef } from "react";

import {
  createChartStateChannel,
  installChartStateChannel,
  type ChartStateChannel,
  type ChartStateHost,
} from "./chart-state";

export function useChartStateChannel(): ChartStateChannel {
  const channel = useRef<ChartStateChannel | null>(null);
  if (channel.current === null) {
    channel.current =
      typeof window === "undefined"
        ? createChartStateChannel()
        : installChartStateChannel(window as unknown as ChartStateHost);
  }
  return channel.current;
}
