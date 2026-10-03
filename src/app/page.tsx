import Link from "next/link";
import { ArrowRight, BarChart3, MessageSquareText, LineChart, Check } from "lucide-react";

import { HeroDitheringBackground } from "@/components/hero-dithering-background";
import { Logo } from "@/components/Logo";

export default function Landing() {
  // `dark` opts the marketing surface into its own palette and type; see styles.css.
  return (
    <div className="dark min-h-screen">
      <SiteHeader />
      <Hero />
      <Features />
      <ProductPreview />
      <ClosingCta />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="font-display text-xl font-semibold tracking-tight">Shopalytics</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">
            Product
          </a>
          <a href="#preview" className="hover:text-foreground">
            Dashboard
          </a>
          <a href="#teams" className="hover:text-foreground">
            For teams
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View demo
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-border/60">
      <HeroDitheringBackground />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Find the conversion leaks
            <br />
            <span className="italic text-primary">hiding in your traffic,</span>
            <br />
            segments, and reviews.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Shopalytics is the weekly operating dashboard for ecommerce growth teams. Stop guessing
            why a cohort dropped — see the product, source, and review evidence in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View demo dashboard
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {[
              "Funnel + review evidence together",
              "Cohort drill-down in seconds",
              "Weekly growth review, built-in",
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-primary" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: BarChart3,
    title: "Conversion analytics by product, source, and segment",
    body: "Stack filters across products, traffic sources, and customer segments to isolate exactly where conversion is breaking down — without writing SQL or rebuilding dashboards.",
    points: ["Per-product CVR & revenue", "TikTok vs. Meta vs. Search", "Demographic cohorts"],
  },
  {
    icon: MessageSquareText,
    title: "Review-aware funnel diagnosis",
    body: "Customer reviews live next to the funnel. When a cohort's conversion drops, the matching review excerpts — sizing, fit, shipping — surface immediately so you know why.",
    points: ["Sentiment + topic filters", "Tied to product & segment", "Negative signal alerts"],
  },
  {
    icon: LineChart,
    title: "Weekly operating dashboard for growth teams",
    body: "One dashboard the whole growth team opens on Monday. Trends, KPIs vs. baseline, and product breakdowns — designed for the weekly review, not for ad-hoc exploration.",
    points: ["Baseline-aware KPIs", "Daily trend lines", "Built for repeatable reviews"],
  },
] as const;

function Features() {
  return (
    <section id="features" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            What you get
          </span>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight md:text-4xl">
            Built for the questions growth teams actually ask.
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <article key={f.title} className="flex flex-col gap-4 bg-card p-7">
                <span className="inline-grid size-10 place-items-center rounded-md bg-primary/12 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-display text-[19px] font-medium leading-snug tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <ul className="mt-auto space-y-1.5 pt-2 text-sm text-foreground/80">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <section id="preview" className="border-b border-border/60 bg-sidebar/40">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-start gap-12 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
              The dashboard
            </span>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight md:text-4xl">
              One screen. Every layer of the funnel.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
              Filter by product, traffic source, segment, sentiment, or review topic — then read the
              KPIs, the trend, the product breakdown, and the matching reviews together. No more
              flipping between five tools to answer one question.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Baseline deltas on every KPI",
                "Daily conversion-rate trend",
                "Per-product purchase & revenue table",
                "Sentiment-tagged review feed",
              ].map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-foreground/85">
                  <span className="size-1.5 rounded-full bg-primary" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                Open the live demo
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <DashboardMock />
        </div>
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative rounded-xl border border-border bg-card p-4 shadow-2xl shadow-primary/5">
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-3">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="ml-3 text-[11px] text-muted-foreground">shopalytics.app/app</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { l: "Conv. rate", v: "1.07%", d: "−2.05pp" },
          { l: "AOV", v: "$84", d: "+$3" },
          { l: "Revenue", v: "$12.4k", d: "−18%" },
        ].map((k) => (
          <div key={k.l} className="rounded-md border border-border/60 p-2.5">
            <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              {k.l}
            </div>
            <div className="mt-1 font-display text-lg font-semibold tabular-nums">{k.v}</div>
            <div className="text-[10px] text-rose-400">{k.d}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 h-32 rounded-md border border-border/60 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Conversion rate · 30d
        </div>
        <svg viewBox="0 0 300 80" className="mt-2 h-20 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,30 L20,28 L40,34 L60,26 L80,32 L100,22 L120,28 L140,24 L160,30 L180,40 L200,48 L220,52 L240,60 L260,58 L280,64 L300,68 L300,80 L0,80 Z"
            fill="url(#lp)"
          />
          <path
            d="M0,30 L20,28 L40,34 L60,26 L80,32 L100,22 L120,28 L140,24 L160,30 L180,40 L200,48 L220,52 L240,60 L260,58 L280,64 L300,68"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          { p: "Aero High-Rise Legging", s: "12,430", c: "0.82%" },
          { p: "Cloudrun Tank", s: "8,210", c: "1.94%" },
          { p: "Studio Crop Tee", s: "6,775", c: "2.41%" },
        ].map((r) => (
          <div
            key={r.p}
            className="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5 text-xs"
          >
            <span className="truncate">{r.p}</span>
            <span className="flex gap-4 text-muted-foreground tabular-nums">
              <span>{r.s}</span>
              <span className="text-foreground">{r.c}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingCta() {
  return (
    <section id="teams" className="border-b border-border/60">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl font-medium tracking-tight md:text-5xl">
          Run a sharper weekly growth review.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Pull up the same dashboard every Monday. Filter to the cohort that moved. Read the reviews
          underneath. Decide and move on.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View demo dashboard
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="font-display text-lg font-semibold text-foreground">Shopalytics</span>
          <span>· Conversion analytics for ecommerce teams</span>
        </div>
        <div className="text-xs">© {new Date().getFullYear()} Shopalytics</div>
      </div>
    </footer>
  );
}
