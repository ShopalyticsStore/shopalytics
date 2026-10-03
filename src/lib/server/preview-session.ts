/**
 * The application session the preview handoff establishes.
 *
 * A successful handoff signs in the Dudulemon growth lead by setting one
 * signed, HttpOnly, host-bound cookie. The product has no password login in the
 * preview: the invited user arrives through uTrace or not at all.
 *
 * Cookie format (`shopalytics_preview_session`):
 *
 *   v1.<base64url(claims)>.<base64url(HMAC-SHA256(claims))>
 *
 *   claims = {
 *     schema_version: "shopalytics-preview-session-v1",
 *     user_id:    uuid,     the signed-in Dudulemon user
 *     email:      string,
 *     issued_at:  RFC 3339,
 *     expires_at: RFC 3339
 *   }
 *
 * It is signed with the same `UTRACE_PREVIEW_HANDOFF_SECRET` the runtime
 * receives at start-up, so a preview runtime holds exactly one session secret
 * and tearing the runtime down invalidates every session it issued.
 */

import { z } from "zod";

import { openToken, signToken } from "@/lib/utrace/signing";

export const PREVIEW_SESSION_COOKIE_NAME = "shopalytics_preview_session";
export const PREVIEW_SESSION_TOKEN_VERSION = "v1";
export const PREVIEW_SESSION_SCHEMA_VERSION = "shopalytics-preview-session-v1";

/** How long one handoff keeps the growth lead signed in. */
export const PREVIEW_SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const sessionClaimsSchema = z
  .object({
    schema_version: z.literal(PREVIEW_SESSION_SCHEMA_VERSION),
    user_id: z.string().uuid(),
    email: z.string().email(),
    issued_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type PreviewSessionClaims = z.infer<typeof sessionClaimsSchema>;

export type PreviewSessionCookie = Readonly<{
  name: string;
  value: string;
  options: Readonly<{
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  }>;
}>;

/** Mints the session cookie for a user. */
export async function createPreviewSessionCookie(
  user: Readonly<{ id: string; email: string }>,
  secret: string,
  now: Date,
  secure: boolean,
): Promise<PreviewSessionCookie> {
  const claims: PreviewSessionClaims = sessionClaimsSchema.parse({
    schema_version: PREVIEW_SESSION_SCHEMA_VERSION,
    user_id: user.id,
    email: user.email,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + PREVIEW_SESSION_LIFETIME_MS).toISOString(),
  });
  const value = await signToken(PREVIEW_SESSION_TOKEN_VERSION, claims, secret);
  return Object.freeze({
    name: PREVIEW_SESSION_COOKIE_NAME,
    value,
    options: Object.freeze({
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(PREVIEW_SESSION_LIFETIME_MS / 1000),
    } as const),
  });
}

/** Verifies a session cookie value, throwing when it cannot be trusted. */
export async function readPreviewSessionCookie(
  value: string,
  secret: string,
  now: Date,
): Promise<PreviewSessionClaims> {
  const payload = await openToken(value, PREVIEW_SESSION_TOKEN_VERSION, secret);
  const claims = sessionClaimsSchema.parse(payload);
  if (new Date(claims.expires_at).getTime() <= now.getTime()) {
    throw new Error(`preview session expired at ${claims.expires_at}`);
  }
  return claims;
}
