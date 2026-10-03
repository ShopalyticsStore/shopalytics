"use client";

import { Dithering } from "@paper-design/shaders-react";

export function HeroDitheringBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Dithering
        className="h-full w-full opacity-55"
        colorBack="#020806"
        colorFront="#20c878"
        fit="cover"
        height="100%"
        maxPixelCount={1_200_000}
        scale={0.92}
        shape="warp"
        size={3}
        speed={0.22}
        type="4x4"
        width="100%"
      />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_34%,transparent_0%,rgba(0,0,0,0.24)_58%,rgba(0,0,0,0.72)_100%)]" />
      <div className="absolute inset-0 bg-background/35" />
    </div>
  );
}
