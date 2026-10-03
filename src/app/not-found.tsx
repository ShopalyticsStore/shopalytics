import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This Shopalytics view does not exist.</p>
        <Link
          href="/app"
          className="mt-5 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-button-primary hover:bg-primary/90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
