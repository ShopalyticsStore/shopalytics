"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center bg-[radial-gradient(ellipse_at_center,#101d20_0%,#050b0d_65%)] px-4 py-10">
      <Link href="/" aria-label="Shopalytics home" className="rounded-xl">
        <Logo className="size-20" />
      </Link>

      <div className="mt-8 w-full max-w-[30rem] rounded-3xl bg-card p-8 text-card-foreground shadow-overlay sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
        <p className="mt-1 text-base text-muted-foreground">Continue to Shopalytics</p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/app");
          }}
        >
          <Field
            type="email"
            label="Work email"
            defaultValue="maya@dudulemon.example.com"
            autoComplete="email"
          />
          <Field
            type="password"
            label="Password"
            defaultValue="••••••••••"
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground shadow-button-primary hover:bg-primary/90"
          >
            Sign in
          </button>
        </form>
      </div>

      <div className="mt-auto pt-10 text-sm text-white/70">
        <Link href="/" className="hover:text-white">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

function Field({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        {...rest}
        className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
      />
    </label>
  );
}
