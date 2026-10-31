import Image from "next/image";

import shopalyticsLogo from "@/assets/brand/shopalytics-logo.webp";
import { cn } from "@/lib/utils";

/**
 * Shopalytics' mark. The artwork is a full-bleed square tile, so it is rounded
 * here to the same proportion as the Dudulemon mark's own corners.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Image src={shopalyticsLogo} alt="Shopalytics" unoptimized className={cn("rounded-[20%]", className)} />
  );
}
