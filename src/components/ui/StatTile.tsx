import type { ReactNode } from "react";
import { TrendIndicator } from "./Badge";

/**
 * Executive KPI tile.
 *
 * Deliberately constrained: label, figure, one comparison, and — where the figure needs one — a
 * caveat. No sparkline, no icon, no decorative colour. The reference dealership dashboards make
 * the same point in their own way ("8–12 metrics maximum"): the value of a KPI row collapses as
 * soon as it becomes a wall, so the discipline is in what these tiles refuse to carry.
 *
 * `value` is pre-formatted by the caller — currency in lakh/crore, percentages, day counts — so
 * this component never decides units and can never format a number two different ways on two
 * different pages.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaSuffix = "",
  basis,
  lowerIsBetter = false,
  caveat,
  hint,
  emphasis = false,
  footer,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  basis?: string;
  lowerIsBetter?: boolean;
  caveat?: string;
  hint?: string;
  emphasis?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-[var(--radius-card)] border p-4 ${
        emphasis ? "border-accent/40 bg-accent-soft" : "border-border bg-surface"
      }`}
    >
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {label}
          </span>
        </div>
        <div className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight text-ink-primary">
          {value}
        </div>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
      <div className="mt-2 space-y-1">
        {delta !== undefined && (
          <TrendIndicator
            change={delta}
            suffix={deltaSuffix}
            basis={basis}
            lowerIsBetter={lowerIsBetter}
          />
        )}
        {caveat && <p className="text-[11px] leading-snug text-ink-muted">{caveat}</p>}
        {footer}
      </div>
    </div>
  );
}
