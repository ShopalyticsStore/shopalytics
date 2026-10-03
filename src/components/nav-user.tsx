"use client";

/** The signed-in Dudulemon user, read from the dashboard context. */

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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 cursor-pointer" data-testid="nav-user">
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <span className="font-medium text-foreground">{name}</span>
            <div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-muted-foreground">
              {email}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">{role}</div>
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
  );
}
