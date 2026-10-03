"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { navLinks } from "@/components/app-shared";
import { NavUser } from "@/components/nav-user";
import { BellIcon } from "lucide-react";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const pathname = usePathname();
  const activeItem = navLinks.find((item) => item.path === pathname) ??
    navLinks.find((item) => item.path && pathname.startsWith(item.path)) ?? {
      title: "Dashboard",
    };
  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-4 md:px-6",
      )}
    >
      <div className="flex items-center gap-3">
        <CustomSidebarTrigger />
        <Separator
          className="mr-2 h-4 data-[orientation=vertical]:self-center"
          orientation="vertical"
        />
        <AppBreadcrumbs page={activeItem} />
      </div>
      <div className="flex items-center gap-3">
        <Button aria-label="Notifications" size="icon-sm" variant="outline">
          <BellIcon />
        </Button>
        <Separator className="h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
        <NavUser />
      </div>
    </header>
  );
}
