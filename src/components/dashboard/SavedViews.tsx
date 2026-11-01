"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSavedViews,
  reopenConversionView,
  saveConversionView,
  type AnalyticsFilters,
} from "@/lib/db";
import { matchDateRangePreset } from "@/lib/fixture/clock";
import { useChartStateChannel } from "@/lib/utrace/use-chart-state";

export function SavedViews({
  filters,
  now,
  owner,
  onRestore,
}: {
  filters: AnalyticsFilters;
  now: Date;
  owner: string;
  onRestore: (filters: AnalyticsFilters) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const channel = useChartStateChannel();
  const queryKey = ["saved-conversion-views", owner];
  const views = useQuery({ queryKey, queryFn: getSavedViews });

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const view = await saveConversionView(
        name.trim(),
        filters,
        matchDateRangePreset(filters, now),
      );
      await client.invalidateQueries({ queryKey });
      channel.savedView("saved_view_created", view.id, view.name, new Date());
      setName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save view");
    } finally {
      setBusy(false);
    }
  }

  async function reopen(id: string) {
    setBusy(true);
    setError(null);
    try {
      const view = await reopenConversionView(id);
      onRestore(view.filters);
      channel.savedView("saved_view_reopened", view.id, view.name, new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reopen view");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Label htmlFor="saved-view-name" className="sr-only">
          View name
        </Label>
        <Input
          id="saved-view-name"
          className="h-8 w-40"
          placeholder="View name"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || !name.trim()}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          Save view
        </Button>
      </form>
      <div className="flex items-center gap-2" aria-label="Saved views">
        {views.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void reopen(view.id)}
            data-utrace-target="saved_view_reopen_control"
          >
            {view.name}
          </Button>
        ))}
      </div>
      {(error || views.error) && (
        <p role="alert" className="text-sm text-critical">
          {error ?? views.error?.message}
        </p>
      )}
    </div>
  );
}
