import { Star } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReviewRow } from "@/lib/db";

interface Props {
  rows: ReviewRow[];
}

const SENTIMENT_STYLES: Record<ReviewRow["sentiment"], string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  neutral: "bg-muted text-muted-foreground border-border",
  negative: "border-rose-500/30 bg-rose-500/10 text-rose-500",
};

/** Reviewer names and locations are shape-preserving synthetic values. */
export function ReviewsPanel({ rows }: Props) {
  return (
    <Card
      className="flex gap-0 overflow-hidden py-0"
      data-testid="review-list"
      data-utrace-visual-target="conversion_review_panel"
    >
      <CardHeader className="flex flex-row items-center justify-between border-b py-5">
        <CardTitle>Customer reviews</CardTitle>
        <span className="text-xs text-muted-foreground">
          {rows.length} matching review{rows.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="max-h-[28rem] divide-y overflow-y-auto p-0">
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No reviews match the current filters
          </div>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              data-testid={`review-${row.id}`}
              data-utrace-sensitive="true"
              className="px-5 py-4 transition-colors hover:bg-muted/25"
            >
              <header className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        "size-3.5",
                        index < row.rating
                          ? "fill-amber-400 text-amber-400"
                          : "fill-none text-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    SENTIMENT_STYLES[row.sentiment],
                  )}
                >
                  {row.sentiment}
                </Badge>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {format(parseISO(row.date), "MMM d, yyyy")}
                </span>
              </header>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{row.body}</p>
              <footer className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{row.productName}</span>
                <span>&middot;</span>
                <span>{row.trafficSourceName}</span>
                <span>&middot;</span>
                <span>{row.demographicSegmentName}</span>
                <span>&middot;</span>
                <span>
                  {row.reviewerName}, {row.reviewerLocation}
                </span>
                {row.topics.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {row.topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                      >
                        {topic}
                      </span>
                    ))}
                  </span>
                )}
              </footer>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
