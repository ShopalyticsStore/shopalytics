/**
 * The server-side uTrace extension point.
 *
 * `npm run start:preview` runs Next.js as
 * `node --import ./utrace/preload.mjs node_modules/next/dist/bin/next start`,
 * so this module is evaluated before any application or framework module is
 * loaded. That ordering is what `docs/arch-components/server-sdk.md` requires:
 * uTrace owns the OpenTelemetry provider, context manager, propagator and
 * instrumentation set, and it can only do that if it installs its hooks first.
 *
 * In the production profile this file loads nothing, so a production start-up
 * receives no preload, no exporter and no control connection. In the preview
 * profile it imports `@utrace/server-sdk/preload`, which reads its own
 * configuration (the one-time bootstrap credential and activation identity)
 * from the prepared-preview environment. A missing package is a hard failure:
 * a preview that starts without instrumentation cannot become ready, so it must
 * not start at all.
 */

const PROFILE_ENV_NAME = "UTRACE_PROFILE";
const SERVER_SDK_PRELOAD_SPECIFIER = "@utrace/server-sdk/preload";

const rawProfile = process.env[PROFILE_ENV_NAME];
const profile =
  rawProfile === undefined || rawProfile.trim() === "" ? "production" : rawProfile.trim();

if (profile === "preview") {
  try {
    await import(SERVER_SDK_PRELOAD_SPECIFIER);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${PROFILE_ENV_NAME}=preview requires "${SERVER_SDK_PRELOAD_SPECIFIER}" to be installed and to initialize successfully: ${reason}`,
    );
  }
} else if (profile !== "production") {
  throw new Error(
    `${PROFILE_ENV_NAME} must be one of preview, production, received "${rawProfile}".`,
  );
}
