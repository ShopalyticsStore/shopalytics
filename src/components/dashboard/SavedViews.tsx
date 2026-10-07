"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchDateRangePreset, presetDateRange } from "@/lib/fixture/clock";
import { reportSavedView } from "@/lib/utrace/chart-state-reporter";
import type { ConversionDimensions } from "./ConversionDashboard";
import type { FilterState } from "./FilterBar";

const viewName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[\w ,'-]{1,60}$/u);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

interface Props {
  accountId: string;
  state: FilterState;
  setState: (state: FilterState) => void;
  dimensions: ConversionDimensions;
  now: Date;
}

export function SavedViews({ accountId, state, setState, dimensions, now }: Props) {
  const schema = useMemo(() => {
    const ids = (options: readonly { id: string }[]) =>
      z.array(
        z
          .string()
          .uuid()
          .refine((id) => options.some((option) => option.id === id)),
      );
    return z
      .object({
        name: viewName,
        preset: z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"]),
        filters: z
          .object({
            productIds: ids(dimensions.products),
            trafficSourceIds: ids(dimensions.trafficSources),
            demographicSegmentIds: ids(dimensions.segments),
            reviewTopicIds: ids(dimensions.reviewTopics),
            conversionStateIds: ids(dimensions.conversionStates),
            sentiments: z.array(z.enum(["positive", "neutral", "negative"])),
            startDate: date,
            endDate: date,
          })
          .strict()
          .refine((filters) => filters.startDate <= filters.endDate),
      })
      .strict();
  }, [dimensions]);
  type SavedView = z.infer<typeof schema>;
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = `shopalytics:saved-views:v1:${accountId}`;

  useEffect(() => {
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      setViews(
        Array.isArray(raw)
          ? raw.flatMap((entry) => {
              const parsed = schema.safeParse(entry);
              return parsed.success ? [parsed.data] : [];
            })
          : [],
      );
      setError(null);
    } catch {
      setViews([]);
      setError("Saved views could not be loaded from this browser.");
    }
    setReady(true);
  }, [schema, storageKey]);

  function save() {
    const parsed = schema.safeParse({
      name,
      filters: state,
      preset: matchDateRangePreset(state, now),
    });
    if (!parsed.success) {
      setError(
        "Use a view name of up to 60 letters, numbers, spaces, commas, apostrophes or hyphens.",
      );
      return;
    }
    const next = [...views.filter((view) => view.name !== parsed.data.name), parsed.data];
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setViews(next);
      setName("");
      setError(null);
      reportSavedView("saved_view_created", parsed.data.name);
    } catch {
      setError("This browser could not save the view. Please try again.");
    }
  }

  function reopen(view: SavedView) {
    const parsed = schema.safeParse(view);
    if (!parsed.success) return;
    const range = view.preset === "custom" ? {} : presetDateRange(view.preset, now);
    setState({ ...parsed.data.filters, ...range });
    setError(null);
    reportSavedView("saved_view_reopened", parsed.data.name);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Saved views">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Input
          aria-label="View name"
          placeholder="Name this view"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
          data-testid="saved-view-name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!ready || !viewName.safeParse(name).success}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
          data-testid="saved-view-save"
        >
          Save view
        </Button>
      </form>
      {views.map((view) => (
        <Button
          key={view.name}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => reopen(view)}
          data-utrace-target="saved_view_reopen_control"
          data-testid="saved-view-reopen"
        >
          {view.name}
        </Button>
      ))}
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
