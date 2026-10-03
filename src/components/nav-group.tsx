import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { SidebarNavGroup } from "@/components/app-shared";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";

/** One navigation row: 28px tall, and a lighter pill when it is the current page. */
const NAV_ITEM =
  "h-7 gap-2 rounded-lg px-2 text-sm font-medium hover:bg-background data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:hover:bg-sidebar-accent [&>svg]:size-[1.125rem] [&>svg]:text-foreground/80";

export function NavGroup({ label, items }: SidebarNavGroup) {
  const pathname = usePathname();
  return (
    <SidebarGroup className="px-3 py-1.5">
      {label && (
        <SidebarGroupLabel className="h-7 text-xs font-semibold text-sidebar-foreground/75">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu className="gap-0">
        {items.map((item) =>
          ((): React.ReactElement => {
            const isItemActive = !!item.path && pathname === item.path;
            return (
              <Collapsible
                asChild
                className="group/collapsible"
                defaultOpen={
                  isItemActive || item.subItems?.some((i) => !!i.path && pathname === i.path)
                }
                key={item.title}
              >
                <SidebarMenuItem>
                  {item.subItems?.length ? (
                    <>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className={NAV_ITEM} isActive={isItemActive}>
                          {item.icon}
                          <span>{item.title}</span>
                          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.subItems?.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={!!subItem.path && pathname === subItem.path}
                              >
                                <Link href={subItem.path ?? "#"}>
                                  {subItem.icon}
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </>
                  ) : (
                    <SidebarMenuButton asChild className={NAV_ITEM} isActive={isItemActive}>
                      <Link href={item.path ?? "#"}>
                        {item.icon}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            );
          })(),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
