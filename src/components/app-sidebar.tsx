"use client";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import { navGroups } from "@/components/app-shared";
import Link from "next/link";

export function AppSidebar() {
  return (
    <Sidebar
      className={cn("*:data-[slot=sidebar-inner]:bg-background")}
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarHeader className="h-20 items-center justify-center px-3 py-3 group-data-[collapsible=icon]:px-0">
        <SidebarMenuButton
          asChild
          className="h-14 gap-3 rounded-xl px-3 py-3 group-data-[collapsible=icon]:!size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:[&>span]:hidden [&>svg]:!size-10 group-data-[collapsible=icon]:[&>svg]:!size-10"
        >
          <Link href="/">
            <Logo className="text-primary" />
            <span className="font-semibold text-xl tracking-tight">Shopalytics</span>
          </Link>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group, index) => (
          <NavGroup key={`sidebar-group-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="px-3 pb-3 text-[11px] text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
        <span className="px-1">Shopalytics · v1.2</span>
      </SidebarFooter>
    </Sidebar>
  );
}
