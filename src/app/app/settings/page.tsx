"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShoppingBag, Users, Database } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardContext } from "@/lib/db";

const TEAM = [
  {
    name: "Maya Okonkwo",
    role: "Growth lead",
    email: "maya@dudulemon.example.com",
    initials: "MO",
  },
  {
    name: "Jordan Miles",
    role: "Analytics",
    email: "jordan@dudulemon.example.com",
    initials: "JM",
  },
  {
    name: "Sam Kapoor",
    role: "Performance marketing",
    email: "sam@dudulemon.example.com",
    initials: "SK",
  },
];

export default function SettingsPage() {
  const ctx = useQuery({ queryKey: ["dashboard-context"], queryFn: getDashboardContext });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your Shopalytics workspace, connected store, and team."
      />

      <Section title="Workspace">
        <FieldRow label="Account name" value={ctx.data?.account.name ?? "—"} />
        <FieldRow label="Plan" value="Growth · annual" />
        <FieldRow label="Region" value="us-east-1" />
        <FieldRow label="Workspace ID" value="ws_dudulemon_pri" mono />
      </Section>

      <Section title="Connected store" icon={<ShoppingBag className="size-4 text-foreground/70" />}>
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <div className="text-sm font-medium">Shopify · dudulemon.myshopify.com</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Connected by Maya Okonkwo · synced 14 minutes ago
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-success-surface px-2 py-0.5 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" />
            Healthy
          </span>
        </div>
      </Section>

      <Section title="Data sync" icon={<Database className="size-4 text-foreground/70" />}>
        <FieldRow label="Last full sync" value="2 hours ago" />
        <FieldRow label="Streaming events" value="Enabled · 14 min lag" />
        <FieldRow label="Historical backfill" value="75 days loaded" />
        <FieldRow label="Review ingestion" value="Yotpo + on-site · daily" />
      </Section>

      <Section title="Team" icon={<Users className="size-4 text-foreground/70" />}>
        <ul className="divide-y">
          {TEAM.map((m) => (
            <li key={m.email} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-8 place-items-center rounded-lg bg-secondary text-xs font-semibold text-foreground">
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </div>
              <span className="text-xs text-muted-foreground">{m.role}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center gap-2 border-b py-3">
        {icon}
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0 [&:last-child]:pb-0">{children}</CardContent>
    </Card>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${mono ? "tabular-nums text-xs tracking-wide text-muted-foreground" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}
