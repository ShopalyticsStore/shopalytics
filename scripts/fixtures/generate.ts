/**
 * Regenerates `fixtures/dudulemon/manifest.json`.
 *
 * Usage:
 *   npm run fixture:generate            write the manifest
 *   npm run fixture:generate -- --check fail if the committed manifest is stale
 *
 * Generation is deterministic, so a clean checkout that runs this command
 * produces the same bytes that are committed.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { generateDudulemonDataset } from "../../src/lib/fixture/dataset";
import { assertFixtureInvariants } from "../../src/lib/fixture/invariants";
import {
  MANIFEST_RELATIVE_PATH,
  buildManifest,
  serializeManifest,
} from "../../src/lib/fixture/manifest";

async function main(): Promise<void> {
  const checkOnly = process.argv.includes("--check");
  const dataset = generateDudulemonDataset();
  const invariants = assertFixtureInvariants(dataset);
  const manifest = buildManifest(dataset);
  const document = serializeManifest(manifest);
  const path = resolve(MANIFEST_RELATIVE_PATH);

  if (checkOnly) {
    const existing = await readFile(path, "utf8");
    if (existing !== document) {
      throw new Error(
        `${MANIFEST_RELATIVE_PATH} is stale. Run "npm run fixture:generate" and commit the result.`,
      );
    }
    console.log(`${MANIFEST_RELATIVE_PATH} is current (${manifest.content_hash}).`);
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, document, "utf8");

  console.log(`wrote ${MANIFEST_RELATIVE_PATH}`);
  console.log(`  manifest hash      ${manifest.content_hash}`);
  console.log(`  fixture clock      ${manifest.fixture_clock}`);
  for (const table of manifest.tables) {
    console.log(`  ${table.name.padEnd(26)} ${String(table.row_count).padStart(7)} rows`);
  }
  console.log(
    `  canonical reviews  ${invariants.canonicalReviewsInsideWindow} inside / ${invariants.canonicalReviewsOutsideWindow} outside Last 30 days`,
  );
  console.log(
    `  canonical CVR      ${(invariants.canonicalConversionRateRecent * 100).toFixed(2)}% recent vs ${(invariants.canonicalConversionRatePrior * 100).toFixed(2)}% prior`,
  );
}

await main();
