import { AppShell } from "@/components/app-shell";

export const metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
