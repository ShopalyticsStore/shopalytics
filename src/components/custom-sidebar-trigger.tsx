import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CustomSidebarTrigger() {
  return (
    <Tooltip delayDuration={1000}>
      <TooltipTrigger asChild>
        <SidebarTrigger className="h-8 w-8 text-topbar-muted hover:bg-white/10 hover:text-white active:bg-white/15" />
      </TooltipTrigger>
      <TooltipContent className="px-2 py-1" side="right">
        Toggle Sidebar{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>b</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
