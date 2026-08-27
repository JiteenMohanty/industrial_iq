import type { ReactNode } from "react";

/**
 * The single container primitive. Three planes only — page, surface, raised — separated by a
 * hairline border rather than a shadow, so density stays readable when a dozen cards sit on one
 * screen and nothing appears to float for decorative reasons.
 */
export function Card({
  children,
  className = "",
  padded = true,
  tone = "surface",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  tone?: "surface" | "raised";
}) {
  const bg = tone === "raised" ? "bg-raised" : "bg-surface";
  // `min-w-0` is load-bearing, not cosmetic: a grid/flex item defaults to `min-width: auto`, so a
  // wide child (a table inside its own scroll container) sizes the track and pushes the whole page
  // into horizontal scroll. Measured at 768px on /models before this was added — 199px of overflow.
  return (
    <div
      className={`min-w-0 rounded-[var(--radius-card)] border border-border ${bg} ${padded ? "p-4" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Section heading. `hint` carries the definition of whatever the section shows — the measurement
 * basis, the denominator, the caveat — so a reader never has to guess what a figure counts.
 */
export function SectionHeading({
  title,
  hint,
  action,
  as: As = "h2",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <As
          className={
            As === "h1"
              ? "text-xl font-semibold tracking-tight text-ink-primary"
              : "text-base font-semibold tracking-tight text-ink-primary"
          }
        >
          {title}
        </As>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
