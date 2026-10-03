import Link from "next/link";
import {
  ChevronRightIcon,
  MessageSquareIcon,
  PackagePlusIcon,
  SettingsIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

export type QuickAction = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    title: "Browse products",
    description: "Inspect SKUs & funnels.",
    href: "/app/products",
    icon: PackagePlusIcon,
  },
  {
    title: "Customer reviews",
    description: "Latest voice of customer.",
    href: "/app/reviews",
    icon: MessageSquareIcon,
  },
  {
    title: "Traffic segments",
    description: "Source quality breakdown.",
    href: "/app/segments",
    icon: TruckIcon,
  },
  {
    title: "Workspace settings",
    description: "Members, billing & data.",
    href: "/app/settings",
    icon: SettingsIcon,
  },
];

export function QuickActions({
  actions = DEFAULT_ACTIONS,
  title = "Quick actions",
  description = "Shortcuts to the same destinations.",
}: {
  actions?: QuickAction[];
  title?: string;
  description?: string;
} = {}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b py-5">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="bg-muted/10 p-2">
        <ItemGroup className="gap-0">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Item asChild key={a.title} size="sm">
                <Link href={a.href}>
                  <ItemMedia variant="icon">
                    <Icon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{a.title}</ItemTitle>
                    <ItemDescription className="line-clamp-1">{a.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </ItemActions>
                </Link>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
