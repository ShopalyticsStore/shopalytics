"use client";

import Link from "next/link";
import { BellIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { Logo } from "@/components/Logo";
import { NavUser } from "@/components/nav-user";

/** The quarter-circle that rounds the frame's top corners under the bar. */
const FRAME_CORNER = "pointer-events-none absolute top-full size-3";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center gap-3 bg-topbar px-3 text-topbar-foreground">
      <div className="flex shrink-0 items-center gap-1 md:w-[calc(var(--sidebar-width)-0.75rem)]">
        <CustomSidebarTrigger />
        <Link
          href="/"
          className="flex h-9 items-center gap-2 rounded-lg px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <Logo className="size-7" />
          <span className="text-base font-semibold tracking-tight text-white">Shopalytics</span>
        </Link>
      </div>

      <div className="flex min-w-0 flex-1 justify-center">
        {/* Workspace search is not built yet; the field holds its place in the bar. */}
        <div
          aria-hidden="true"
          className="hidden h-9 w-full max-w-[40rem] select-none items-center gap-2 rounded-[0.625rem] border border-white/10 bg-topbar-field px-3 text-sm text-topbar-muted sm:flex"
        >
          <SearchIcon className="size-4" />
          <span>Search</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 md:w-[calc(var(--sidebar-width)-0.75rem)]">
        <Button
          aria-label="Notifications"
          size="icon"
          variant="ghost"
          className="text-topbar-foreground hover:bg-white/10 hover:text-white active:bg-white/15 [&_svg]:size-[1.125rem]"
        >
          <BellIcon />
        </Button>
        <NavUser />
      </div>

      <span
        aria-hidden="true"
        className={`${FRAME_CORNER} left-0 bg-[radial-gradient(circle_at_100%_100%,transparent_0.75rem,var(--topbar)_calc(0.75rem+0.5px))]`}
      />
      <span
        aria-hidden="true"
        className={`${FRAME_CORNER} right-0 bg-[radial-gradient(circle_at_0%_100%,transparent_0.75rem,var(--topbar)_calc(0.75rem+0.5px))]`}
      />
    </header>
  );
}
