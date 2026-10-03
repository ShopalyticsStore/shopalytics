import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { generateDudulemonDataset } from "@/lib/fixture/dataset";
import { assertFixtureInvariants } from "@/lib/fixture/invariants";
import {
  FIXTURE_TABLE_NAMES,
  MANIFEST_RELATIVE_PATH,
  assertManifestsMatch,
  buildManifest,
  parseManifest,
  serializeManifest,
} from "@/lib/fixture/manifest";

describe("the Dudulemon fixture manifest", () => {
  test("regeneration is byte-identical", () => {
    const first = serializeManifest(buildManifest(generateDudulemonDataset()));
    const second = serializeManifest(buildManifest(generateDudulemonDataset()));

    expect(second).toBe(first);
  });

  test("the committed manifest matches a fresh generation", async () => {
    const committed = await readFile(resolve(MANIFEST_RELATIVE_PATH), "utf8");
    const regenerated = serializeManifest(buildManifest(generateDudulemonDataset()));

    expect(regenerated).toBe(committed);
  });

  test("every table is pinned and non-empty", () => {
    const manifest = buildManifest(generateDudulemonDataset());

    expect(manifest.tables.map((table) => table.name)).toEqual([...FIXTURE_TABLE_NAMES]);
    for (const table of manifest.tables) {
      expect(table.row_count).toBeGreaterThan(0);
      expect(table.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
  });

  test("the manifest pins the fixture clock, the template and the growth lead", async () => {
    const committed = parseManifest(await readFile(resolve(MANIFEST_RELATIVE_PATH), "utf8"));

    expect(committed.fixture_clock).toBe("2026-09-14T09:00:00Z");
    expect(committed.environment_template.application_port).toBe(3300);
    expect(committed.environment_template.postgres_major_version).toBe(17);
    expect(committed.identity.growth_lead.email).toBe("maya@dudulemon.example.com");
    expect(committed.identity.account.name).toBe("Dudulemon");
  });

  test("a changed dataset is refused rather than installed", () => {
    const manifest = buildManifest(generateDudulemonDataset());
    const drifted = {
      ...manifest,
      content_hash: `sha256:${"0".repeat(64)}`,
      tables: manifest.tables.map((table) =>
        table.name === "customer_reviews" ? { ...table, row_count: table.row_count + 1 } : table,
      ),
    };

    expect(() => assertManifestsMatch(manifest, drifted)).toThrowError(
      /customer_reviews: expected \d+ rows/u,
    );
  });

  test("the dataset carries the properties the demo depends on", () => {
    const invariants = assertFixtureInvariants(generateDudulemonDataset());

    expect(invariants.canonicalReviewsInsideWindow).toBeGreaterThanOrEqual(20);
    expect(invariants.canonicalReviewsOutsideWindow).toBeGreaterThanOrEqual(10);
    expect(invariants.nearMissChannelReviews).toBeGreaterThan(0);
    expect(invariants.nearMissSegmentReviews).toBeGreaterThan(0);
    expect(invariants.nearMissTopicReviews).toBeGreaterThan(0);
    expect(invariants.nearMissSentimentReviews).toBeGreaterThan(0);
    expect(invariants.canonicalConversionRateRecent).toBeLessThan(
      invariants.canonicalConversionRatePrior * 0.7,
    );
  });
});
