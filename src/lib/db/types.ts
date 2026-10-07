/**
 * The dashboard's data contract.
 *
 * The dashboard imports only from `@/lib/db`; `queries.ts` forwards to the
 * server through one API route and `src/lib/server/shopalytics.ts` runs the SQL.
 *
 * Filter semantics, in one place because several surfaces depend on them:
 *
 *   date range, channel, demographic segment
 *     restrict the conversion rows directly.
 *   review topic, sentiment
 *     qualify products: a product is in the slice when it has at least one
 *     review in the same date range matching the selected topics and
 *     sentiments. This is what makes "products with negative sizing reviews"
 *     a conversion question rather than only a review question.
 *   conversion state
 *     selects the cohort the displayed series counts. `stateSessions` is the
 *     number of sessions in the slice that ended in one of the selected states
 *     and `stateShare` is its share of `sessions`. Selecting `Purchased` makes
 *     the series the conversion rate; selecting a drop-off state makes it that
 *     drop-off rate over the same denominator.
 */

export type Sentiment = "positive" | "neutral" | "negative";

/** A filter stack; the account it reads is always the signed-in user's own. */
export interface AnalyticsFilters {
  productIds: string[];
  trafficSourceIds: string[];
  demographicSegmentIds: string[];
  sentiments: Sentiment[];
  reviewTopicIds: string[];
  conversionStateIds: string[];
  /** Inclusive `yyyy-mm-dd`. */
  startDate: string;
  /** Inclusive `yyyy-mm-dd`. */
  endDate: string;
}

export interface DimensionRow {
  id: string;
  name: string;
}

export interface ConversionStateRow extends DimensionRow {
  key: string;
  ordinal: number;
}

export interface KpiSummary {
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
  revenueCents: number;
  /** purchases / sessions */
  conversionRate: number;
  /** add_to_carts / sessions */
  addToCartRate: number;
  /** checkouts / sessions */
  checkoutRate: number;
  /** Sessions that ended in one of the selected conversion states. */
  stateSessions: number;
  /** stateSessions / sessions */
  stateShare: number;
}

export interface KpiWithBaseline {
  filtered: KpiSummary;
  /** The same date range and conversion states, account-wide. */
  baseline: KpiSummary;
}

export interface ProductRow {
  productId: string;
  productName: string;
  sessions: number;
  purchases: number;
  conversionRate: number;
  revenueCents: number;
  stateSessions: number;
  stateShare: number;
}

export interface TrendPoint {
  date: string;
  sessions: number;
  purchases: number;
  conversionRate: number;
  stateSessions: number;
  stateShare: number;
}

export interface ReviewRow {
  id: string;
  date: string;
  rating: number;
  sentiment: Sentiment;
  body: string;
  productName: string;
  trafficSourceName: string;
  demographicSegmentName: string;
  topics: string[];
  /** Shape-preserving synthetic reviewer identity. */
  reviewerName: string;
  reviewerLocation: string;
}

export interface DashboardContext {
  account: { id: string; name: string };
  user: { id: string; name: string; email: string; role: string };
  /**
   * The RFC 3339 instant the dashboard treats as "now", or `null` when the
   * fixture runs on real time. The browser cannot read
   * `SHOPALYTICS_FIXTURE_CLOCK` directly, so the server sends it here.
   */
  fixtureClock: string | null;
  /** How the current user was authenticated. */
  authenticatedVia: "preview_handoff" | "production_profile";
}

export interface SegmentRow {
  segmentId: string;
  segmentName: string;
  sourceId: string;
  sourceName: string;
  sessions: number;
  purchases: number;
  conversionRate: number;
  revenueCents: number;
}

export interface ProductSentiment {
  productId: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  avgRating: number;
}
