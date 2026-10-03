/**
 * One dimension of the conversion filter stack.
 *
 * `testId` gives the trigger and each option a stable hook, so the uTrace
 * browser SDK's annotations and any UI automation identify a control by
 * identity rather than by visible label.
 */

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MultiOption {
  id: string;
  name: string;
}

interface Props {
  label: string;
  testId: string;
  /**
   * The uTrace target definition this control registers as. The agent points,
   * circles and labels it through the structured target registry, never through
   * a selector or a screen coordinate.
   */
  utraceTarget: string;
  options: readonly MultiOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

export function MultiSelectFilter({
  label,
  testId,
  utraceTarget,
  options,
  selected,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selected);
  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? "1 selected")
        : `${selected.length} selected`;

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(selected.filter((candidate) => candidate !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            data-testid={`${testId}-trigger`}
            data-utrace-target={utraceTarget}
            data-utrace-safe-value="safe.control_label"
            className={cn(
              "h-9 justify-between gap-2 bg-card font-normal",
              selected.length > 0 && "border-foreground/40",
            )}
          >
            <span className="truncate text-left">{summary}</span>
            <div className="flex items-center gap-1">
              {selected.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  data-testid={`${testId}-clear`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange([]);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </span>
              )}
              <ChevronDown className="size-3.5 opacity-60" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start" data-testid={`${testId}-options`}>
          <div className="max-h-64 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
            ) : (
              options.map((o) => {
                const isSel = selectedSet.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    data-testid={`${testId}-option-${o.id}`}
                    onClick={() => toggle(o.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded border",
                        isSel
                          ? "border-foreground bg-foreground text-background"
                          : "border-input bg-background",
                      )}
                    >
                      {isSel && <Check className="size-3" />}
                    </span>
                    <span className="truncate">{o.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
