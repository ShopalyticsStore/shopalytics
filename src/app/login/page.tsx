"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";

import { HeroDitheringBackground } from "@/components/hero-dithering-background";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-between border-b border-border/60 px-8 py-10 lg:border-b-0 lg:border-r lg:px-16">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-xl font-semibold tracking-tight transition-colors hover:text-primary">
            Shopalytics
          </span>
        </Link>

        <div className="mx-auto w-full max-w-sm py-10">
          <h1 className="font-display text-3xl font-medium tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your workspace.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/app");
            }}
          >
            <Field
              icon={Mail}
              type="email"
              label="Work email"
              defaultValue="maya@dudulemon.example.com"
              autoComplete="email"
            />
            <Field
              icon={Lock}
              type="password"
              label="Password"
              defaultValue="••••••••••"
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium hover:bg-accent"
            >
              Sign in
            </button>
          </form>
        </div>

        <div className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            ← Back to home
          </Link>
        </div>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-16 lg:flex">
        <HeroDitheringBackground />
        <div className="relative">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            This week at Dudulemon
          </span>
          <p className="mt-5 font-display text-3xl font-medium leading-tight tracking-tight">
            “Conversion on the women 25–34 / TikTok cohort fell 2pp this week. The sizing reviews on
            the Aero High-Rise Legging tripled.”
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            — surfaced in the Monday growth review
          </p>
        </div>
        <div className="relative flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex -space-x-2">
            {["AC", "JM", "SK"].map((i) => (
              <span
                key={i}
                className="grid size-7 place-items-center rounded-full border border-sidebar bg-primary/20 text-[10px] font-semibold text-primary"
              >
                {i}
              </span>
            ))}
          </div>
          <span>3 teammates active in Dudulemon</span>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: typeof Mail;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-card px-3">
        <Icon className="size-4 text-muted-foreground" />
        <input
          {...rest}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </label>
  );
}
