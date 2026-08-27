import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDataset } from "@/lib/data/dataset";
import { getRealNow, monthsBetween } from "@/lib/time";
import { formatDate } from "@/lib/format";
import { TimeRangeFilter } from "@/components/filters/TimeRangeFilter";
import { BranchFilter } from "@/components/filters/BranchFilter";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import "./globals.css";

/**
 * Sets the `.dark` class on <html> synchronously, before first paint — must run as a plain
 * blocking script, not a React effect, or the page would flash light-then-dark on every load for
 * a reader who has the dark theme stored. Precedence: stored preference, then OS preference, then
 * light. Wrapped in try/catch since localStorage can throw in some privacy-mode configurations;
 * a throw here must never break the page, just fall back to the light default.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("dealerpulse-theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "DealerPulse",
  description:
    "Where a five-branch dealership group is winning, losing, and leaking — and what to do about it.",
};

/**
 * Navigation follows the reader's mental model rather than the data model: position first, then
 * the diagnostic layer (where it breaks, what customers want, where leads come from), then the
 * entities accountable for it, then the raw records. Nothing is nested — every section is one
 * click from every other, because a manager chasing a problem should never have to remember which
 * parent a view lives under.
 */
const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/funnel", label: "Funnel" },
  { href: "/models", label: "Demand" },
  { href: "/sources", label: "Sources" },
  { href: "/branches", label: "Branches" },
  { href: "/reps", label: "Reps" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/leads", label: "Leads" },
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
        <Link
          href="/"
          className="font-semibold tracking-tight text-ink-primary"
        >
          DealerPulse
        </Link>

        <div className="flex items-center gap-4">
          <ul className="hidden items-center gap-5 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-secondary transition-colors duration-150 hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <ThemeToggle />

          {/* Native <details>/<summary> disclosure — keyboard-accessible by default, no client
              JS required, so the nav collapse (Constitution: "nav collapses under lg") stays
              server-rendered rather than needing a 4th category of client component. */}
          <details className="lg:hidden">
            <summary
              aria-label="Open menu"
              className="cursor-pointer list-none rounded p-2 text-ink-secondary transition-colors duration-150 hover:bg-page focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">☰</span>
            </summary>
            <ul className="absolute right-4 z-10 mt-2 w-48 rounded-lg border border-border bg-surface p-2 shadow-lg">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded px-3 py-2 text-sm text-ink-primary transition-colors duration-150 hover:bg-page"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </div>
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must run synchronously, before first paint, to set the .dark class before the browser
            renders anything (FOUC) — see THEME_INIT_SCRIPT's own comment above. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent-solid focus:px-3 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <FreshnessBanner />
          <SiteNav />
          <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
