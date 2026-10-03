import { NextRequest } from "next/server";
import { afterEach, describe, expect, test } from "vitest";

import { proxy } from "@/proxy";
import { signToken } from "@/lib/utrace/signing";

const SECRET = "route-signing-secret-under-test";
const SESSION_ORIGIN = "a1b2c3.preview.utrace.dev";
const SANDBOX_HOST = "sb-3kzofdocan9x.vercel.run";

function claims(host: string, now: Date): Record<string, unknown> {
  return {
    schema_version: "utrace_preview_route_v1",
    preview_route_id: "019c0000-0000-7000-8000-000000000001",
    client_id: "019c0000-0000-7000-8000-000000000002",
    product_signal_id: "019c0000-0000-7000-8000-000000000003",
    preview_version_id: "019c0000-0000-7000-8000-000000000004",
    preview_runtime_allocation_id: "019c0000-0000-7000-8000-000000000005",
    public_preview_host: host,
    route_revision: 3,
    issued_at: new Date(now.getTime() - 5_000).toISOString(),
    expires_at: new Date(now.getTime() + 55_000).toISOString(),
  };
}

function requestWith(headers: Record<string, string>): NextRequest {
  return new NextRequest(`https://${SANDBOX_HOST}/app/conversion`, { headers });
}

afterEach(() => {
  delete process.env.UTRACE_PROFILE;
  delete process.env.UTRACE_PREVIEW_ROUTE_SIGNING_SECRET;
});

describe("the preview front-door proxy", () => {
  test("the production profile has no route context to enforce", async () => {
    process.env.UTRACE_PROFILE = "production";

    const response = await proxy(requestWith({ host: "shopalytics.example.com" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  test("the preview profile hands the application the session origin from the claim", async () => {
    process.env.UTRACE_PROFILE = "preview";
    process.env.UTRACE_PREVIEW_ROUTE_SIGNING_SECRET = SECRET;
    const now = new Date();
    const token = await signToken("v1", claims(SESSION_ORIGIN, now), SECRET);

    // The sandbox port proxy sets both Host and x-forwarded-host to its own host.
    const response = await proxy(
      requestWith({
        host: SANDBOX_HOST,
        "x-forwarded-host": SANDBOX_HOST,
        "x-forwarded-proto": "https",
        "x-utrace-route-context": token,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-utrace-verified-public-host")).toBe(
      SESSION_ORIGIN,
    );
  });

  test("a refusal names the claim a front door and this runtime disagree about", async () => {
    process.env.UTRACE_PROFILE = "preview";
    process.env.UTRACE_PREVIEW_ROUTE_SIGNING_SECRET = SECRET;
    const now = new Date();
    const token = await signToken(
      "v1",
      { ...claims(SESSION_ORIGIN, now), schema_version: "utrace-preview-route-v1" },
      SECRET,
    );

    const response = await proxy(
      requestWith({
        host: SANDBOX_HOST,
        "x-utrace-route-context": token,
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      state: "unavailable",
      refusal: "claims",
      claim: "schema_version",
    });
  });

  test("a request without a route context is refused", async () => {
    process.env.UTRACE_PROFILE = "preview";
    process.env.UTRACE_PREVIEW_ROUTE_SIGNING_SECRET = SECRET;

    const response = await proxy(requestWith({ host: SANDBOX_HOST }));

    expect(response.status).toBe(401);
    expect(response.headers.get("x-utrace-preview-gate")).toBe("no_route_context");
  });

  test("an unknown profile value is a configuration error", async () => {
    process.env.UTRACE_PROFILE = "staging";

    await expect(proxy(requestWith({ host: SANDBOX_HOST }))).rejects.toThrow(/UTRACE_PROFILE/u);
  });
});
