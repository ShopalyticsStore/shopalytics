"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FilterState } from "./FilterBar";
import {
  getSavedViews,
  saveView,
  type AnalyticsFilters,
  type DashboardContext,
  type SavedView,
} from "@/lib/db";
import { presetDateRange, resolveDashboardNow } from "@/lib/fixture/clock";

function report(milestoneId: string, name: string): void {
  const status = utracePreviewStatus();
  if (status.phase !== "ready") return;
  status.session.annotations.milestone({
    milestoneId,
    severity: "info",
    priority: "normal",
    entityDefinitionId: null,
    entityInstanceRef: null,
    attributes: [{ name: "view_name", ruleId: "safe.view_name", value: name }],
  });
}

export function SavedViews({
  context,
  filters,
  datePreset,
  onReopen,
}: {
  context: DashboardContext;
  filters: AnalyticsFilters;
  datePreset: SavedView["datePreset"];
  onReopen: (state: FilterState) => void;
}) {
  const [name, setName] = useState("");
  const client = useQueryClient();
  const queryKey = ["saved-views", context.account.id, context.user.id];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const save = useMutation({
    mutationFn: () => saveView(name.trim(), filters, datePreset),
    onSuccess: (view) => {
      client.setQueryData<SavedView[]>(queryKey, (current) => [...(current ?? []), view]);
      setName("");
      report("saved_view_created", view.name);
    },
  });
  const error = save.error ?? views.error;

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !save.isPending) save.mutate();
        }}
      >
        <Label htmlFor="saved-view-name">View name</Label>
        <Input
          id="saved-view-name"
          className="w-64"
          value={name}
          maxLength={60}
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
              const now = resolveDashboardNow(context.fixtureClock, new Date());
              const range =
                view.datePreset === "custom" ? {} : presetDateRange(view.datePreset, now);
              onReopen({ ...view.filters, ...range, datePreset: view.datePreset });
              report("saved_view_reopened", view.name);
            }}
          >
            {view.name}
          </Button>
        ))}
      </div>
      {error instanceof Error && (
        <p role="alert" className="text-sm text-critical">
          {error.message}
        </p>
      )}
    </div>
  );
}
