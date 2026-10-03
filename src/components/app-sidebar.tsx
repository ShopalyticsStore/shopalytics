"use client";

import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import { navGroups, settingsNavGroup } from "@/components/app-shared";

export function AppSidebar() {
  return (
    <Sidebar
      className="top-(--app-header-height) h-[calc(100svh-var(--app-header-height))]! group-data-[side=left]:border-r-0"
      collapsible="icon"
      variant="sidebar"
    >
      <SidebarContent className="gap-0 pt-2">
        {navGroups.map((group, index) => (
          <NavGroup key={`sidebar-group-${index}`} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter className="p-0 pb-2">
        <NavGroup {...settingsNavGroup} />
      </SidebarFooter>
    </Sidebar>
  );
}
