import type { ReactNode } from "react";
import {
  HomeIcon,
  MessageSquareTextIcon,
  TagIcon,
  UsersIcon,
  SettingsIcon,
  HelpCircleIcon,
  ActivityIcon,
  ChartNoAxesColumnIcon,
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
    label: "",
    items: [
      { title: "Dashboard", path: "/app", icon: <HomeIcon /> },
      { title: "Conversion", path: "/app/conversion", icon: <ChartNoAxesColumnIcon /> },
      { title: "Reviews", path: "/app/reviews", icon: <MessageSquareTextIcon /> },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", path: "/app/products", icon: <TagIcon /> },
      { title: "Segments", path: "/app/segments", icon: <UsersIcon /> },
    ],
  },
];

/** Settings sits apart from the rest, pinned to the foot of the navigation. */
export const settingsNavGroup: SidebarNavGroup = {
  label: "",
  items: [{ title: "Settings", path: "/app/settings", icon: <SettingsIcon /> }],
};

export const footerNavLinks: SidebarNavItem[] = [
  { title: "Docs", path: "https://docs.shopalytics.app", icon: <HelpCircleIcon /> },
  { title: "Status", path: "https://status.shopalytics.app", icon: <ActivityIcon /> },
];

export const navLinks: SidebarNavItem[] = [
  ...[...navGroups, settingsNavGroup].flatMap((group) =>
    group.items.flatMap((item) => (item.subItems?.length ? [item, ...item.subItems] : [item])),
  ),
  ...footerNavLinks,
];
