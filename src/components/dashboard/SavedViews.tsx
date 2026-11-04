"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSavedViews, saveView, type AnalyticsFilters } from "@/lib/db";
import { reportSavedView } from "@/lib/utrace/chart-state-reporter";

export function SavedViews({
  userId,
  filters,
  onRestore,
}: {
  userId: string;
  filters: AnalyticsFilters;
  onRestore: (filters: AnalyticsFilters) => void;
}) {
  const client = useQueryClient();
  const queryKey = ["saved-conversion-views", userId];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  return (
    <div className="relative flex items-center gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError(null);
          try {
            const view = await saveView(name.trim(), filters);
            reportSavedView("saved_view_created", view.name);
            setMessage(`Saved ${view.name}`);
            setName("");
            await client.invalidateQueries({ queryKey });
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Unable to save view");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Label htmlFor="saved-view-name" className="sr-only">
          View name
        </Label>
        <Input
          id="saved-view-name"
          className="w-48"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={60}
          pattern={"[\\w ,'\\-]+"}
          placeholder="Monday TikTok sizing review"
          title="Use letters, numbers, spaces, commas, apostrophes or hyphens."
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim()}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          {saving ? "Saving…" : "Save view"}
        </Button>
      </form>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Saved views
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex flex-col gap-2" aria-label="Saved views">
          {views.isPending && <span className="text-sm">Loading…</span>}
          {views.data?.length === 0 && (
            <span className="text-sm text-muted-foreground">No saved views yet.</span>
          )}
          {views.data?.map((view) => (
            <Button
              key={view.id}
              variant="outline"
              size="sm"
              data-utrace-target="saved_view_reopen_control"
              onClick={() => {
                onRestore(view.filters);
                reportSavedView("saved_view_reopened", view.name);
                setMessage(`Opened ${view.name}`);
              }}
            >
              {view.name}
            </Button>
          ))}
        </PopoverContent>
      </Popover>
      {(error || views.error) && (
        <p
          role="alert"
          className="absolute right-0 top-full z-10 rounded-lg bg-card p-2 text-sm text-critical shadow-button"
        >
          {error ?? views.error?.message}
        </p>
      )}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
