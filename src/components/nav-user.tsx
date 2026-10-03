"use client";

/**
 * The signed-in Dudulemon user, read from the dashboard context. The bar shows
 * the workspace beside the avatar; the person is named inside the menu.
 */

import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDashboardContext } from "@/lib/db";
import { BellIcon, BookOpenIcon, LifeBuoyIcon, UserIcon } from "lucide-react";

export function NavUser() {
  const context = useQuery({ queryKey: ["dashboard-context"], queryFn: getDashboardContext });
  const user = context.data?.user;
  const name = user?.name ?? "Not signed in";
  const email = user?.email ?? "";
  const role = user?.role ?? "";
  const accountName = context.data?.account.name;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="size-7 cursor-pointer rounded-lg" data-testid="nav-user">
            <AvatarFallback className="rounded-lg bg-brand text-xs font-semibold text-topbar">
              {name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-3">
            <Avatar className="size-9 rounded-lg">
              <AvatarFallback className="rounded-lg bg-brand font-semibold text-topbar">
                {name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <span className="font-medium text-foreground">{name}</span>
              <div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-xs font-normal text-muted-foreground">
                {email}
              </div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">{role}</div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BellIcon />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpenIcon />
              Documentation
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LifeBuoyIcon />
              Support
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {accountName !== undefined && (
        <span className="hidden max-w-40 truncate text-sm font-medium text-white md:inline">
          {accountName}
        </span>
      )}
    </div>
  );
}
