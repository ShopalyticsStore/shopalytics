/**
 * Properties the demo depends on.
 *
 * The scenario needs more than "plausible data": the canonical filter stack
 * (`TikTok` + `Women 25-34` + `Sizing` + `Negative`) must select real rows
 * inside `Last 30 days`, the same shape must also exist outside that window,
 * every near-miss cohort must be populated, and the sizing products must show a
 * conversion drop-off that is visible against the preceding period.
 *
 * Generation checks these, so a tuning change that quietly destroys the demo
 * fails at generation time instead of during an interview.
 */

import {
  CANONICAL_DEMOGRAPHIC_SEGMENT,
  CANONICAL_REVIEW_TOPIC,
  CANONICAL_TRAFFIC_SOURCE,
  NEAR_MISS_DEMOGRAPHIC_SEGMENTS,
  NEAR_MISS_REVIEW_TOPIC,
  FIXTURE_HISTORY_DAYS,
  NEAR_MISS_TRAFFIC_SOURCE,
  PRODUCTS,
} from "./definition";
import { presetDateRange, shiftUtcDays, toUtcDateString } from "./clock";
import type { DudulemonDataset } from "./dataset";

export type FixtureInvariants = Readonly<{
  canonicalReviewsInsideWindow: number;
  canonicalReviewsOutsideWindow: number;
  nearMissChannelReviews: number;
  nearMissSegmentReviews: number;
  nearMissTopicReviews: number;
  nearMissSentimentReviews: number;
  canonicalConversionRateRecent: number;
  canonicalConversionRatePrior: number;
  canonicalCartDropOffRateRecent: number;
}>;

type Lookup = Readonly<{
  sizingProductIds: ReadonlySet<string>;
  canonicalSourceId: string;
  nearMissSourceId: string;
  canonicalSegmentId: string;
  nearMissSegmentIds: ReadonlySet<string>;
  canonicalTopicId: string;
  nearMissTopicId: string;
  purchasedStateId: string;
  cartDropOffStateId: string;
}>;

function required<T>(value: T | undefined, description: string): T {
  if (value === undefined) {
    throw new Error(`the fixture is missing ${description}`);
  }
  return value;
}

function buildLookup(dataset: DudulemonDataset): Lookup {
  const sizingNames = new Set(
    PRODUCTS.filter((product) => product.sizingDropOff).map((product) => product.name),
  );
  return {
    sizingProductIds: new Set(
      dataset.products.filter((product) => sizingNames.has(product.name)).map((p) => p.id),
    ),
    canonicalSourceId: required(
      dataset.traffic_sources.find((source) => source.name === CANONICAL_TRAFFIC_SOURCE),
      `the ${CANONICAL_TRAFFIC_SOURCE} channel`,
    ).id,
    nearMissSourceId: required(
      dataset.traffic_sources.find((source) => source.name === NEAR_MISS_TRAFFIC_SOURCE),
      `the ${NEAR_MISS_TRAFFIC_SOURCE} channel`,
    ).id,
    canonicalSegmentId: required(
      dataset.demographic_segments.find(
        (segment) => segment.name === CANONICAL_DEMOGRAPHIC_SEGMENT,
      ),
      `the ${CANONICAL_DEMOGRAPHIC_SEGMENT} segment`,
    ).id,
    nearMissSegmentIds: new Set(
      dataset.demographic_segments
        .filter((segment) => NEAR_MISS_DEMOGRAPHIC_SEGMENTS.includes(segment.name))
        .map((segment) => segment.id),
    ),
    canonicalTopicId: required(
      dataset.review_topics.find((topic) => topic.name === CANONICAL_REVIEW_TOPIC),
      `the ${CANONICAL_REVIEW_TOPIC} review topic`,
    ).id,
    nearMissTopicId: required(
      dataset.review_topics.find((topic) => topic.name === NEAR_MISS_REVIEW_TOPIC),
      `the ${NEAR_MISS_REVIEW_TOPIC} review topic`,
    ).id,
    purchasedStateId: required(
      dataset.conversion_states.find((state) => state.key === "purchased"),
      "the purchased conversion state",
    ).id,
    cartDropOffStateId: required(
      dataset.conversion_states.find((state) => state.key === "cart_drop_off"),
      "the cart drop-off conversion state",
    ).id,
  };
}

/** Measures the demo-critical properties of a generated dataset. */
export function measureFixtureInvariants(dataset: DudulemonDataset): FixtureInvariants {
  const lookup = buildLookup(dataset);
  const window = presetDateRange("last_30_days", dataset.clock);
  const priorStart = toUtcDateString(shiftUtcDays(dataset.clock, -(FIXTURE_HISTORY_DAYS - 1)));
  const priorEnd = toUtcDateString(shiftUtcDays(dataset.clock, -30));

  const topicsByReview = new Map<string, Set<string>>();
  for (const link of dataset.customer_review_topics) {
    const existing = topicsByReview.get(link.review_id);
    if (existing === undefined) {
      topicsByReview.set(link.review_id, new Set([link.topic_id]));
    } else {
      existing.add(link.topic_id);
    }
  }

  const counters = {
    canonicalReviewsInsideWindow: 0,
    canonicalReviewsOutsideWindow: 0,
    nearMissChannelReviews: 0,
    nearMissSegmentReviews: 0,
    nearMissTopicReviews: 0,
    nearMissSentimentReviews: 0,
  };

  for (const review of dataset.customer_reviews) {
    const topics = topicsByReview.get(review.id) ?? new Set<string>();
    const sizingProduct = lookup.sizingProductIds.has(review.product_id);
    const inWindow = review.date >= window.startDate && review.date <= window.endDate;
    const canonicalTopic = topics.has(lookup.canonicalTopicId);
    const canonicalStack =
      sizingProduct &&
      review.traffic_source_id === lookup.canonicalSourceId &&
      review.demographic_segment_id === lookup.canonicalSegmentId &&
      canonicalTopic &&
      review.sentiment === "negative";

    if (canonicalStack && inWindow) counters.canonicalReviewsInsideWindow += 1;
    if (canonicalStack && !inWindow) counters.canonicalReviewsOutsideWindow += 1;
    if (
      inWindow &&
      sizingProduct &&
      canonicalTopic &&
      review.sentiment === "negative" &&
      review.traffic_source_id === lookup.nearMissSourceId &&
      review.demographic_segment_id === lookup.canonicalSegmentId
    ) {
      counters.nearMissChannelReviews += 1;
    }
    if (
      inWindow &&
      sizingProduct &&
      canonicalTopic &&
      review.sentiment === "negative" &&
      review.traffic_source_id === lookup.canonicalSourceId &&
      lookup.nearMissSegmentIds.has(review.demographic_segment_id)
    ) {
      counters.nearMissSegmentReviews += 1;
    }
    if (
      inWindow &&
      sizingProduct &&
      topics.has(lookup.nearMissTopicId) &&
      review.sentiment === "negative" &&
      review.traffic_source_id === lookup.canonicalSourceId &&
      review.demographic_segment_id === lookup.canonicalSegmentId
    ) {
      counters.nearMissTopicReviews += 1;
    }
    if (
      inWindow &&
      sizingProduct &&
      canonicalTopic &&
      review.sentiment !== "negative" &&
      review.traffic_source_id === lookup.canonicalSourceId &&
      review.demographic_segment_id === lookup.canonicalSegmentId
    ) {
      counters.nearMissSentimentReviews += 1;
    }
  }

  const recent = { sessions: 0, purchased: 0, cartDropOff: 0 };
  const prior = { sessions: 0, purchased: 0, cartDropOff: 0 };
  for (const row of dataset.conversion_daily_metrics) {
    if (
      !lookup.sizingProductIds.has(row.product_id) ||
      row.traffic_source_id !== lookup.canonicalSourceId ||
      row.demographic_segment_id !== lookup.canonicalSegmentId
    ) {
      continue;
    }
    const bucket =
      row.date >= window.startDate && row.date <= window.endDate
        ? recent
        : row.date >= priorStart && row.date <= priorEnd
          ? prior
          : null;
    if (bucket === null) continue;
    bucket.sessions += row.sessions;
    if (row.conversion_state_id === lookup.purchasedStateId) bucket.purchased += row.sessions;
    if (row.conversion_state_id === lookup.cartDropOffStateId) bucket.cartDropOff += row.sessions;
  }

  if (recent.sessions === 0 || prior.sessions === 0) {
    throw new Error(
      "the canonical TikTok / Women 25-34 slice has no sessions; the fixture cannot demonstrate a drop-off",
    );
  }

  return Object.freeze({
    ...counters,
    canonicalConversionRateRecent: recent.purchased / recent.sessions,
    canonicalConversionRatePrior: prior.purchased / prior.sessions,
    canonicalCartDropOffRateRecent: recent.cartDropOff / recent.sessions,
  });
}

/** Minimum row counts and rate gaps the demo needs. */
export const REQUIRED_INVARIANTS = Object.freeze({
  canonicalReviewsInsideWindow: 20,
  canonicalReviewsOutsideWindow: 10,
  nearMissChannelReviews: 5,
  nearMissSegmentReviews: 5,
  nearMissTopicReviews: 5,
  nearMissSentimentReviews: 4,
  /** The recent conversion rate must be at most this share of the prior one. */
  maximumConversionRateRatio: 0.7,
  minimumCartDropOffRateRecent: 0.12,
});

/** Throws when a generated dataset cannot carry the demo. */
export function assertFixtureInvariants(dataset: DudulemonDataset): FixtureInvariants {
  const measured = measureFixtureInvariants(dataset);
  const failures: string[] = [];

  const minimums = [
    "canonicalReviewsInsideWindow",
    "canonicalReviewsOutsideWindow",
    "nearMissChannelReviews",
    "nearMissSegmentReviews",
    "nearMissTopicReviews",
    "nearMissSentimentReviews",
  ] as const;
  for (const key of minimums) {
    if (measured[key] < REQUIRED_INVARIANTS[key]) {
      failures.push(`${key}: ${measured[key]} < ${REQUIRED_INVARIANTS[key]}`);
    }
  }

  const ratio = measured.canonicalConversionRateRecent / measured.canonicalConversionRatePrior;
  if (ratio > REQUIRED_INVARIANTS.maximumConversionRateRatio) {
    failures.push(
      `canonical conversion drop-off is not visible: recent/prior ratio ${ratio.toFixed(3)} > ${REQUIRED_INVARIANTS.maximumConversionRateRatio}`,
    );
  }
  if (measured.canonicalCartDropOffRateRecent < REQUIRED_INVARIANTS.minimumCartDropOffRateRecent) {
    failures.push(
      `canonical cart drop-off rate ${measured.canonicalCartDropOffRateRecent.toFixed(3)} < ${REQUIRED_INVARIANTS.minimumCartDropOffRateRecent}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`the generated fixture cannot carry the demo: ${failures.join("; ")}`);
  }
  return measured;
}
