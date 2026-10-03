"use client";

import { usePathname } from "next/navigation";

import { navLinks } from "@/components/app-shared";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}

/** The page's own icon from the navigation, its title, and what the page is scoped to. */
export function PageHeader({ eyebrow, title, description, right }: Props) {
  const pathname = usePathname();
  const icon = navLinks.find((item) => item.path === pathname)?.icon;
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {icon !== undefined && (
            <span aria-hidden="true" className="flex text-foreground [&>svg]:size-5">
              {icon}
            </span>
          )}
          <h1 className="text-xl font-semibold leading-7 tracking-tight">{title}</h1>
          {eyebrow && <div className="pl-1 text-sm text-muted-foreground">{eyebrow}</div>}
        </div>
        {description && (
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {right}
    </header>
  );
}
