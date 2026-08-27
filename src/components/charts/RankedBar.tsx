import Link from "next/link";
import { StatusDot } from "@/components/ui/Badge";
import type { PerfStatus } from "@/lib/analytics/benchmark";

export interface RankedBarRow {
  key: string;
  label: string;
  /** The encoded magnitude. Null renders as "no reading" rather than a zero-length bar. */
  value: number | null;
  /** Pre-formatted figure shown at the row end. */
  display: string;
  /** Optional second line — the context that turns a number into a finding. */
  sublabel?: string;
  status?: PerfStatus;
  href?: string;
}

/**
 * Horizontal ranked bars — the default form for "compare these entities on one measure".
 *
 * Horizontal rather than vertical because the category labels are words (branch names, model
 * names, sources) and horizontal rows give them room without rotating text. Sorted by magnitude,
 * because an unsorted comparison chart makes the reader do the ranking themselves.
 *
 * A single measure means a single hue: this is magnitude, not identity, so colouring each bar
 * differently would imply a categorical distinction that does not exist. Status, where present,
 * is carried by a separate glyph rather than by tinting the bar.
 */
export function RankedBar({
  rows,
  max,
  emptyLabel = "No data in range",
  barTone = "accent",
}: {
  rows: RankedBarRow[];
  max?: number;
  emptyLabel?: string;
  barTone?: "accent" | "neutral";
}) {
  const values = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const scaleMax = max ?? (values.length ? Math.max(...values) : 1);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => {
        const pct =
          row.value === null || scaleMax <= 0
            ? 0
            : Math.max(1.5, (row.value / scaleMax) * 100);
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                {row.status && <StatusDot status={row.status} />}
                {row.href ? (
                  <Link
                    href={row.href}
                    className="truncate font-medium text-ink-primary hover:text-accent hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-ink-primary">{row.label}</span>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink-primary">
                {row.display}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-raised">
              <div
                className={`h-full rounded-full ${barTone === "neutral" ? "bg-baseline" : "bg-accent"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {row.sublabel && (
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{row.sublabel}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface DistributionBucket {
  label: string;
  count: number;
  tone?: "accent" | "critical" | "good" | "neutral";
}

/**
 * Categorical distribution — delay reasons, delivery-time buckets, promise slip.
 * One hue by default because these are parts of one whole, not competing series; a caller can tint
 * individual buckets where a bucket carries a genuine good/bad meaning (early vs late).
 */
export function DistributionBars({
  buckets,
  totalLabel,
}: {
  buckets: DistributionBucket[];
  totalLabel?: string;
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-xs text-ink-muted">Nothing in range</p>;
  }

  const toneClass = (tone?: string) =>
    tone === "critical"
      ? "bg-critical"
      : tone === "good"
        ? "bg-good"
        : tone === "neutral"
          ? "bg-baseline"
          : "bg-accent";

  return (
    <div>
      <ul className="space-y-2">
        {buckets.map((b) => (
          <li key={b.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs text-ink-secondary">{b.label}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                  {Math.round((b.count / total) * 100)}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full ${toneClass(b.tone)}`}
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold tabular-nums text-ink-primary">{b.count}</span>
          </li>
        ))}
      </ul>
      {totalLabel && <p className="mt-3 text-[11px] text-ink-muted">{totalLabel}</p>}
    </div>
  );
}
