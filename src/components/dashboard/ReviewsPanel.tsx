import { Star } from "lucide-react";
import { format, parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReviewRow } from "@/lib/db";

interface Props {
  rows: ReviewRow[];
}

const SENTIMENT_TONES: Record<ReviewRow["sentiment"], "success" | "secondary" | "destructive"> = {
  positive: "success",
  neutral: "secondary",
  negative: "destructive",
};

/**
 * What the agent may say about a review: its sentiment, date, product, and
 * text, never the reviewer. uTrace caps the label at 120 characters.
 */
function reviewSummary(row: ReviewRow): string {
  return `${row.sentiment} review, ${format(parseISO(row.date), "MMM d")}, ${row.productName}: ${row.body}`;
}

/** Reviewer names and locations are shape-preserving synthetic values. */
export function ReviewsPanel({ rows }: Props) {
  return (
    <Card
      className="flex gap-0 overflow-hidden py-0"
      data-testid="review-list"
      data-utrace-visual-target="conversion_review_panel"
    >
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <CardTitle>Customer reviews</CardTitle>
        <span className="text-xs text-muted-foreground">
          {rows.length} matching review{rows.length === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="max-h-[28rem] divide-y overflow-y-auto p-0 [&:last-child]:pb-0">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No reviews match the current filters
          </div>
        ) : (
          rows.map((row) => (
            <article
              key={row.id}
              data-testid={`review-${row.id}`}
              data-utrace-visual-target="conversion_review"
              data-utrace-safe-value="safe.review_summary"
              aria-label={reviewSummary(row)}
              className="px-4 py-3 transition-colors hover:bg-muted"
            >
              <header className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className={cn(
                        "size-3.5",
                        index < row.rating
                          ? "fill-rating text-rating"
                          : "fill-none text-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
                <Badge variant={SENTIMENT_TONES[row.sentiment]} className="capitalize">
                  {row.sentiment}
                </Badge>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {format(parseISO(row.date), "MMM d, yyyy")}
                </span>
              </header>
              <p className="mt-1.5 text-sm text-foreground">{row.body}</p>
              <footer className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{row.productName}</span>
                <span>&middot;</span>
                <span>{row.trafficSourceName}</span>
                <span>&middot;</span>
                <span>{row.demographicSegmentName}</span>
                <span>&middot;</span>
                <span data-utrace-sensitive="true">
                  {row.reviewerName}, {row.reviewerLocation}
                </span>
                {row.topics.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {row.topics.map((topic) => (
                      <span
                        key={topic}
                        className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs font-medium"
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
