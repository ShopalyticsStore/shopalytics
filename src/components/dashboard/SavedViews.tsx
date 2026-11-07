"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSavedViews,
  reopenConversionView,
  saveConversionView,
  type AnalyticsFilters,
} from "@/lib/db";
import { reportSavedView } from "@/lib/utrace/chart-state-reporter";

export function SavedViews({
  filters,
  onReopen,
}: {
  filters: AnalyticsFilters;
  onReopen: (filters: AnalyticsFilters) => void;
}) {
  const views = useQuery({ queryKey: ["saved-conversion-views"], queryFn: getSavedViews });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update saved views");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="saved-view-name">View name</Label>
        <Input
          id="saved-view-name"
          className="w-48"
          value={name}
          maxLength={60}
          placeholder="TikTok women 25-34 sizing"
          disabled={busy}
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          size="sm"
          disabled={busy || !/^[\w ,'-]{1,60}$/u.test(name.trim())}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
          onClick={() =>
            void run(async () => {
              const view = await saveConversionView(name.trim(), filters);
              reportSavedView("saved_view_created", view.name);
              setMessage(`Saved ${view.name}`);
              await views.refetch();
            })
          }
        >
          Save view
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Saved views">
        {(views.data ?? []).map((savedView) => (
          <Button
            key={savedView.id}
            size="sm"
            variant="outline"
            disabled={busy}
            data-utrace-target="saved_view_reopen_control"
            data-utrace-safe-value="safe.control_label"
            onClick={() =>
              void run(async () => {
                const view = await reopenConversionView(savedView.id);
                onReopen(view.filters);
                setName(view.name);
                reportSavedView("saved_view_reopened", view.name);
                setMessage(`Opened ${view.name}`);
              })
            }
          >
            {savedView.name}
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {(error || views.error) && (
        <p role="alert" className="text-sm text-critical">
          {error ?? views.error?.message}
        </p>
      )}
    </div>
  );
}
