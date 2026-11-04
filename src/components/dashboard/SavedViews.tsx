"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { utracePreviewStatus } from "@utrace/browser-sdk/next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSavedViews, saveView, type AnalyticsFilters, type SavedView } from "@/lib/db";

function report(milestoneId: string, name: string): void {
  const status = utracePreviewStatus();
  if (status.phase !== "ready") return;
  status.session.annotations.milestone({
    milestoneId,
    severity: "info",
    priority: "normal",
    entityDefinitionId: null,
    entityInstanceRef: null,
    attributes: /^[\w ,'-]{1,60}$/u.test(name)
      ? [{ name: "view_name", ruleId: "safe.view_name", value: name }]
      : [],
  });
}

export function SavedViews({
  accountId,
  userId,
  filters,
  onReopen,
}: {
  accountId: string;
  userId: string;
  filters: AnalyticsFilters;
  onReopen: (filters: AnalyticsFilters) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  const queryKey = ["saved-views", accountId, userId];
  const views = useQuery({ queryKey, queryFn: getSavedViews });
  const save = useMutation({
    mutationFn: () => saveView(name.trim(), filters),
    onSuccess: (view) => {
      client.setQueryData<SavedView[]>(queryKey, (current) => [view, ...(current ?? [])]);
      setName("");
      setMessage(`Saved ${view.name}`);
      report("saved_view_created", view.name);
    },
  });
  const error = save.error ?? views.error;

  return (
    <div className="flex items-center gap-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && !save.isPending) save.mutate();
        }}
      >
        <Label htmlFor="saved-view-name">View name</Label>
        <Input
          id="saved-view-name"
          className="h-8 w-40"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          data-utrace-target="saved_view_name_field"
          data-utrace-safe-value="safe.view_name"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!name.trim() || save.isPending}
          data-utrace-target="saved_view_save_control"
          data-utrace-safe-value="safe.control_label"
        >
          {save.isPending ? "Saving…" : "Save view"}
        </Button>
      </form>
      <div className="flex items-center gap-2" aria-label="Saved views">
        {views.isPending && <span className="text-sm text-muted-foreground">Loading views…</span>}
        {views.data?.map((view) => (
          <Button
            key={view.id}
            type="button"
            variant="outline"
            size="sm"
            data-utrace-target="saved_view_reopen_control"
            onClick={() => {
              onReopen(view.filters);
              setMessage(`Opened ${view.name}`);
              report("saved_view_reopened", view.name);
            }}
          >
            {view.name}
          </Button>
        ))}
      </div>
      <span role="status" className="sr-only">
        {message}
      </span>
      {error && (
        <span role="alert" className="text-sm text-critical">
          {error.message}
        </span>
      )}
    </div>
  );
}
