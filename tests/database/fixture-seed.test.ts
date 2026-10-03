/**
 * Real-database coverage for seeding and for the queries the demo depends on.
 *
 * It installs the fixture into a throwaway schema on the database named by
 * `SHOPALYTICS_TEST_DATABASE_URL` and drops that schema afterwards. Nothing is
 * mocked: the SQL, the manifest verification and the single-use handoff record
 * all run against Postgres.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { installFixture } from "@/lib/fixture/install";
import { buildManifest } from "@/lib/fixture/manifest";
import { generateDudulemonDataset } from "@/lib/fixture/dataset";
import { presetDateRange, shiftUtcDays, toUtcDateString } from "@/lib/fixture/clock";
import { FIXTURE_CLOCK } from "@/lib/fixture/definition";
import type { AnalyticsFilters } from "@/lib/db/types";

const TEST_SCHEMA = "shopalytics_fixture_test";

type Shopalytics = typeof import("@/lib/server/shopalytics");

let client: pg.Client;
let shopalytics: Shopalytics;
let accountId: string;
let dimensions: {
  tiktok: string;
  tiktokShop: string;
  women2534: string;
  women3544: string;
  sizing: string;
  fitConsistency: string;
  purchased: string;
  cartDropOff: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required to run the database suite.`);
  }
  return value.trim();
}

function idOf(rows: readonly { id: string; name: string }[], name: string): string {
  const row = rows.find((candidate) => candidate.name === name);
  if (row === undefined) {
    throw new Error(`the seeded fixture has no "${name}"`);
  }
  return row.id;
}

function filters(overrides: Partial<AnalyticsFilters>): AnalyticsFilters {
  const window = presetDateRange("last_30_days", new Date(FIXTURE_CLOCK));
  return {
    accountId,
    productIds: [],
    trafficSourceIds: [],
    demographicSegmentIds: [],
    sentiments: [],
    reviewTopicIds: [],
    conversionStateIds: [dimensions.purchased],
    startDate: window.startDate,
    endDate: window.endDate,
    ...overrides,
  };
}

beforeAll(async () => {
  const connectionString = requireEnv("SHOPALYTICS_TEST_DATABASE_URL");
  process.env.DATABASE_URL = connectionString;
  process.env.SHOPALYTICS_DATABASE_SCHEMA = TEST_SCHEMA;
  process.env.SHOPALYTICS_FIXTURE_CLOCK = FIXTURE_CLOCK;

  client = new pg.Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);

  await installFixture({
    client,
    schema: TEST_SCHEMA,
    target: "base",
    schemaSql: await readFile(resolve("db/schema.sql"), "utf8"),
  });

  shopalytics = await import("@/lib/server/shopalytics");
  const context = await shopalytics.getDashboardContext("production_profile", null);
  accountId = context.account.id;

  const [sources, segments, topics, states] = await Promise.all([
    shopalytics.getTrafficSources(),
    shopalytics.getDemographicSegments(),
    shopalytics.getReviewTopics(),
    shopalytics.getConversionStates(),
  ]);
  dimensions = {
    tiktok: idOf(sources, "TikTok"),
    tiktokShop: idOf(sources, "TikTok Shop"),
    women2534: idOf(segments, "Women 25-34"),
    women3544: idOf(segments, "Women 35-44"),
    sizing: idOf(topics, "Sizing"),
    fitConsistency: idOf(topics, "Fit consistency"),
    purchased: idOf(states, "Purchased"),
    cartDropOff: idOf(states, "Cart drop-off"),
  };
});

afterAll(async () => {
  if (client !== undefined) {
    await client.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await client.end();
  }
});

describe("the seeded Dudulemon fixture", () => {
  test("records the manifest identity it installed", async () => {
    const expected = buildManifest(generateDudulemonDataset());
    const rows = await client.query<{
      content_hash: string;
      fixture_clock: string;
      seed_target: string;
    }>(`SELECT content_hash, fixture_clock, seed_target FROM "${TEST_SCHEMA}".fixture_manifest`);

    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]?.content_hash).toBe(expected.content_hash);
    expect(rows.rows[0]?.fixture_clock).toBe(FIXTURE_CLOCK);
    expect(rows.rows[0]?.seed_target).toBe("base");
  });

  test("signs the growth lead in as the seeded identity", async () => {
    const context = await shopalytics.getDashboardContext(
      "preview_handoff",
      "maya@dudulemon.example.com",
    );

    expect(context.account.name).toBe("Dudulemon");
    expect(context.user.name).toBe("Maya Okonkwo");
    expect(context.user.role).toBe("Growth lead");
    expect(context.fixtureClock).toBe("2026-09-14T09:00:00.000Z");
  });

  test("the canonical filter stack shows the conversion drop-off", async () => {
    const canonical = filters({
      trafficSourceIds: [dimensions.tiktok],
      demographicSegmentIds: [dimensions.women2534],
      reviewTopicIds: [dimensions.sizing],
      sentiments: ["negative"],
    });

    const kpis = await shopalytics.getKpis(canonical);

    expect(kpis.filtered.sessions).toBeGreaterThan(0);
    expect(kpis.filtered.stateShare).toBeGreaterThan(0);
    expect(kpis.filtered.stateShare).toBeLessThan(kpis.baseline.stateShare * 0.75);
    expect(kpis.filtered.conversionRate).toBeCloseTo(kpis.filtered.stateShare, 10);
  });

  test("an adjacent channel or segment is a visibly different slice", async () => {
    const canonical = filters({
      trafficSourceIds: [dimensions.tiktok],
      demographicSegmentIds: [dimensions.women2534],
      reviewTopicIds: [dimensions.sizing],
      sentiments: ["negative"],
    });
    const wrongChannel = { ...canonical, trafficSourceIds: [dimensions.tiktokShop] };
    const wrongSegment = { ...canonical, demographicSegmentIds: [dimensions.women3544] };

    const [exact, channel, segment] = await Promise.all([
      shopalytics.getKpis(canonical),
      shopalytics.getKpis(wrongChannel),
      shopalytics.getKpis(wrongSegment),
    ]);

    expect(channel.filtered.sessions).toBeGreaterThan(0);
    expect(segment.filtered.sessions).toBeGreaterThan(0);
    expect(channel.filtered.sessions).not.toBe(exact.filtered.sessions);
    expect(segment.filtered.sessions).not.toBe(exact.filtered.sessions);
    expect(channel.filtered.stateShare).toBeGreaterThan(exact.filtered.stateShare);
    expect(segment.filtered.stateShare).toBeGreaterThan(exact.filtered.stateShare);
  });

  test("the conversion state selects which cohort the series counts", async () => {
    const base = filters({
      trafficSourceIds: [dimensions.tiktok],
      demographicSegmentIds: [dimensions.women2534],
      reviewTopicIds: [dimensions.sizing],
      sentiments: ["negative"],
    });

    const purchased = await shopalytics.getKpis(base);
    const dropOff = await shopalytics.getKpis({
      ...base,
      conversionStateIds: [dimensions.cartDropOff],
    });

    expect(purchased.filtered.sessions).toBe(dropOff.filtered.sessions);
    expect(dropOff.filtered.stateShare).toBeGreaterThan(purchased.filtered.stateShare);
  });

  test("the review list matches the stack exactly, and adjacent topics stay out", async () => {
    const canonical = filters({
      trafficSourceIds: [dimensions.tiktok],
      demographicSegmentIds: [dimensions.women2534],
      reviewTopicIds: [dimensions.sizing],
      sentiments: ["negative"],
    });

    const reviews = await shopalytics.getReviews(canonical, 200);
    const nearMissTopic = await shopalytics.getReviews(
      { ...canonical, reviewTopicIds: [dimensions.fitConsistency] },
      200,
    );

    expect(reviews.length).toBeGreaterThanOrEqual(20);
    for (const review of reviews) {
      expect(review.trafficSourceName).toBe("TikTok");
      expect(review.demographicSegmentName).toBe("Women 25-34");
      expect(review.sentiment).toBe("negative");
      expect(review.topics).toContain("Sizing");
      expect(review.reviewerName).not.toBe("");
    }
    expect(nearMissTopic.length).toBeGreaterThan(0);
    expect(nearMissTopic.every((review) => !review.topics.includes("Sizing"))).toBe(true);
  });

  test("the same stack outside Last 30 days selects different reviews", async () => {
    const clock = new Date(FIXTURE_CLOCK);
    const canonical = filters({
      trafficSourceIds: [dimensions.tiktok],
      demographicSegmentIds: [dimensions.women2534],
      reviewTopicIds: [dimensions.sizing],
      sentiments: ["negative"],
    });

    const inside = await shopalytics.getReviews(canonical, 200);
    const outside = await shopalytics.getReviews(
      {
        ...canonical,
        startDate: toUtcDateString(shiftUtcDays(clock, -119)),
        endDate: toUtcDateString(shiftUtcDays(clock, -31)),
      },
      200,
    );

    expect(outside.length).toBeGreaterThan(0);
    const insideIds = new Set(inside.map((review) => review.id));
    expect(outside.every((review) => !insideIds.has(review.id))).toBe(true);
  });

  test("a handoff token can only be consumed once", async () => {
    const tokenId = "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    const users = await client.query<{ id: string }>(
      `SELECT id FROM "${TEST_SCHEMA}".users LIMIT 1`,
    );
    const userId = users.rows[0]?.id;
    expect(userId).toBeDefined();

    const insert = `INSERT INTO "${TEST_SCHEMA}".utrace_preview_handoff_consumption
       (token_id, subject_user_id, expires_at) VALUES ($1::uuid, $2::uuid, now() + interval '1 minute')`;
    await client.query(insert, [tokenId, userId]);

    await expect(client.query(insert, [tokenId, userId])).rejects.toMatchObject({ code: "23505" });
  });
});
