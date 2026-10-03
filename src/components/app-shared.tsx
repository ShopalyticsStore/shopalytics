import type { ReactNode } from "react";
import {
  LayoutGridIcon,
  MessageSquareTextIcon,
  PackageIcon,
  UsersIcon,
  SettingsIcon,
  HelpCircleIcon,
  ActivityIcon,
  TrendingUpIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon?: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", path: "/app", icon: <LayoutGridIcon /> },
      { title: "Conversion", path: "/app/conversion", icon: <TrendingUpIcon /> },
      { title: "Reviews", path: "/app/reviews", icon: <MessageSquareTextIcon /> },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", path: "/app/products", icon: <PackageIcon /> },
      { title: "Segments", path: "/app/segments", icon: <UsersIcon /> },
    ],
  },
  {
    label: "Workspace",
    items: [{ title: "Settings", path: "/app/settings", icon: <SettingsIcon /> }],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  { title: "Docs", path: "https://docs.shopalytics.app", icon: <HelpCircleIcon /> },
  { title: "Status", path: "https://status.shopalytics.app", icon: <ActivityIcon /> },
];

export const navLinks: SidebarNavItem[] = [
  ...navGroups.flatMap((group) =>
    group.items.flatMap((item) => (item.subItems?.length ? [item, ...item.subItems] : [item])),
  ),
  ...footerNavLinks,
];
