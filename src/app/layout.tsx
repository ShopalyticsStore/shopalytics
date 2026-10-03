import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { UTracePreviewGate } from "@/lib/utrace/preview-gate";
import {
  UTRACE_CLIENT_RELEASE_ID_ENV_NAME,
  UTRACE_PUBLIC_PROFILE_ENV_NAME,
  UTRACE_SDK_INSTALLATION_ID_ENV_NAME,
  resolveUTraceProfile,
} from "@/lib/utrace/profile";
import "../styles.css";

/**
 * Every face is self-hosted rather than fetched with `next/font/google`.
 *
 * A build that reaches `fonts.googleapis.com` cannot run inside a uTrace
 * implementation workspace, whose network wall admits package registries,
 * GitHub, operating-system repositories and uTrace callbacks and nothing else.
 * Reading the files from disk keeps the build network-free apart from npm, and
 * `next/font/local` still self-hosts, subsets and preloads them and still
 * exposes the CSS variables the styles use.
 *
 * Inter sets the workspace and is vendored under `src/assets/fonts/inter` with
 * its licence, so adding it changed no dependency. Geist and Fraunces set the
 * marketing surface and come from their `@fontsource-variable` packages.
 *
 * All three are variable fonts, so one file covers every weight the design
 * uses, including the workspace's in-between weights (450, 550, 650).
 */
const inter = localFont({
  src: "../assets/fonts/inter/inter-latin-wght-normal.woff2",
  display: "swap",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
});

const geist = localFont({
  src: "../../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900",
  style: "normal",
});

const fraunces = localFont({
  src: "../../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2",
  display: "swap",
  variable: "--font-fraunces",
  weight: "100 900",
  style: "normal",
});

export const metadata: Metadata = {
  title: {
    default: "Shopalytics — Conversion analytics for ecommerce teams",
    template: "%s — Shopalytics",
  },
  description: "Find the conversion leaks hiding in your traffic, segments, and reviews.",
  openGraph: {
    title: "Shopalytics — Conversion analytics",
    description: "Review-aware funnel diagnosis for ecommerce growth teams.",
  },
};

/**
 * `UTraceGate` is the outermost client component, so in the preview profile the
 * activation gate runs before any application client component renders and the
 * application subtree is withheld until the observation runtime is ready. The
 * three `NEXT_PUBLIC_*` values are inlined at build time, which is what makes a
 * production bundle exclude the uTrace runtime rather than merely not start it.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = resolveUTraceProfile(process.env[UTRACE_PUBLIC_PROFILE_ENV_NAME]);
  return (
    <html lang="en" className={`${inter.variable} ${geist.variable} ${fraunces.variable}`}>
      <body className="bg-background text-foreground">
        <UTracePreviewGate
          profile={profile}
          sdkInstallationId={requiredWhenPreview(
            profile,
            UTRACE_SDK_INSTALLATION_ID_ENV_NAME,
            process.env[UTRACE_SDK_INSTALLATION_ID_ENV_NAME],
          )}
          clientReleaseId={requiredWhenPreview(
            profile,
            UTRACE_CLIENT_RELEASE_ID_ENV_NAME,
            process.env[UTRACE_CLIENT_RELEASE_ID_ENV_NAME],
          )}
        >
          <Providers>{children}</Providers>
        </UTracePreviewGate>
      </body>
    </html>
  );
}

/**
 * A preview build without its uTrace configuration must not boot: an
 * unobserved preview is not a substitute for an observed one. A production
 * build needs neither value, and the gate ignores both.
 */
function requiredWhenPreview(
  profile: "preview" | "production",
  name: string,
  value: string | undefined,
): string {
  if (profile === "production") {
    return "";
  }
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    throw new Error(
      `${name} is required when ${UTRACE_PUBLIC_PROFILE_ENV_NAME}=preview: the preview must not boot as an unobserved substitute.`,
    );
  }
  return trimmed;
}
