"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSavedViews,
  saveView,
  type AnalyticsFilters,
  type DashboardContext,
  type SavedView,
} from "@/lib/db";
import { presetDateRange, resolveDashboardNow } from "@/lib/fixture/clock";
import type { FilterState } from "./FilterBar";

function recordView(milestoneId: string, view: SavedView): void {
  const status = utracePreviewStatus();
  if (status.phase !== "ready") return;
  status.session.annotations.milestone({
    milestoneId,
    severity: "info",
    priority: "normal",
    entityDefinitionId: "conversion_view",
    entityInstanceRef: view.id,
    attributes: /^[\w ,'-]{1,60}$/.test(view.name)
      ? [{ name: "view_name", ruleId: "safe.view_name", value: view.name }]
      : [],
  });
}

export function SavedViews({
  filters,
  datePreset,
  context,
  onReopen,
}: {
  filters: AnalyticsFilters;
  datePreset: SavedView["datePreset"];
  context: DashboardContext;
  onReopen: (filters: FilterState) => void;
}) {
  const client = useQueryClient();
  const queryKey = ["saved-views", context.account.id, context.user.id];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const view = await saveView(name.trim(), filters, datePreset);
      client.setQueryData<SavedView[]>(queryKey, (previous = []) => [...previous, view]);
      setName("");
      recordView("saved_view_created", view);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save view");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Label htmlFor="saved-view-name">View name</Label>
        <Input
          id="saved-view-name"
          className="w-60"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={saving || !name.trim()}
          data-utrace-target="saved_view_save_control"
        >
          {saving ? "Saving…" : "Save view"}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {views.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            size="sm"
            variant="outline"
            data-utrace-target="saved_view_reopen_control"
            onClick={() => {
              const range =
                view.datePreset === "custom"
                  ? {}
                  : presetDateRange(
                      view.datePreset,
                      resolveDashboardNow(context.fixtureClock, new Date()),
                    );
              onReopen({ ...view.filters, ...range, datePreset: view.datePreset });
              recordView("saved_view_reopened", view);
            }}
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
