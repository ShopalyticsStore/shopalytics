/**
 * Server-side Shopalytics queries.
 *
 * `src/lib/db/types.ts` documents what the filters mean. This module is the
 * only place that knows SQL; the dashboard reaches it through
 * `POST /api/shopalytics`.
 *
 * Every conversion query composes the same aggregates, the same `WHERE`
 * fragment and the same parameter list, so the KPI cards, the trend chart and
 * the product table cannot disagree about which rows a filter stack selects.
 */

import type { QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";

import type {
  AnalyticsFilters,
  SavedConversionView,
  ConversionStateRow,
  DashboardContext,
  DimensionRow,
  KpiSummary,
  KpiWithBaseline,
  ProductRow,
  ProductSentiment,
  ReviewRow,
  SegmentRow,
  Sentiment,
  TrendPoint,
} from "@/lib/db/types";
import { FIXTURE_CLOCK_ENV_NAME, resolveFixtureClock } from "@/lib/fixture/clock";
import { queryRows } from "./db";

export function getSavedViews(accountId: string, userId: string): Promise<SavedConversionView[]> {
  return queryRows<SavedConversionView & QueryResultRow>(
    `SELECT id, name, filters, date_preset AS "datePreset" FROM saved_conversion_views
     WHERE account_id = $1::uuid AND user_id = $2::uuid ORDER BY created_at, id`,
    [accountId, userId],
  );
}

export async function saveView(
  accountId: string,
  userId: string,
  name: string,
  filters: AnalyticsFilters,
  datePreset: SavedConversionView["datePreset"],
): Promise<SavedConversionView> {
  const rows = await queryRows<SavedConversionView & QueryResultRow>(
    `INSERT INTO saved_conversion_views (id, account_id, user_id, name, filters, date_preset)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6)
     RETURNING id, name, filters, date_preset AS "datePreset"`,
    [randomUUID(), accountId, userId, name, JSON.stringify(filters), datePreset],
  );
  return rows[0]!;
}

export async function reopenView(
  accountId: string,
  userId: string,
  id: string,
): Promise<SavedConversionView | null> {
  const rows = await queryRows<SavedConversionView & QueryResultRow>(
    `SELECT id, name, filters, date_preset AS "datePreset" FROM saved_conversion_views
     WHERE account_id = $1::uuid AND user_id = $2::uuid AND id = $3::uuid`,
    [accountId, userId, id],
  );
  return rows[0] ?? null;
}

type SqlValue = string | number | boolean | Date | null | readonly string[];

type CountedRow = QueryResultRow & {
  sessions: string | number;
  product_views: string | number;
  add_to_carts: string | number;
  checkouts: string | number;
  purchases: string | number;
  revenue_cents: string | number;
  state_sessions: string | number;
};

function count(value: string | number): number {
  return Number(value);
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function nonEmpty(values: readonly string[]): readonly string[] | null {
  return values.length > 0 ? values : null;
}

/**
 * The aggregates every conversion query shares. `$9` is the selected conversion
 * state list; an empty list selects no cohort, so `state_sessions` is zero and
 * the chart reports that nothing is plotted.
 */
const METRIC_AGGREGATES = `
  COALESCE(SUM(m.sessions), 0)::bigint AS sessions,
  COALESCE(SUM(m.product_views), 0)::bigint AS product_views,
  COALESCE(SUM(m.add_to_carts), 0)::bigint AS add_to_carts,
  COALESCE(SUM(m.checkouts), 0)::bigint AS checkouts,
  COALESCE(SUM(m.purchases), 0)::bigint AS purchases,
  COALESCE(SUM(m.revenue_cents), 0)::bigint AS revenue_cents,
  COALESCE(SUM(m.sessions) FILTER (WHERE m.conversion_state_id = ANY($9::uuid[])), 0)::bigint AS state_sessions
`;

const METRIC_FROM = "FROM conversion_daily_metrics m";

const METRIC_FROM_WITH_PRODUCT = `
  FROM conversion_daily_metrics m
  JOIN products p ON p.id = m.product_id
`;

/**
 * The rows a filter stack selects. Review topic and sentiment qualify products
 * rather than filtering conversion rows directly.
 */
const METRIC_WHERE = `
  WHERE m.account_id = $1::uuid
    AND m.date BETWEEN $2::date AND $3::date
    AND ($4::uuid[] IS NULL OR m.product_id = ANY($4::uuid[]))
    AND ($5::uuid[] IS NULL OR m.traffic_source_id = ANY($5::uuid[]))
    AND ($6::uuid[] IS NULL OR m.demographic_segment_id = ANY($6::uuid[]))
    AND (
      ($7::text[] IS NULL AND $8::uuid[] IS NULL)
      OR m.product_id IN (
        SELECT cr.product_id
        FROM customer_reviews cr
        LEFT JOIN customer_review_topics crt ON crt.review_id = cr.id
        WHERE cr.account_id = $1::uuid
          AND cr.date BETWEEN $2::date AND $3::date
          AND ($7::text[] IS NULL OR cr.sentiment = ANY($7::text[]))
          AND ($8::uuid[] IS NULL OR crt.topic_id = ANY($8::uuid[]))
      )
    )
`;

function filteredMetricParams(accountId: string, filters: AnalyticsFilters): SqlValue[] {
  return [
    accountId,
    filters.startDate,
    filters.endDate,
    nonEmpty(filters.productIds),
    nonEmpty(filters.trafficSourceIds),
    nonEmpty(filters.demographicSegmentIds),
    nonEmpty(filters.sentiments),
    nonEmpty(filters.reviewTopicIds),
    filters.conversionStateIds,
  ];
}

/** The same date range and conversion states, account-wide. */
function baselineMetricParams(accountId: string, filters: AnalyticsFilters): SqlValue[] {
  return [
    accountId,
    filters.startDate,
    filters.endDate,
    null,
    null,
    null,
    null,
    null,
    filters.conversionStateIds,
  ];
}

function toKpi(row: CountedRow | undefined): KpiSummary {
  if (row === undefined) {
    return {
      sessions: 0,
      productViews: 0,
      addToCarts: 0,
      checkouts: 0,
      purchases: 0,
      revenueCents: 0,
      conversionRate: 0,
      addToCartRate: 0,
      checkoutRate: 0,
      stateSessions: 0,
      stateShare: 0,
    };
  }

  const sessions = count(row.sessions);
  const addToCarts = count(row.add_to_carts);
  const checkouts = count(row.checkouts);
  const purchases = count(row.purchases);
  const stateSessions = count(row.state_sessions);

  return {
    sessions,
    productViews: count(row.product_views),
    addToCarts,
    checkouts,
    purchases,
    revenueCents: count(row.revenue_cents),
    conversionRate: ratio(purchases, sessions),
    addToCartRate: ratio(addToCarts, sessions),
    checkoutRate: ratio(checkouts, sessions),
    stateSessions,
    stateShare: ratio(stateSessions, sessions),
  };
}

/** The signed-in user and the one account they belong to, plus the fixture clock. */
export async function getDashboardContext(
  authenticatedVia: DashboardContext["authenticatedVia"],
  signedInUserEmail: string,
): Promise<DashboardContext> {
  const rows = await queryRows<
    QueryResultRow & {
      account_id: string;
      account_name: string;
      user_id: string;
      user_name: string;
      email: string;
      role: string;
    }
  >(
    `
      SELECT
        a.id AS account_id,
        a.name AS account_name,
        u.id AS user_id,
        u.name AS user_name,
        u.email,
        u.role
      FROM accounts a
      JOIN users u ON u.account_id = a.id
      WHERE u.email = $1::text
    `,
    [signedInUserEmail],
  );

  const row = rows[0];
  if (row === undefined) {
    throw new Error(`no seeded Dudulemon user matches "${signedInUserEmail}".`);
  }

  const clock = resolveFixtureClock(process.env[FIXTURE_CLOCK_ENV_NAME]);
  return {
    account: { id: row.account_id, name: row.account_name },
    user: { id: row.user_id, name: row.user_name, email: row.email, role: row.role },
    fixtureClock: clock === null ? null : clock.toISOString(),
    authenticatedVia,
  };
}

/** The seeded user for one email address, used by the preview handoff. */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string; name: string; email: string; role: string } | null> {
  const rows = await queryRows<
    QueryResultRow & { id: string; name: string; email: string; role: string }
  >(`SELECT id, name, email, role FROM users WHERE email = $1::text`, [email]);
  return rows[0] ?? null;
}

export function getProducts(accountId: string): Promise<DimensionRow[]> {
  return queryRows<DimensionRow & QueryResultRow>(
    `SELECT id, name FROM products WHERE account_id = $1::uuid ORDER BY name ASC`,
    [accountId],
  );
}

export function getTrafficSources(): Promise<DimensionRow[]> {
  return queryRows<DimensionRow & QueryResultRow>(
    `SELECT id, name FROM traffic_sources ORDER BY name ASC`,
    [],
  );
}

export function getDemographicSegments(): Promise<DimensionRow[]> {
  return queryRows<DimensionRow & QueryResultRow>(
    `SELECT id, name FROM demographic_segments ORDER BY name ASC`,
    [],
  );
}

export function getReviewTopics(): Promise<DimensionRow[]> {
  return queryRows<DimensionRow & QueryResultRow>(
    `SELECT id, name FROM review_topics ORDER BY name ASC`,
    [],
  );
}

export function getConversionStates(): Promise<ConversionStateRow[]> {
  return queryRows<ConversionStateRow & QueryResultRow>(
    `SELECT id, key, name, ordinal FROM conversion_states ORDER BY ordinal ASC`,
    [],
  );
}

export async function getKpis(
  accountId: string,
  filters: AnalyticsFilters,
): Promise<KpiWithBaseline> {
  const statement = `SELECT ${METRIC_AGGREGATES} ${METRIC_FROM} ${METRIC_WHERE}`;
  const [filtered, baseline] = await Promise.all([
    queryRows<CountedRow>(statement, filteredMetricParams(accountId, filters)),
    queryRows<CountedRow>(statement, baselineMetricParams(accountId, filters)),
  ]);
  return { filtered: toKpi(filtered[0]), baseline: toKpi(baseline[0]) };
}

export async function getConversionTrend(
  accountId: string,
  filters: AnalyticsFilters,
): Promise<TrendPoint[]> {
  const rows = await queryRows<CountedRow & { date: string }>(
    `SELECT m.date::text AS date, ${METRIC_AGGREGATES} ${METRIC_FROM} ${METRIC_WHERE}
     GROUP BY m.date ORDER BY m.date ASC`,
    filteredMetricParams(accountId, filters),
  );

  return rows.map((row) => {
    const sessions = count(row.sessions);
    const purchases = count(row.purchases);
    const stateSessions = count(row.state_sessions);
    return {
      date: row.date,
      sessions,
      purchases,
      conversionRate: ratio(purchases, sessions),
      stateSessions,
      stateShare: ratio(stateSessions, sessions),
    };
  });
}

export async function getProductBreakdown(
  accountId: string,
  filters: AnalyticsFilters,
): Promise<ProductRow[]> {
  const rows = await queryRows<CountedRow & { product_id: string; product_name: string }>(
    `SELECT p.id AS product_id, p.name AS product_name, ${METRIC_AGGREGATES}
     ${METRIC_FROM_WITH_PRODUCT} ${METRIC_WHERE}
     GROUP BY p.id, p.name ORDER BY SUM(m.sessions) DESC`,
    filteredMetricParams(accountId, filters),
  );

  return rows.map((row) => {
    const sessions = count(row.sessions);
    const purchases = count(row.purchases);
    const stateSessions = count(row.state_sessions);
    return {
      productId: row.product_id,
      productName: row.product_name,
      sessions,
      purchases,
      conversionRate: ratio(purchases, sessions),
      revenueCents: count(row.revenue_cents),
      stateSessions,
      stateShare: ratio(stateSessions, sessions),
    };
  });
}

export async function getReviews(
  accountId: string,
  filters: AnalyticsFilters,
  limit: number,
): Promise<ReviewRow[]> {
  const rows = await queryRows<
    QueryResultRow & {
      id: string;
      date: string;
      rating: number;
      sentiment: Sentiment;
      body: string;
      product_name: string;
      traffic_source_name: string;
      demographic_segment_name: string;
      reviewer_name: string;
      reviewer_location: string;
      topics: string[];
    }
  >(
    `
      SELECT
        cr.id,
        cr.date::text AS date,
        cr.rating,
        cr.sentiment,
        cr.body,
        cr.reviewer_name,
        cr.reviewer_location,
        p.name AS product_name,
        ts.name AS traffic_source_name,
        ds.name AS demographic_segment_name,
        COALESCE(
          array_agg(rt.name ORDER BY rt.name) FILTER (WHERE rt.name IS NOT NULL),
          '{}'
        ) AS topics
      FROM customer_reviews cr
      JOIN products p ON p.id = cr.product_id
      JOIN traffic_sources ts ON ts.id = cr.traffic_source_id
      JOIN demographic_segments ds ON ds.id = cr.demographic_segment_id
      LEFT JOIN customer_review_topics crt ON crt.review_id = cr.id
      LEFT JOIN review_topics rt ON rt.id = crt.topic_id
      WHERE cr.account_id = $1::uuid
        AND cr.date BETWEEN $2::date AND $3::date
        AND ($4::uuid[] IS NULL OR cr.product_id = ANY($4::uuid[]))
        AND ($5::uuid[] IS NULL OR cr.traffic_source_id = ANY($5::uuid[]))
        AND ($6::uuid[] IS NULL OR cr.demographic_segment_id = ANY($6::uuid[]))
        AND ($7::text[] IS NULL OR cr.sentiment = ANY($7::text[]))
        AND (
          $8::uuid[] IS NULL
          OR EXISTS (
            SELECT 1
            FROM customer_review_topics selected
            WHERE selected.review_id = cr.id
              AND selected.topic_id = ANY($8::uuid[])
          )
        )
      GROUP BY cr.id, p.name, ts.name, ds.name
      ORDER BY cr.date DESC, cr.id ASC
      LIMIT $9::int
    `,
    [
      accountId,
      filters.startDate,
      filters.endDate,
      nonEmpty(filters.productIds),
      nonEmpty(filters.trafficSourceIds),
      nonEmpty(filters.demographicSegmentIds),
      nonEmpty(filters.sentiments),
      nonEmpty(filters.reviewTopicIds),
      limit,
    ],
  );

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    rating: row.rating,
    sentiment: row.sentiment,
    body: row.body,
    productName: row.product_name,
    trafficSourceName: row.traffic_source_name,
    demographicSegmentName: row.demographic_segment_name,
    topics: row.topics,
    reviewerName: row.reviewer_name,
    reviewerLocation: row.reviewer_location,
  }));
}

export async function getSegmentBreakdown(
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<SegmentRow[]> {
  const rows = await queryRows<
    QueryResultRow & {
      segment_id: string;
      segment_name: string;
      source_id: string;
      source_name: string;
      sessions: string | number;
      purchases: string | number;
      revenue_cents: string | number;
    }
  >(
    `
      SELECT
        ds.id AS segment_id,
        ds.name AS segment_name,
        ts.id AS source_id,
        ts.name AS source_name,
        SUM(m.sessions)::bigint AS sessions,
        SUM(m.purchases)::bigint AS purchases,
        SUM(m.revenue_cents)::bigint AS revenue_cents
      FROM conversion_daily_metrics m
      JOIN demographic_segments ds ON ds.id = m.demographic_segment_id
      JOIN traffic_sources ts ON ts.id = m.traffic_source_id
      WHERE m.account_id = $1::uuid
        AND m.date BETWEEN $2::date AND $3::date
      GROUP BY ds.id, ds.name, ts.id, ts.name
      ORDER BY SUM(m.sessions) DESC
    `,
    [accountId, startDate, endDate],
  );

  return rows.map((row) => {
    const sessions = count(row.sessions);
    const purchases = count(row.purchases);
    return {
      segmentId: row.segment_id,
      segmentName: row.segment_name,
      sourceId: row.source_id,
      sourceName: row.source_name,
      sessions,
      purchases,
      conversionRate: ratio(purchases, sessions),
      revenueCents: count(row.revenue_cents),
    };
  });
}

export async function getProductSentiment(accountId: string): Promise<ProductSentiment[]> {
  const rows = await queryRows<
    QueryResultRow & {
      product_id: string;
      positive: string | number;
      neutral: string | number;
      negative: string | number;
      total: string | number;
      avg_rating: string | number;
    }
  >(
    `
      SELECT
        product_id,
        SUM((sentiment = 'positive')::int)::bigint AS positive,
        SUM((sentiment = 'neutral')::int)::bigint AS neutral,
        SUM((sentiment = 'negative')::int)::bigint AS negative,
        COUNT(*)::bigint AS total,
        ROUND(AVG(rating)::numeric, 2) AS avg_rating
      FROM customer_reviews
      WHERE account_id = $1::uuid
      GROUP BY product_id
    `,
    [accountId],
  );

  return rows.map((row) => ({
    productId: row.product_id,
    positive: count(row.positive),
    neutral: count(row.neutral),
    negative: count(row.negative),
    total: count(row.total),
    avgRating: count(row.avg_rating),
  }));
}
