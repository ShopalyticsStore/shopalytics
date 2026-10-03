/**
 * The preview authentication handoff.
 *
 * uTrace opens the seeded preview for the invited originating user. The session
 * tab requests a one-time handoff, and the preview exchanges it for an
 * application session. This module owns the token format and its verification;
 * it deliberately knows nothing about databases or cookies, so the rules can be
 * exercised without either.
 *
 * Token format (`POST /api/utrace/preview-handoff`, field `token`):
 *
 *   v1.<base64url(claims)>.<base64url(HMAC-SHA256(claims))>
 *
 *   claims = {
 *     schema_version: "shopalytics-preview-handoff-v1",
 *     token_id:       uuid,     single-use key, recorded on consumption
 *     subject_email:  string,   the Dudulemon user to sign in
 *     audience:       string,   the preview host the token may be used on
 *     issued_at:      RFC 3339,
 *     expires_at:     RFC 3339
 *   }
 *
 * signed with `UTRACE_PREVIEW_HANDOFF_SECRET`, which the preview runtime
 * receives at start-up and never stores in the repository.
 *
 * Verification requires all of: a valid signature, the declared schema version,
 * an audience equal to the request host, an `issued_at` no further in the
 * future than the tolerated skew, an unexpired `expires_at`, and a lifetime no
 * longer than `MAXIMUM_HANDOFF_LIFETIME_MS`. Single use is enforced separately,
 * by recording `token_id`, because it needs durable state.
 */

import { z } from "zod";

import { openToken, signToken } from "./signing";

export const PREVIEW_HANDOFF_SECRET_ENV_NAME = "UTRACE_PREVIEW_HANDOFF_SECRET";
export const PREVIEW_HANDOFF_TOKEN_VERSION = "v1";
export const PREVIEW_HANDOFF_SCHEMA_VERSION = "shopalytics-preview-handoff-v1";

/** Tolerated clock skew between the uTrace control plane and this runtime. */
export const HANDOFF_ISSUED_AT_SKEW_MS = 30_000;

/** A handoff is a few seconds of authority, not a session. */
export const MAXIMUM_HANDOFF_LIFETIME_MS = 120_000;

const handoffClaimsSchema = z
  .object({
    schema_version: z.literal(PREVIEW_HANDOFF_SCHEMA_VERSION),
    token_id: z.string().uuid(),
    subject_email: z.string().email(),
    audience: z.string().min(1),
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type PreviewHandoffClaims = z.infer<typeof handoffClaimsSchema>;

/** Why a handoff was refused. The route maps these to a status code. */
export type PreviewHandoffFailureReason =
  "malformed" | "signature" | "audience" | "expired" | "lifetime" | "not_yet_valid" | "replayed";

export class PreviewHandoffError extends Error {
  readonly reason: PreviewHandoffFailureReason;

  constructor(reason: PreviewHandoffFailureReason, message: string) {
    super(message);
    this.name = "PreviewHandoffError";
    this.reason = reason;
  }
}

/**
 * Issues a token. uTrace signs handoffs in its own control plane; this exists
 * so the runtime's contract is executable and testable from this repository.
 */
export function signPreviewHandoffToken(
  claims: PreviewHandoffClaims,
  secret: string,
): Promise<string> {
  const validated = handoffClaimsSchema.parse(claims);
  return signToken(PREVIEW_HANDOFF_TOKEN_VERSION, validated, secret);
}

function normalizeHost(value: string): string {
  return new URL(`https://${value}`).host.toLowerCase();
}

/** Verifies everything except single use. Throws `PreviewHandoffError`. */
export async function verifyPreviewHandoffToken(
  token: string,
  secret: string,
  requestHost: string,
  now: Date,
): Promise<PreviewHandoffClaims> {
  let payload: unknown;
  try {
    payload = await openToken(token, PREVIEW_HANDOFF_TOKEN_VERSION, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PreviewHandoffError(
      message === "token signature does not match" ? "signature" : "malformed",
      `preview handoff token was rejected: ${message}`,
    );
  }

  const parsed = handoffClaimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PreviewHandoffError(
      "malformed",
      `preview handoff claims are invalid: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")} ${issue.message}`)
        .join("; ")}`,
    );
  }
  const claims = parsed.data;

  let audienceMatches: boolean;
  try {
    audienceMatches = normalizeHost(claims.audience) === normalizeHost(requestHost);
  } catch {
    throw new PreviewHandoffError(
      "audience",
      `preview handoff audience "${claims.audience}" or request host "${requestHost}" is not a host`,
    );
  }
  if (!audienceMatches) {
    throw new PreviewHandoffError(
      "audience",
      `preview handoff token is bound to "${claims.audience}" but was presented to "${requestHost}"`,
    );
  }

  const issuedAt = new Date(claims.issued_at).getTime();
  const expiresAt = new Date(claims.expires_at).getTime();
  if (issuedAt > now.getTime() + HANDOFF_ISSUED_AT_SKEW_MS) {
    throw new PreviewHandoffError(
      "not_yet_valid",
      `preview handoff token is issued at ${claims.issued_at}, later than this runtime's clock`,
    );
  }
  if (expiresAt - issuedAt > MAXIMUM_HANDOFF_LIFETIME_MS) {
    throw new PreviewHandoffError(
      "lifetime",
      `preview handoff lifetime ${expiresAt - issuedAt}ms exceeds the maximum ${MAXIMUM_HANDOFF_LIFETIME_MS}ms`,
    );
  }
  if (expiresAt <= now.getTime()) {
    throw new PreviewHandoffError(
      "expired",
      `preview handoff token expired at ${claims.expires_at}`,
    );
  }

  return claims;
}
