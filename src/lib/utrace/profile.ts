/**
 * uTrace runtime profiles.
 *
 * The same source revision supports two profiles, as
 * `docs/arch-components/onboarding.md` requires:
 *
 *   production  no uTrace runtime code, no startup hooks, no preview routes.
 *   preview     the browser bootstrap loads before hydration and the server
 *               SDK preload runs before backend modules.
 *
 * `NEXT_PUBLIC_UTRACE_PROFILE` selects one. It is read at build time (the
 * browser gate is part of the client bundle) and `UTRACE_PROFILE` is read at
 * start-up (the server preload runs from `utrace/preload.mjs` through
 * `node --import`), so a preview image must be built and started with the same
 * value.
 *
 * An unset variable resolves to `production`: the profile without any uTrace
 * runtime is the only safe default, and preview instrumentation must always be
 * asked for explicitly. Any other value is a configuration error and throws.
 */

export const UTRACE_PROFILE_ENV_NAME = "UTRACE_PROFILE";

/**
 * The same profile, readable from a client component. Next.js inlines
 * `NEXT_PUBLIC_*` at build time, which is what makes the production bundle
 * exclude the runtime rather than merely not start it.
 */
export const UTRACE_PUBLIC_PROFILE_ENV_NAME = "NEXT_PUBLIC_UTRACE_PROFILE";

/**
 * The public SDK installation id this release was integrated under. It carries
 * no secret and no identity: every other identity arrives inside the signed
 * document attestation.
 */
export const UTRACE_SDK_INSTALLATION_ID_ENV_NAME = "NEXT_PUBLIC_UTRACE_SDK_INSTALLATION_ID";

/** The Shopalytics release the signed annotation manifest was compiled for. */
export const UTRACE_CLIENT_RELEASE_ID_ENV_NAME = "NEXT_PUBLIC_UTRACE_CLIENT_RELEASE_ID";

export type UTraceProfile = "preview" | "production";

const PROFILES: readonly UTraceProfile[] = ["preview", "production"];

/** Resolves the configured profile, throwing on an unrecognised value. */
export function resolveUTraceProfile(rawValue: string | undefined): UTraceProfile {
  if (rawValue === undefined || rawValue.trim() === "") {
    return "production";
  }
  const profile = PROFILES.find((candidate) => candidate === rawValue.trim());
  if (profile === undefined) {
    throw new Error(
      `${UTRACE_PROFILE_ENV_NAME} must be one of ${PROFILES.join(", ")}, received "${rawValue}".`,
    );
  }
  return profile;
}

/** True when preview-only surfaces, such as the handoff route, are active. */
export function isPreviewProfile(env: NodeJS.ProcessEnv): boolean {
  return resolveUTraceProfile(env[UTRACE_PROFILE_ENV_NAME]) === "preview";
}
