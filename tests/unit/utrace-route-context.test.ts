import { describe, expect, test } from "vitest";

import { verifyUTraceRouteContext } from "@/lib/server/utrace-route-context";
import { signToken } from "@/lib/utrace/signing";

const SECRET = "shopalytics-demo-route-signing-secret";
const NOW = new Date("2026-09-14T09:00:00Z");

function routeContextClaims(host: string): Record<string, unknown> {
  return {
    schema_version: "utrace_preview_route_v1",
    preview_route_id: "019c0000-0000-7000-8000-000000000001",
    client_id: "019c0000-0000-7000-8000-000000000002",
    product_signal_id: "019c0000-0000-7000-8000-000000000003",
    preview_version_id: "019c0000-0000-7000-8000-000000000004",
    preview_runtime_allocation_id: "019c0000-0000-7000-8000-000000000005",
    public_preview_host: host,
    route_revision: 1,
    issued_at: "2026-09-14T08:59:55.000Z",
    expires_at: "2026-09-14T09:00:55.000Z",
  };
}

describe("the uTrace route context", () => {
  test("accepts a current signed token and returns its session origin", async () => {
    const token = await signToken("v1", routeContextClaims("preview.shopalytics.test"), SECRET);

    const claims = await verifyUTraceRouteContext(token, SECRET, NOW);

    expect(claims.route_revision).toBe(1);
    expect(claims.public_preview_host).toBe("preview.shopalytics.test");
    expect(claims.preview_version_id).toBe("019c0000-0000-7000-8000-000000000004");
  });

  test("rejects an expired route context", async () => {
    const token = await signToken("v1", routeContextClaims("preview.shopalytics.test"), SECRET);

    await expect(
      verifyUTraceRouteContext(token, SECRET, new Date("2026-09-14T09:01:00Z")),
    ).rejects.toThrow("route context refused: expired");
  });

  test("rejects a token signed with another secret", async () => {
    const token = await signToken("v1", routeContextClaims("preview.shopalytics.test"), "other");

    await expect(verifyUTraceRouteContext(token, SECRET, NOW)).rejects.toThrow(
      "route context refused: token",
    );
  });

  test("names the claim a token from another schema version fails on", async () => {
    const token = await signToken(
      "v1",
      {
        ...routeContextClaims("preview.shopalytics.test"),
        schema_version: "utrace-preview-route-v1",
      },
      SECRET,
    );

    await expect(verifyUTraceRouteContext(token, SECRET, NOW)).rejects.toThrow(
      "route context refused: claims (schema_version)",
    );
  });
});
