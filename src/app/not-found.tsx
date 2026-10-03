import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="max-w-sm text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">404</p>
        <h1 className="mt-3 font-display text-3xl font-medium">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This Shopalytics view does not exist.</p>
        <Link
          href="/app"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
