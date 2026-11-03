import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A uTrace candidate preview may serve `next dev` behind the preview front door,
  // so its development resources load from the session's preview origin, and the
  // participant never sees the development indicator.
  allowedDevOrigins: (process.env.UTRACE_PREVIEW_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  devIndicators: false,
};

export default nextConfig;
