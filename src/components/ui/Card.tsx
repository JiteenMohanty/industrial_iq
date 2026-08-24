import type { ReactNode } from "react";

/**
 * `hoverable` opts into a subtle lift-and-brighten on hover — used where the card itself is the
 * interactive unit (InsightCard, StatTile) rather than every Card in the app, so display-only uses
 * (the funnel page's stage-duration strip) don't imply clickability they don't have.
 */
export function Card({
  children,
  className = "",
  hoverable = false,
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm transition-all duration-200 ${
        hoverable ? "hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
