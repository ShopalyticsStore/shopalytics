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

export function NavGroup({ label, items }: SidebarNavGroup) {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
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
                        <SidebarMenuButton isActive={isItemActive}>
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
                    <SidebarMenuButton asChild isActive={isItemActive}>
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
