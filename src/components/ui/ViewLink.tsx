import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A link that changes the **current view in place** — a chart's measure, a table's sort, a
 * heatmap's dimension, a cohort, a disclosure.
 *
 * Every internal link in this product is a URL change, because the URL is the only view state
 * (Constitution VI). That is deliberate and it is what makes every view shareable. But it means
 * Next.js cannot tell the difference between "go to the branch page" and "switch this chart to
 * units", and its default on navigation is to scroll to the top of the document. For a control
 * sitting halfway down a page, that reads as the page reloading and throwing the reader away from
 * what they were looking at: the data changed correctly, and the UI felt broken.
 *
 * So the distinction is drawn here, in the type system rather than in reviewer discipline:
 *
 *   - `ViewLink`  — changes what the current page shows. Scroll position is preserved.
 *   - `Link`      — goes somewhere else. Scrolling to the top is correct, and is the default.
 *
 * If a new control changes the page it already lives on, it uses this. Nothing else should need to
 * think about `scroll`.
 */
export function ViewLink({
  href,
  className,
  children,
  ariaCurrent,
  title,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaCurrent?: "true" | "page";
  title?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={ariaCurrent}
      title={title}
      className={className}
    >
      {children}
    </Link>
  );
}
