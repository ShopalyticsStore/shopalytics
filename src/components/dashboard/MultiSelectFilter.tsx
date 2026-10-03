/**
 * One dimension of the conversion filter stack.
 *
 * `testId` gives the trigger and each option a stable hook, so the uTrace
 * browser SDK's annotations and any UI automation identify a control by
 * identity rather than by visible label.
 *
 * The trigger's accessible name is the value it shows ("All", "TikTok",
 * "2 selected"), which is what uTrace reports the control as showing. The
 * dimension's own name sits inside the trigger as its description, so it is
 * read out with the control without becoming part of that name.
 */

import { useId, useState } from "react";
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
  const labelId = useId();

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-describedby={labelId}
          data-testid={`${testId}-trigger`}
          data-utrace-target={utraceTarget}
          data-utrace-safe-value="safe.control_label"
          className="max-w-72 justify-between gap-1.5 pl-2.5 pr-1.5 text-sm"
        >
          <span id={labelId} aria-hidden="true" className="font-normal text-muted-foreground">
            {label}
          </span>
          <span className={cn("truncate text-left", selected.length > 0 && "font-semibold")}>
            {summary}
          </span>
          <div className="flex items-center gap-0.5">
            {selected.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                data-testid={`${testId}-clear`}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange([]);
                }}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-3.5" />
              </span>
            )}
            <ChevronDown className="size-4 text-foreground/70" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" data-testid={`${testId}-options`}>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No options</div>
          ) : (
            options.map((o) => {
              const isSel = selectedSet.has(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  data-testid={`${testId}-option-${o.id}`}
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                    isSel && "bg-accent hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      isSel
                        ? "border-foreground bg-foreground text-background"
                        : "border-input bg-card",
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
  );
}
