/**
 * The startup and readiness contract.
 *
 * `GET /api/health` is the only route the preview front door reaches without a
 * route context, so uTrace can probe a runtime before routing traffic to it. It
 * answers 200 only when the database is reachable and holds the fixture
 * manifest the runtime was built for; anything else is 503 with the reason.
 *
 * `manifest.matches_build` is what proves a candidate runtime was seeded with
 * the same approved dataset identity as the base runtime.
 */

import { NextResponse } from "next/server";

import { queryRows } from "@/lib/server/db";
import { FIXTURE_CLOCK_ENV_NAME, resolveFixtureClock } from "@/lib/fixture/clock";
import { FIXTURE_ID } from "@/lib/fixture/definition";
import { resolveUTraceProfile, UTRACE_PROFILE_ENV_NAME } from "@/lib/utrace/profile";

export const dynamic = "force-dynamic";

/** Written into the image so the runtime can report what it was built from. */
const BUILD_MANIFEST_HASH_ENV_NAME = "SHOPALYTICS_FIXTURE_MANIFEST_HASH";

type InstalledManifestRow = {
  fixture_id: string;
  schema_version: string;
  content_hash: string;
  fixture_clock: string;
  seed_target: string;
  installed_at: Date;
};

export async function GET(): Promise<NextResponse> {
  const buildHash = process.env[BUILD_MANIFEST_HASH_ENV_NAME] ?? null;
  const profile = resolveUTraceProfile(process.env[UTRACE_PROFILE_ENV_NAME]);
  const clock = resolveFixtureClock(process.env[FIXTURE_CLOCK_ENV_NAME]);

  try {
    const rows = await queryRows<InstalledManifestRow>(
      `SELECT fixture_id, schema_version, content_hash, fixture_clock, seed_target, installed_at
       FROM fixture_manifest`,
      [],
    );
    const installed = rows[0];
    if (installed === undefined) {
      return unhealthy("the database is reachable but holds no seeded fixture manifest", {
        profile,
        buildHash,
        reachable: true,
      });
    }
    if (installed.fixture_id !== FIXTURE_ID) {
      return unhealthy(
        `the database holds fixture "${installed.fixture_id}", this build expects "${FIXTURE_ID}"`,
        { profile, buildHash, reachable: true },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        profile,
        database: { reachable: true },
        fixture_clock: clock === null ? null : clock.toISOString(),
        manifest: {
          fixture_id: installed.fixture_id,
          schema_version: installed.schema_version,
          content_hash: installed.content_hash,
          fixture_clock: installed.fixture_clock,
          seed_target: installed.seed_target,
          installed_at: installed.installed_at.toISOString(),
          build_content_hash: buildHash,
          matches_build: buildHash === null ? null : buildHash === installed.content_hash,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return unhealthy(`the database is not ready: ${message}`, {
      profile,
      buildHash,
      reachable: false,
    });
  }
}

function unhealthy(
  reason: string,
  context: Readonly<{ profile: string; buildHash: string | null; reachable: boolean }>,
): NextResponse {
  return NextResponse.json(
    {
      status: "unhealthy",
      profile: context.profile,
      database: { reachable: context.reachable },
      manifest: { build_content_hash: context.buildHash, matches_build: false },
      reason,
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
