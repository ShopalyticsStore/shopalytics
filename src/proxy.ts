/**
 * Preview front-door enforcement.
 *
 * In the preview profile every request must carry a current, correctly signed
 * `x-utrace-route-context`, so a leaked Vercel Sandbox port URL or a stale route
 * revision cannot reach the product. The verified identity, including the
 * session origin from the `public_preview_host` claim, is forwarded to the
 * application as `x-utrace-verified-*` headers, and the caller-supplied context
 * header is removed so nothing downstream can trust an unverified value.
 *
 * Neither `Host` nor `x-forwarded-host` names the session origin: the Vercel
 * Sandbox port proxy sets both to its own `vercel.run` host.
 *
 * In the production profile there is no uTrace front door and no route context,
 * so this proxy passes requests through untouched.
 */

import { type NextRequest, NextResponse } from "next/server";

import {
  ROUTE_CONTEXT_HEADER,
  ROUTE_CONTEXT_SIGNING_SECRET_ENV_NAME,
  type RouteContextRefusal,
  RouteContextRefused,
  VERIFIED_PUBLIC_HOST_HEADER,
  verifyUTraceRouteContext,
} from "@/lib/server/utrace-route-context";
import { UTRACE_PROFILE_ENV_NAME, resolveUTraceProfile } from "@/lib/utrace/profile";

/** The refusal reason this gate puts on every 401 it makes. */
export const PREVIEW_GATE_HEADER = "x-utrace-preview-gate";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (resolveUTraceProfile(process.env[UTRACE_PROFILE_ENV_NAME]) === "production") {
    return NextResponse.next();
  }

  const signingSecret = process.env[ROUTE_CONTEXT_SIGNING_SECRET_ENV_NAME];
  const token = request.headers.get(ROUTE_CONTEXT_HEADER);
  if (!signingSecret) {
    return unavailable("no_signing_secret", null);
  }
  if (!token) {
    return unavailable("no_route_context", null);
  }
  try {
    const claims = await verifyUTraceRouteContext(token, signingSecret, new Date());
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(ROUTE_CONTEXT_HEADER);
    requestHeaders.set("x-utrace-verified-preview-route-id", claims.preview_route_id);
    requestHeaders.set("x-utrace-verified-preview-version-id", claims.preview_version_id);
    requestHeaders.set(VERIFIED_PUBLIC_HOST_HEADER, claims.public_preview_host);
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (error) {
    if (error instanceof RouteContextRefused) {
      return unavailable(error.refusal, error.claim);
    }
    // Nothing else in the verifier throws.
    return unavailable("unreadable", null);
  }
}

/**
 * The refusal names its own reason, on the response and in its body.
 *
 * The reason is a closed set of configuration and envelope faults that a caller
 * could already infer by probing, and withholding it costs far more than it
 * protects: an operator reading a preview readiness record otherwise sees only
 * `401` and cannot tell a provider hop from this gate, let alone a clock skew
 * from a claim set the front door and this runtime disagree about.
 */
function unavailable(refusal: RouteContextRefusal, claim: string | null): NextResponse {
  return NextResponse.json(
    { state: "unavailable", refusal, claim },
    {
      status: 401,
      headers: { "Cache-Control": "no-store", [PREVIEW_GATE_HEADER]: refusal },
    },
  );
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
