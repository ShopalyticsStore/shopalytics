"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedViews, saveView, type AnalyticsFilters } from "@/lib/db";
import { reportSavedView } from "@/lib/utrace/chart-state-reporter";
import { matchDateRangePreset, presetDateRange } from "@/lib/fixture/clock";

export function SavedViews({
  userId,
  filters,
  now,
  onOpen,
}: {
  userId: string;
  filters: AnalyticsFilters;
  now: Date;
  onOpen: (filters: AnalyticsFilters) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const queryKey = ["saved-conversion-views", userId];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const save = useMutation({
    mutationFn: () => saveView(name.trim(), filters, matchDateRangePreset(filters, now)),
    onSuccess: (view) => {
      reportSavedView("saved_view_created", view);
      setMessage(`Saved “${view.name}”.`);
      setName("");
      void client.invalidateQueries({ queryKey });
    },
  });
  const error = save.error ?? views.error;

  return (
    <div className="flex items-center gap-2">
      <form
        className="order-last flex shrink-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          save.mutate();
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
          required
          maxLength={60}
          title="Use letters, numbers, spaces, commas, apostrophes or hyphens."
          placeholder="Monday TikTok conversion"
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={save.isPending || !/^[\w ,'-]{1,60}$/u.test(name.trim())}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          {save.isPending ? "Saving…" : "Save view"}
        </Button>
      </form>
      <div className="flex items-center gap-2" aria-label="Saved views">
        <span className="text-sm text-muted-foreground">Saved views</span>
        {views.isPending && <span className="text-sm text-muted-foreground">Loading…</span>}
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
              onOpen({
                productIds: view.filters.productIds,
                trafficSourceIds: view.filters.trafficSourceIds,
                demographicSegmentIds: view.filters.demographicSegmentIds,
                sentiments: view.filters.sentiments,
                reviewTopicIds: view.filters.reviewTopicIds,
                conversionStateIds: view.filters.conversionStateIds,
                startDate: view.filters.startDate,
                endDate: view.filters.endDate,
                ...(view.dateRangePreset === "custom"
                  ? {}
                  : presetDateRange(view.dateRangePreset, now)),
              });
              reportSavedView("saved_view_reopened", view);
              setMessage(`Opened “${view.name}”.`);
            }}
          >
            {view.name}
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className="sr-only">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error.message}
        </p>
      )}
    </div>
  );
}
