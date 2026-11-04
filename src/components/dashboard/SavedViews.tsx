"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSavedViews, reopenView, saveView, type AnalyticsFilters } from "@/lib/db";
import { reportSavedView } from "@/lib/utrace/chart-state-reporter";
import { matchDateRangePreset, presetDateRange } from "@/lib/fixture/clock";

interface Props {
  filters: AnalyticsFilters;
  onRestore: (filters: AnalyticsFilters) => void;
  now: Date;
}

export function SavedViews({ filters, onRestore, now }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const views = useQuery({ queryKey: ["saved-conversion-views"], queryFn: getSavedViews });

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const view = await saveView(name.trim(), filters, matchDateRangePreset(filters, now));
      reportSavedView("saved_view_created", view.name);
      setMessage(`Saved “${view.name}”.`);
      setName("");
      await views.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save view.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen(id: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const view = await reopenView(id);
      const preset = view.dateRangePreset;
      onRestore({
        ...view.filters,
        ...(preset && preset !== "custom" ? presetDateRange(preset, now) : {}),
      });
      reportSavedView("saved_view_reopened", view.name);
      setMessage(`Opened “${view.name}”.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open view.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
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
          className="h-7 w-48"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          pattern="[\w ,'\-]+"
          required
          placeholder="Monday TikTok conversions"
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || !/^[\w ,'-]{1,60}$/u.test(name.trim())}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          Save view
        </Button>
      </form>
      <Select
        value=""
        onValueChange={(id) => void reopen(id)}
        disabled={busy || !views.data?.length}
      >
        <SelectTrigger
          size="sm"
          className="w-48"
          aria-label="Open saved view"
          data-utrace-target="saved_view_reopen_control"
        >
          <SelectValue placeholder="Open saved view" />
        </SelectTrigger>
        <SelectContent>
          {views.data?.map((view) => (
            <SelectItem key={view.id} value={view.id}>
              {view.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {message && (
        <p role="status" className="sr-only">
          {message}
        </p>
      )}
      {(error || views.error) && (
        <p role="alert" className="text-sm text-critical">
          {error || views.error?.message}
        </p>
      )}
    </div>
  );
}
