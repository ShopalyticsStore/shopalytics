"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedViews, saveView, type AnalyticsFilters, type SavedView } from "@/lib/db";
import { matchDateRangePreset, presetDateRange } from "@/lib/fixture/clock";

function reportView(milestoneId: string, view: SavedView): void {
  const status = utracePreviewStatus();
  if (status.phase !== "ready") return;
  const reference = status.session.annotations.safeValue("safe.view_ref", view.id);
  if (!reference.accepted || reference.value.value === undefined) return;
  status.session.annotations.milestone({
    milestoneId,
    severity: "info",
    priority: "normal",
    entityDefinitionId: "conversion_view",
    entityInstanceRef: reference.value.value,
    attributes: [{ name: "view_name", ruleId: "safe.view_name", value: view.name }],
  });
}

export function SavedViews({
  filters,
  now,
  accountId,
  onReopen,
}: {
  filters: AnalyticsFilters;
  now: Date;
  accountId: string;
  onReopen: (filters: AnalyticsFilters) => void;
}) {
  const [name, setName] = useState("");
  const client = useQueryClient();
  const queryKey = ["saved-views", accountId];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const save = useMutation({
    mutationFn: saveView,
    onSuccess: (view) => {
      client.setQueryData<SavedView[]>(queryKey, (current = []) => [...current, view]);
      setName("");
      reportView("saved_view_created", view);
    },
  });
  const validName = /^[\w ,'-]{1,60}$/u.test(name.trim());
  const error = save.error ?? views.error;

  return (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!validName || save.isPending) return;
          save.mutate({
            name: name.trim(),
            filters,
            dateRangePreset: matchDateRangePreset(filters, now),
          });
        }}
      >
        <Label htmlFor="saved-view-name" className="sr-only">
          View name
        </Label>
        <Input
          id="saved-view-name"
          className="h-8 w-48"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name this filter stack"
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!validName || save.isPending}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          {save.isPending ? "Saving…" : "Save view"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2" aria-label="Saved views">
        {views.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            size="sm"
            variant="outline"
            data-utrace-target="saved_view_reopen_control"
            onClick={() => {
              const range =
                view.dateRangePreset === "custom"
                  ? { startDate: view.filters.startDate, endDate: view.filters.endDate }
                  : presetDateRange(view.dateRangePreset, now);
              onReopen({ ...view.filters, ...range });
              reportView("saved_view_reopened", view);
            }}
          >
            {view.name}
          </Button>
        ))}
        {views.isPending && (
          <span className="text-sm text-muted-foreground">Loading saved views…</span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error.message}
        </p>
      )}
    </div>
  );
}
