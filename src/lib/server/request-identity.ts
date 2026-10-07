/**
 * Who is asking.
 *
 * In the production profile Shopalytics serves its own signed-in staff and the
 * fixture's seeded growth lead stands in for them, by email, so no uTrace
 * session is involved. In the preview profile the only way in is the uTrace preview
 * handoff: a request without a valid session cookie is refused rather than
 * quietly served as the seeded user, because an unauthenticated preview must
 * not look like an authenticated one in the evidence.
 */

import { cookies } from "next/headers";

import { GROWTH_LEAD } from "@/lib/fixture/definition";
import { isPreviewProfile } from "@/lib/utrace/profile";
import { PREVIEW_HANDOFF_SECRET_ENV_NAME } from "@/lib/utrace/preview-handoff";
import { PREVIEW_SESSION_COOKIE_NAME, readPreviewSessionCookie } from "./preview-session";
import type { DashboardContext } from "@/lib/db/types";

export type RequestIdentity = Readonly<{
  /** The signed-in user's email; their account is the only one a request reads. */
  email: string;
  authenticatedVia: DashboardContext["authenticatedVia"];
}>;

export class UnauthenticatedPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthenticatedPreviewError";
  }
}

export async function resolveRequestIdentity(now: Date): Promise<RequestIdentity> {
  if (!isPreviewProfile(process.env)) {
    return { email: GROWTH_LEAD.email, authenticatedVia: "production_profile" };
  }

  const secret = process.env[PREVIEW_HANDOFF_SECRET_ENV_NAME];
  if (secret === undefined || secret === "") {
    throw new Error(
      `${PREVIEW_HANDOFF_SECRET_ENV_NAME} is required in the preview profile but is not set.`,
    );
  }

  const cookieValue = (await cookies()).get(PREVIEW_SESSION_COOKIE_NAME)?.value;
  if (cookieValue === undefined) {
    throw new UnauthenticatedPreviewError(
      "this preview has no uTrace session; complete the preview handoff first.",
    );
  }

  try {
    const claims = await readPreviewSessionCookie(cookieValue, secret, now);
    return { email: claims.email, authenticatedVia: "preview_handoff" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new UnauthenticatedPreviewError(`the uTrace preview session is not usable: ${reason}`);
  }
}
