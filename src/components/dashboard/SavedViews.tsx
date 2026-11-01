"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedViews, saveView, type AnalyticsFilters } from "@/lib/db";
import { presetDateRange, type DateRangePreset } from "@/lib/fixture/clock";
import type { FilterState } from "./FilterBar";

function reportView(milestoneId: string, name: string): void {
  const status = utracePreviewStatus();
  if (status.phase !== "ready") return;
  status.session.annotations.milestone({
    milestoneId,
    severity: "info",
    priority: "normal",
    entityDefinitionId: null,
    entityInstanceRef: null,
    attributes: /^[\w ,'-]{1,60}$/.test(name)
      ? [{ name: "view_name", ruleId: "safe.view_name", value: name }]
      : [],
  });
}

interface Props {
  filters: AnalyticsFilters;
  datePreset: DateRangePreset;
  now: Date;
  scope: string;
  onRestore: (filters: FilterState) => void;
}

export function SavedViews({ filters, datePreset, now, scope, onRestore }: Props) {
  const [name, setName] = useState("");
  const client = useQueryClient();
  const queryKey = ["saved-conversion-views", scope];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const save = useMutation({
    mutationFn: () => saveView(name.trim(), filters, datePreset),
    onSuccess: async (view) => {
      reportView("saved_view_created", view.name);
      setName("");
      await client.invalidateQueries({ queryKey });
    },
  });
  const error = save.error ?? views.error;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !save.isPending) save.mutate();
        }}
      >
        <Label htmlFor="saved-view-name">Saved views</Label>
        <Input
          id="saved-view-name"
          className="w-40"
          placeholder="Name this view"
          aria-label="View name"
          maxLength={60}
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={!name.trim() || save.isPending}
          data-utrace-target="saved_view_save_control"
        >
          {save.isPending ? "Saving…" : "Save view"}
        </Button>
      </form>
      <div className="flex items-center gap-2">
        {views.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            variant="outline"
            size="sm"
            data-utrace-target="saved_view_reopen_control"
            onClick={() => {
              onRestore({
                ...view.filters,
                datePreset: view.datePreset,
                ...(view.datePreset === "custom" ? {} : presetDateRange(view.datePreset, now)),
              });
              reportView("saved_view_reopened", view.name);
            }}
          >
            {view.name}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error.message}
        </p>
      )}
    </div>
  );
}
