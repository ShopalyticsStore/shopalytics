/**
 * Runtime verification of the uTrace preview route context.
 *
 * The uTrace preview front door strips caller-supplied routing headers and adds
 * its own short-lived signed context before forwarding a request to this
 * runtime. `src/proxy.ts` verifies it on every request, so a leaked upstream
 * URL or a stale route revision cannot reach the product. The signing secret
 * belongs to this one runtime, so a context minted for another runtime fails
 * the signature check outright.
 *
 * The session origin comes from the verified `public_preview_host` claim, never
 * from a forwarded header: the Vercel Sandbox port proxy replaces
 * `x-forwarded-host` with its own `vercel.run` host, while custom headers such as
 * this one pass through unchanged.
 *
 * Token format (`x-utrace-route-context`):
 *   `v1.<base64url(claims)>.<base64url(HMAC-SHA256(claims))>`
 * signed with `UTRACE_PREVIEW_ROUTE_SIGNING_SECRET`. The claim set is
 * `utrace_preview_route_v1`, defined below. Every uTrace envelope
 * discriminator is snake_case, so the claim set is spelled that way here too.
 * The fixture work did not change any
 * field; a field change requires a new `schema_version` and a new token version
 * so an old front door cannot be mistaken for a current one.
 */

import { z } from "zod";

import { openToken } from "@/lib/utrace/signing";

export const ROUTE_CONTEXT_HEADER = "x-utrace-route-context";

/**
 * The verified session origin `src/proxy.ts` hands the application, taken from
 * the route context's `public_preview_host` claim.
 */
export const VERIFIED_PUBLIC_HOST_HEADER = "x-utrace-verified-public-host";
export const ROUTE_CONTEXT_TOKEN_VERSION = "v1";
export const ROUTE_CONTEXT_SIGNING_SECRET_ENV_NAME = "UTRACE_PREVIEW_ROUTE_SIGNING_SECRET";

/**
 * Why a request was refused. The values are a closed set of configuration and
 * envelope faults and carry no request, claim or product value, so `src/proxy.ts`
 * can put the reason on the refusal itself. A refusal that reaches a caller
 * without one was made before the request ever arrived here.
 */
export type RouteContextRefusal =
  | "no_signing_secret"
  | "no_route_context"
  | "token"
  | "claims"
  | "issued_in_future"
  | "expired"
  | "unreadable";

/** A refusal that names what was wrong instead of collapsing every fault into one. */
export class RouteContextRefused extends Error {
  readonly refusal: RouteContextRefusal;
  /** The first claim that failed the schema, for a `claims` refusal. */
  readonly claim: string | null;

  constructor(refusal: RouteContextRefusal, claim: string | null) {
    super(
      claim === null
        ? `route context refused: ${refusal}`
        : `route context refused: ${refusal} (${claim})`,
    );
    this.name = "RouteContextRefused";
    this.refusal = refusal;
    this.claim = claim;
  }
}

/** Tolerated clock skew between the front door and this runtime. */
const ISSUED_AT_SKEW_MS = 30_000;

const routeContextSchema = z
  .object({
    schema_version: z.literal("utrace_preview_route_v1"),
    preview_route_id: z.string().uuid(),
    client_id: z.string().uuid(),
    product_signal_id: z.string().uuid(),
    preview_version_id: z.string().uuid(),
    preview_runtime_allocation_id: z.string().uuid(),
    public_preview_host: z.string().min(1),
    route_revision: z.number().int().positive(),
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type UTraceRouteContext = z.infer<typeof routeContextSchema>;

/**
 * Every rejection is a `RouteContextRefused` naming the fault. A front door and
 * a runtime that disagree about the envelope, the claim set or the clock are
 * indistinguishable from an attacker at the status code alone, and a refusal
 * that cannot say which one it was costs an operator the whole diagnosis.
 */
export async function verifyUTraceRouteContext(
  token: string,
  signingSecret: string,
  now: Date,
): Promise<UTraceRouteContext> {
  let payload: unknown;
  try {
    payload = await openToken(token, ROUTE_CONTEXT_TOKEN_VERSION, signingSecret);
  } catch {
    throw new RouteContextRefused("token", null);
  }
  const parsed = routeContextSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new RouteContextRefused("claims", issue === undefined ? null : issue.path.join("."));
  }
  const claims = parsed.data;
  if (new Date(claims.issued_at).getTime() > now.getTime() + ISSUED_AT_SKEW_MS) {
    throw new RouteContextRefused("issued_in_future", null);
  }
  if (new Date(claims.expires_at).getTime() <= now.getTime()) {
    throw new RouteContextRefused("expired", null);
  }
  return claims;
}
