/**
 * Preview authentication handoff. Preview profile only.
 *
 * `POST /api/utrace/preview-handoff` with `{ "token": "v1.<claims>.<sig>" }`
 * exchanges a one-time uTrace handoff token for the Dudulemon growth lead's
 * application session. `src/lib/utrace/preview-handoff.ts` documents the token
 * format and the rules; `src/lib/server/preview-session.ts` documents the
 * session cookie this route sets.
 *
 * Single use is enforced by inserting the token's `token_id` into
 * `utrace_preview_handoff_consumption`. The primary key makes a second
 * presentation a unique-violation, which means a replay loses the race even
 * across concurrent requests and process restarts, not merely within one
 * process's memory.
 *
 * The token's audience is checked against the session origin `src/proxy.ts`
 * verified from the route context, for the reason documented in
 * `src/lib/server/utrace-route-context.ts`: the transport `Host` is the Vercel
 * Sandbox port host, not the origin the token is bound to. A request without a
 * verified origin did not pass the route gate and is refused.
 *
 * In the production profile this route does not exist and answers 404: a
 * production build carries no uTrace runtime surface.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { queryRows } from "@/lib/server/db";
import { createPreviewSessionCookie } from "@/lib/server/preview-session";
import { VERIFIED_PUBLIC_HOST_HEADER } from "@/lib/server/utrace-route-context";
import { findUserByEmail } from "@/lib/server/shopalytics";
import {
  PREVIEW_HANDOFF_SECRET_ENV_NAME,
  PreviewHandoffError,
  verifyPreviewHandoffToken,
} from "@/lib/utrace/preview-handoff";
import { isPreviewProfile } from "@/lib/utrace/profile";

export const dynamic = "force-dynamic";

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/** Where the growth lead lands after a successful handoff. */
export const HANDOFF_LANDING_PATH = "/app/conversion";

const requestSchema = z.object({ token: z.string().min(1) }).strict();

function refuse(status: number, reason: string, message: string): NextResponse {
  return NextResponse.json(
    { state: "refused", reason, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isPreviewProfile(process.env)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const secret = process.env[PREVIEW_HANDOFF_SECRET_ENV_NAME];
  if (secret === undefined || secret === "") {
    return NextResponse.json(
      { error: `${PREVIEW_HANDOFF_SECRET_ENV_NAME} is not set in this preview runtime.` },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "malformed", "the request body must be JSON containing a token");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return refuse(400, "malformed", "the request body must contain a non-empty token");
  }

  const sessionHost = request.headers.get(VERIFIED_PUBLIC_HOST_HEADER);
  if (sessionHost === null) {
    return refuse(
      400,
      "audience",
      `the request has no ${VERIFIED_PUBLIC_HOST_HEADER} header, so it did not pass the preview route gate`,
    );
  }

  const now = new Date();
  try {
    const claims = await verifyPreviewHandoffToken(parsed.data.token, secret, sessionHost, now);

    const user = await findUserByEmail(claims.subject_email);
    if (user === null) {
      return refuse(
        403,
        "malformed",
        `no seeded Dudulemon user matches "${claims.subject_email}"; this runtime holds a different dataset`,
      );
    }

    try {
      await queryRows(
        `INSERT INTO utrace_preview_handoff_consumption (token_id, subject_user_id, expires_at)
         VALUES ($1::uuid, $2::uuid, $3::timestamptz)`,
        [claims.token_id, user.id, claims.expires_at],
      );
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        const { code } = error as { code?: string };
        if (code === UNIQUE_VIOLATION) {
          return refuse(
            401,
            "replayed",
            `preview handoff token ${claims.token_id} has already been used`,
          );
        }
      }
      throw error;
    }

    // Every preview origin is HTTPS (`.dev` is HSTS-preloaded), and the door
    // reports the public scheme it terminated.
    const cookie = await createPreviewSessionCookie(
      user,
      secret,
      now,
      request.headers.get("x-forwarded-proto") !== "http",
    );
    const response = NextResponse.json(
      {
        state: "signed_in",
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        redirect_to: HANDOFF_LANDING_PATH,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    if (error instanceof PreviewHandoffError) {
      const status = error.reason === "malformed" ? 400 : 401;
      return refuse(status, error.reason, error.message);
    }
    const message = error instanceof Error ? error.message : "the preview handoff failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
