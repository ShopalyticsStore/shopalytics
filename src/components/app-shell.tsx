"use client";

import type { CSSProperties } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";

/**
 * The workspace frame: a dark top bar across the full width, and under it the
 * navigation beside the page. The document scrolls, not the page region, so the
 * top bar stays put and every scroll is one the window reports.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      className="flex-col bg-topbar [--app-header-height:3.5rem]"
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
      <AppHeader />
      <div className="flex flex-1 bg-sidebar">
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <div className="flex w-full flex-1 flex-col px-4 pt-4 pb-8 md:px-5">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
