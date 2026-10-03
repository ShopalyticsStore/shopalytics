/**
 * Deterministic generation of the Dudulemon dataset.
 *
 * `generateDudulemonDataset` is a pure function of the fixture definition: the
 * same input produces byte-identical rows, in the same order, on every machine.
 * Row objects use the database's snake_case column names so seeding, hashing
 * and the manifest all describe the same thing.
 *
 * The conversion grain is one row per
 * (product, channel, segment, conversion state, day). A cohort row counts the
 * sessions that ended in that conversion state and carries the funnel counters
 * that cohort reached, so any slice sums exactly and the share of a selected
 * conversion state is a real ratio rather than a modelled rate.
 */

import {
  ACCOUNT_NAME,
  CANONICAL_DEMOGRAPHIC_SEGMENT,
  CANONICAL_REVIEW_TOPIC,
  CANONICAL_TRAFFIC_SOURCE,
  CONVERSION_STATES,
  DEMOGRAPHIC_SEGMENTS,
  FIXTURE_CLOCK,
  FIXTURE_HISTORY_DAYS,
  FIXTURE_ROOT_SEED,
  FIXTURE_UUID_NAMESPACE,
  GROWTH_LEAD,
  NEAR_MISS_DEMOGRAPHIC_SEGMENTS,
  NEAR_MISS_REVIEW_TOPIC,
  NEAR_MISS_TRAFFIC_SOURCE,
  PRODUCTS,
  REVIEWER_EMAIL_DOMAIN,
  REVIEWER_FAMILY_NAMES,
  REVIEWER_GIVEN_NAMES,
  REVIEWER_LOCATIONS,
  REVIEW_BODIES,
  REVIEW_TOPICS,
  SIZING_DROP_OFF_START_DAYS_AGO,
  TRAFFIC_SOURCES,
  type ConversionStateKey,
} from "./definition";
import { parseFixtureClock, shiftUtcDays, toUtcDateString } from "./clock";
import { createRandomStream, deterministicUuid } from "./random";

export type Sentiment = "positive" | "neutral" | "negative";

export type AccountRow = Readonly<{ id: string; name: string; created_at: string }>;

export type UserRow = Readonly<{
  id: string;
  account_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}>;

export type ProductRow = Readonly<{ id: string; account_id: string; name: string }>;

export type NamedDimensionRow = Readonly<{ id: string; name: string }>;

export type ConversionStateRow = Readonly<{
  id: string;
  key: ConversionStateKey;
  name: string;
  ordinal: number;
}>;

export type ConversionMetricRow = Readonly<{
  id: string;
  account_id: string;
  product_id: string;
  traffic_source_id: string;
  demographic_segment_id: string;
  conversion_state_id: string;
  date: string;
  sessions: number;
  product_views: number;
  add_to_carts: number;
  checkouts: number;
  purchases: number;
  revenue_cents: number;
}>;

export type CustomerReviewRow = Readonly<{
  id: string;
  account_id: string;
  product_id: string;
  traffic_source_id: string;
  demographic_segment_id: string;
  date: string;
  rating: number;
  sentiment: Sentiment;
  body: string;
  reviewer_name: string;
  reviewer_email: string;
  reviewer_location: string;
}>;

export type CustomerReviewTopicRow = Readonly<{ review_id: string; topic_id: string }>;

export type DudulemonDataset = Readonly<{
  clock: Date;
  accounts: readonly AccountRow[];
  users: readonly UserRow[];
  products: readonly ProductRow[];
  traffic_sources: readonly NamedDimensionRow[];
  demographic_segments: readonly NamedDimensionRow[];
  review_topics: readonly NamedDimensionRow[];
  conversion_states: readonly ConversionStateRow[];
  conversion_daily_metrics: readonly ConversionMetricRow[];
  customer_reviews: readonly CustomerReviewRow[];
  customer_review_topics: readonly CustomerReviewTopicRow[];
}>;

/** Sessions per day across the whole account before seasonality and jitter. */
const DAILY_ACCOUNT_SESSIONS = 9_400;

/**
 * A (product, channel, segment) combination is seeded for a day only once it
 * clears this many sessions. Thin combinations simply have no row, which is what
 * a real analytics store looks like and keeps the fixture small enough to seed
 * a fresh preview quickly.
 */
const MINIMUM_COHORT_SESSIONS = 20;

/** Background reviews, on top of the guaranteed cohorts below. */
const BACKGROUND_REVIEW_COUNT = 520;

/** Guaranteed review cohorts. Each one makes a specific restoration error visible. */
const GUARANTEED_REVIEW_COHORTS = Object.freeze({
  canonicalInsideWindow: 30,
  canonicalOutsideWindow: 16,
  nearMissChannel: 10,
  nearMissSegment: 12,
  nearMissTopic: 10,
  nearMissSentiment: 8,
});

function uuid(kind: string, name: string): string {
  return deterministicUuid(FIXTURE_UUID_NAMESPACE, `${kind}/${name}`);
}

function seasonality(daysAgo: number): number {
  // A slow upward trend towards the clock plus a weekly rhythm.
  const trend = 1 + (FIXTURE_HISTORY_DAYS - daysAgo) / (FIXTURE_HISTORY_DAYS * 6);
  const weekday = daysAgo % 7;
  const weekend = weekday === 2 || weekday === 3 ? 1.12 : 1;
  return trend * weekend;
}

function bodiesFor(topic: string, sentiment: Sentiment): readonly string[] {
  const group = REVIEW_BODIES.find(
    (candidate) => candidate.topic === topic && candidate.sentiment === sentiment,
  );
  if (group === undefined) {
    throw new Error(`no review bodies defined for topic "${topic}" and sentiment "${sentiment}"`);
  }
  return group.bodies;
}

function ratingFor(sentiment: Sentiment, offset: number): number {
  if (sentiment === "negative") return 1 + (offset % 2);
  if (sentiment === "neutral") return 3;
  return 4 + (offset % 2);
}

/** Generates the complete dataset. Deterministic for a fixed definition. */
export function generateDudulemonDataset(): DudulemonDataset {
  const clock = parseFixtureClock(FIXTURE_CLOCK);

  const accountId = uuid("account", ACCOUNT_NAME);
  const accounts: AccountRow[] = [
    {
      id: accountId,
      name: ACCOUNT_NAME,
      created_at: shiftUtcDays(clock, -(FIXTURE_HISTORY_DAYS + 400)).toISOString(),
    },
  ];

  const users: UserRow[] = [
    {
      id: uuid("user", GROWTH_LEAD.email),
      account_id: accountId,
      name: GROWTH_LEAD.name,
      email: GROWTH_LEAD.email,
      role: GROWTH_LEAD.role,
      created_at: shiftUtcDays(clock, -(FIXTURE_HISTORY_DAYS + 120)).toISOString(),
    },
  ];

  const products: ProductRow[] = PRODUCTS.map((product) => ({
    id: uuid("product", product.name),
    account_id: accountId,
    name: product.name,
  }));
  const trafficSources: NamedDimensionRow[] = TRAFFIC_SOURCES.map((source) => ({
    id: uuid("traffic_source", source.name),
    name: source.name,
  }));
  const segments: NamedDimensionRow[] = DEMOGRAPHIC_SEGMENTS.map((segment) => ({
    id: uuid("demographic_segment", segment.name),
    name: segment.name,
  }));
  const reviewTopics: NamedDimensionRow[] = REVIEW_TOPICS.map((name) => ({
    id: uuid("review_topic", name),
    name,
  }));
  const conversionStates: ConversionStateRow[] = CONVERSION_STATES.map((state) => ({
    id: uuid("conversion_state", state.key),
    key: state.key,
    name: state.name,
    ordinal: state.ordinal,
  }));

  const conversionMetrics = generateConversionMetrics({
    accountId,
    clock,
    productIds: products.map((product) => product.id),
    trafficSourceIds: trafficSources.map((source) => source.id),
    segmentIds: segments.map((segment) => segment.id),
    conversionStateIds: conversionStates.map((state) => state.id),
  });

  const reviews = generateReviews({
    accountId,
    clock,
    products,
    trafficSources,
    segments,
    reviewTopics,
  });

  return Object.freeze({
    clock,
    accounts,
    users,
    products,
    traffic_sources: trafficSources,
    demographic_segments: segments,
    review_topics: reviewTopics,
    conversion_states: conversionStates,
    conversion_daily_metrics: conversionMetrics,
    customer_reviews: reviews.reviews,
    customer_review_topics: reviews.reviewTopicLinks,
  });
}

type ConversionMetricsInput = Readonly<{
  accountId: string;
  clock: Date;
  productIds: readonly string[];
  trafficSourceIds: readonly string[];
  segmentIds: readonly string[];
  conversionStateIds: readonly string[];
}>;

function generateConversionMetrics(input: ConversionMetricsInput): ConversionMetricRow[] {
  const volume = createRandomStream(FIXTURE_ROOT_SEED, "conversion.volume");
  const split = createRandomStream(FIXTURE_ROOT_SEED, "conversion.split");
  const rows: ConversionMetricRow[] = [];

  for (let daysAgo = FIXTURE_HISTORY_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const date = toUtcDateString(shiftUtcDays(input.clock, -daysAgo));
    const daySessions = DAILY_ACCOUNT_SESSIONS * seasonality(daysAgo);
    const inDropOffWindow = daysAgo <= SIZING_DROP_OFF_START_DAYS_AGO;

    for (let productIndex = 0; productIndex < PRODUCTS.length; productIndex += 1) {
      const product = PRODUCTS[productIndex]!;
      for (let sourceIndex = 0; sourceIndex < TRAFFIC_SOURCES.length; sourceIndex += 1) {
        const source = TRAFFIC_SOURCES[sourceIndex]!;
        for (let segmentIndex = 0; segmentIndex < DEMOGRAPHIC_SEGMENTS.length; segmentIndex += 1) {
          const segment = DEMOGRAPHIC_SEGMENTS[segmentIndex]!;

          const expected =
            daySessions *
            product.popularity *
            source.weight *
            segment.weight *
            volume.float(0.7, 1.3);
          const sessions = Math.round(expected);
          if (sessions < MINIMUM_COHORT_SESSIONS) {
            continue;
          }

          const affectedByDropOff =
            inDropOffWindow &&
            product.sizingDropOff &&
            source.name === CANONICAL_TRAFFIC_SOURCE &&
            segment.name === CANONICAL_DEMOGRAPHIC_SEGMENT;
          const mildlyAffected = inDropOffWindow && product.sizingDropOff && !affectedByDropOff;

          let purchaseRate =
            product.baseConversionRate * source.conversionFactor * segment.conversionFactor;
          if (affectedByDropOff) purchaseRate *= 0.38;
          else if (mildlyAffected) purchaseRate *= 0.82;
          purchaseRate *= split.float(0.85, 1.15);

          const cartDropRate = affectedByDropOff
            ? split.float(0.17, 0.23)
            : split.float(0.07, 0.11);
          const checkoutDropRate = affectedByDropOff
            ? split.float(0.05, 0.08)
            : split.float(0.03, 0.05);

          const purchased = Math.round(sessions * purchaseRate);
          const cartDropOff = Math.round(sessions * cartDropRate);
          const checkoutDropOff = Math.round(sessions * checkoutDropRate);
          const browseOnly = sessions - purchased - cartDropOff - checkoutDropOff;
          if (browseOnly < 0) {
            continue;
          }

          const cohortSessions: Readonly<Record<ConversionStateKey, number>> = {
            purchased,
            checkout_drop_off: checkoutDropOff,
            cart_drop_off: cartDropOff,
            browse_only: browseOnly,
          };

          for (let stateIndex = 0; stateIndex < CONVERSION_STATES.length; stateIndex += 1) {
            const state = CONVERSION_STATES[stateIndex]!;
            const stateSessions = cohortSessions[state.key];
            if (stateSessions <= 0) {
              continue;
            }
            const productViews = Math.round(
              stateSessions * (state.key === "browse_only" ? 1 : 1.4),
            );
            rows.push({
              id: uuid(
                "conversion_daily_metric",
                `${date}/${productIndex}/${sourceIndex}/${segmentIndex}/${state.key}`,
              ),
              account_id: input.accountId,
              product_id: input.productIds[productIndex]!,
              traffic_source_id: input.trafficSourceIds[sourceIndex]!,
              demographic_segment_id: input.segmentIds[segmentIndex]!,
              conversion_state_id: input.conversionStateIds[stateIndex]!,
              date,
              sessions: stateSessions,
              product_views: productViews,
              add_to_carts: state.reached.addToCart ? stateSessions : 0,
              checkouts: state.reached.checkout ? stateSessions : 0,
              purchases: state.reached.purchase ? stateSessions : 0,
              revenue_cents: state.reached.purchase ? stateSessions * product.priceCents : 0,
            });
          }
        }
      }
    }
  }

  return rows;
}

type ReviewInput = Readonly<{
  accountId: string;
  clock: Date;
  products: readonly ProductRow[];
  trafficSources: readonly NamedDimensionRow[];
  segments: readonly NamedDimensionRow[];
  reviewTopics: readonly NamedDimensionRow[];
}>;

type ReviewSpec = Readonly<{
  productName: string;
  sourceName: string;
  segmentName: string;
  topics: readonly string[];
  sentiment: Sentiment;
  daysAgo: number;
}>;

function generateReviews(input: ReviewInput): {
  reviews: CustomerReviewRow[];
  reviewTopicLinks: CustomerReviewTopicRow[];
} {
  const plan = createRandomStream(FIXTURE_ROOT_SEED, "reviews.plan");
  const people = createRandomStream(FIXTURE_ROOT_SEED, "reviews.people");

  const sizingProducts = PRODUCTS.filter((product) => product.sizingDropOff).map(
    (product) => product.name,
  );
  const otherProducts = PRODUCTS.filter((product) => !product.sizingDropOff).map(
    (product) => product.name,
  );
  const otherSources = TRAFFIC_SOURCES.filter(
    (source) => source.name !== CANONICAL_TRAFFIC_SOURCE,
  ).map((source) => source.name);
  const otherSegments = DEMOGRAPHIC_SEGMENTS.filter(
    (segment) => segment.name !== CANONICAL_DEMOGRAPHIC_SEGMENT,
  ).map((segment) => segment.name);

  const specs: ReviewSpec[] = [];

  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.canonicalInsideWindow; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: CANONICAL_TRAFFIC_SOURCE,
      segmentName: CANONICAL_DEMOGRAPHIC_SEGMENT,
      topics: [CANONICAL_REVIEW_TOPIC],
      sentiment: "negative",
      daysAgo: plan.int(0, SIZING_DROP_OFF_START_DAYS_AGO),
    });
  }
  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.canonicalOutsideWindow; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: CANONICAL_TRAFFIC_SOURCE,
      segmentName: CANONICAL_DEMOGRAPHIC_SEGMENT,
      topics: [CANONICAL_REVIEW_TOPIC],
      sentiment: "negative",
      daysAgo: plan.int(45, FIXTURE_HISTORY_DAYS - 1),
    });
  }
  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.nearMissChannel; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: NEAR_MISS_TRAFFIC_SOURCE,
      segmentName: CANONICAL_DEMOGRAPHIC_SEGMENT,
      topics: [CANONICAL_REVIEW_TOPIC],
      sentiment: "negative",
      daysAgo: plan.int(0, 29),
    });
  }
  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.nearMissSegment; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: CANONICAL_TRAFFIC_SOURCE,
      segmentName: plan.pick(NEAR_MISS_DEMOGRAPHIC_SEGMENTS),
      topics: [CANONICAL_REVIEW_TOPIC],
      sentiment: "negative",
      daysAgo: plan.int(0, 29),
    });
  }
  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.nearMissTopic; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: CANONICAL_TRAFFIC_SOURCE,
      segmentName: CANONICAL_DEMOGRAPHIC_SEGMENT,
      topics: [NEAR_MISS_REVIEW_TOPIC],
      sentiment: "negative",
      daysAgo: plan.int(0, 29),
    });
  }
  for (let index = 0; index < GUARANTEED_REVIEW_COHORTS.nearMissSentiment; index += 1) {
    specs.push({
      productName: plan.pick(sizingProducts),
      sourceName: CANONICAL_TRAFFIC_SOURCE,
      segmentName: CANONICAL_DEMOGRAPHIC_SEGMENT,
      topics: [CANONICAL_REVIEW_TOPIC],
      sentiment: plan.chance(0.5) ? "positive" : "neutral",
      daysAgo: plan.int(0, 29),
    });
  }

  const backgroundTopics = REVIEW_TOPICS.filter((topic) => topic !== CANONICAL_REVIEW_TOPIC);
  for (let index = 0; index < BACKGROUND_REVIEW_COUNT; index += 1) {
    const topic = plan.chance(0.22) ? CANONICAL_REVIEW_TOPIC : plan.pick(backgroundTopics);
    const sentiment: Sentiment = plan.chance(0.42)
      ? "positive"
      : plan.chance(0.45)
        ? "negative"
        : "neutral";
    specs.push({
      productName: plan.chance(0.4) ? plan.pick(sizingProducts) : plan.pick(otherProducts),
      sourceName: plan.chance(0.3) ? CANONICAL_TRAFFIC_SOURCE : plan.pick(otherSources),
      segmentName: plan.chance(0.3) ? CANONICAL_DEMOGRAPHIC_SEGMENT : plan.pick(otherSegments),
      topics: [topic],
      sentiment,
      daysAgo: plan.int(0, FIXTURE_HISTORY_DAYS - 1),
    });
  }

  const productIdByName = new Map(input.products.map((product) => [product.name, product.id]));
  const sourceIdByName = new Map(input.trafficSources.map((source) => [source.name, source.id]));
  const segmentIdByName = new Map(input.segments.map((segment) => [segment.name, segment.id]));
  const topicIdByName = new Map(input.reviewTopics.map((topic) => [topic.name, topic.id]));

  const reviews: CustomerReviewRow[] = [];
  const reviewTopicLinks: CustomerReviewTopicRow[] = [];

  specs.forEach((spec, index) => {
    const bodies = bodiesFor(spec.topics[0]!, spec.sentiment);
    const body = bodies[index % bodies.length]!;
    const givenName = people.pick(REVIEWER_GIVEN_NAMES);
    const familyName = people.pick(REVIEWER_FAMILY_NAMES);
    const reviewId = uuid("customer_review", `${index}`);
    const date = toUtcDateString(shiftUtcDays(input.clock, -spec.daysAgo));

    const productId = productIdByName.get(spec.productName);
    const sourceId = sourceIdByName.get(spec.sourceName);
    const segmentId = segmentIdByName.get(spec.segmentName);
    if (productId === undefined || sourceId === undefined || segmentId === undefined) {
      throw new Error(
        `review ${index} references an unknown dimension: ${spec.productName} / ${spec.sourceName} / ${spec.segmentName}`,
      );
    }

    reviews.push({
      id: reviewId,
      account_id: input.accountId,
      product_id: productId,
      traffic_source_id: sourceId,
      demographic_segment_id: segmentId,
      date,
      rating: ratingFor(spec.sentiment, index),
      sentiment: spec.sentiment,
      body,
      reviewer_name: `${givenName} ${familyName}`,
      reviewer_email: `${givenName.toLowerCase()}.${familyName.toLowerCase()}${people.int(10, 99)}@${REVIEWER_EMAIL_DOMAIN}`,
      reviewer_location: people.pick(REVIEWER_LOCATIONS),
    });

    for (const topicName of spec.topics) {
      const topicId = topicIdByName.get(topicName);
      if (topicId === undefined) {
        throw new Error(`review ${index} references an unknown topic "${topicName}"`);
      }
      reviewTopicLinks.push({ review_id: reviewId, topic_id: topicId });
    }
  });

  return { reviews, reviewTopicLinks };
}
