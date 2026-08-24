import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDataset } from "@/lib/data/dataset";
import { getRealNow, monthsBetween } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { TimeRangeFilter } from "@/components/filters/TimeRangeFilter";
import { BranchFilter } from "@/components/filters/BranchFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealerPulse",
  description: "Dealership performance dashboard",
};

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/funnel", label: "Funnel" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/branches", label: "Branches" },
] as const;

function FreshnessBanner() {
  const dataset = getDataset();
  const now = getRealNow();
  const monthsBehind = monthsBetween(dataset.dataAsOf, now);

  return (
    <div className="border-b border-grid bg-page px-4 py-2 text-center text-xs text-ink-secondary">
      Data as of {formatDate(dataset.dataAsOf)}
      {monthsBehind > 0 &&
        ` · ${monthsBehind} ${monthsBehind === 1 ? "month" : "months"} behind live`}
    </div>
  );
}

function SiteNav() {
  return (
    <nav aria-label="Main" className="border-b border-grid bg-surface">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-ink-primary">
          DealerPulse
        </Link>

        <ul className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-ink-secondary hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Native <details>/<summary> disclosure — keyboard-accessible by default, no client
            JS required, so the nav collapse (Constitution: "nav collapses under lg") stays
            server-rendered rather than needing a 4th category of client component. */}
        <details className="lg:hidden">
          <summary
            aria-label="Open menu"
            className="cursor-pointer list-none rounded p-2 text-ink-secondary hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">☰</span>
          </summary>
          <ul className="absolute right-4 z-10 mt-2 w-48 rounded-lg border border-border bg-surface p-2 shadow-lg">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block rounded px-3 py-2 text-sm text-ink-primary hover:bg-page"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <Suspense fallback={<FilterBarSkeleton />}>
        <FilterBar />
      </Suspense>
    </nav>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="border-t border-grid bg-page px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-36" />
      </div>
    </div>
  );
}

/**
 * `TimeRangeFilter`/`BranchFilter` call `useSearchParams()`, which Next.js requires to sit inside
 * a `<Suspense>` boundary — without one, the statically-generated `/_not-found` page (prerendered
 * at build time, with no per-request URL to read) fails the build outright ("should be wrapped in
 * a suspense boundary"). Every real route is already dynamically rendered (every page reads
 * `searchParams` itself), so this boundary never actually shows its fallback in practice — it only
 * satisfies the one build-time static page that has no search params to read at all.
 */
function FilterBar() {
  const dataset = getDataset();
  const minDate = dataset.minCreatedAt.toISOString().slice(0, 10);
  const maxDate = dataset.dataAsOf.toISOString().slice(0, 10);
  const branches = dataset.branches.map((b) => ({ id: b.id, label: b.label }));

  return (
    <div className="border-t border-grid bg-page px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
        <TimeRangeFilter minDate={minDate} maxDate={maxDate} />
        <BranchFilter branches={branches} />
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <FreshnessBanner />
        <SiteNav />
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
