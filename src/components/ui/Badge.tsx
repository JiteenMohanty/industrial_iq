import type { Severity } from "@/lib/data/types";
import type { PerfStatus } from "@/lib/analytics/benchmark";
import { SEVERITY_META, STATUS_META } from "@/lib/theme";

/**
 * Severity badge — glyph plus word, never colour alone. The word is what a screen reader and a
 * greyscale printout both get; the colour is redundant reinforcement for everyone else.
 */
export function SeverityBadge({ severity }: { severity: Severity }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${meta.tint} px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.ink}`}
    >
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </span>
  );
}

/**
 * Traffic-light status against the group figure. Rendered as glyph + label so the judgement is
 * never carried by the dot alone; the accessible name always states it in words.
 *
 * `title` carries the whole comparison — the gap in percentage points, the group figure it was
 * measured against, and the sample it rests on. A glyph on its own is not self-describing, and the
 * one question this control kept raising was "ahead of what, by how much?".
 */
export function StatusDot({
  status,
  showLabel = false,
  title,
}: {
  status: PerfStatus;
  showLabel?: boolean;
  title?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${meta.ink}`}
      title={title ?? meta.label}
    >
      <span aria-hidden="true" className="text-[10px] leading-none">
        {meta.glyph}
      </span>
      <span className={showLabel ? "text-xs" : "sr-only"}>{title ?? meta.label}</span>
    </span>
  );
}

/**
 * The key for a table of benchmarked figures. Shown once beside any table that uses StatusDot,
 * because five glyphs with no legend is a puzzle rather than a signal.
 */
export function StatusLegend({ groupNote }: { groupNote?: string }) {
  const order: PerfStatus[] = ["good", "onPar", "warning", "critical", "unrated"];
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
      {order.map((s) => (
        <span key={s} className={`inline-flex items-center gap-1 ${STATUS_META[s].ink}`}>
          <span aria-hidden="true">{STATUS_META[s].glyph}</span>
          {STATUS_META[s].label}
        </span>
      ))}
      <span>
        Bands are ±5 points around the group figure, then −10 for “well behind”.
        {groupNote ? ` ${groupNote}` : ""}
      </span>
    </p>
  );
}

/** Rank chip for benchmark tables. Rank 1 is emphasised; the rest stay quiet. */
export function RankBadge({ rank, total }: { rank: number; total: number }) {
  const isTop = rank === 1;
  const isBottom = rank === total;
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[11px] font-semibold tabular-nums ${
        isTop
          ? "bg-good-soft text-good-ink"
          : isBottom
            ? "bg-critical-soft text-critical-ink"
            : "bg-raised text-ink-secondary"
      }`}
      aria-label={`Rank ${rank} of ${total}`}
    >
      {rank}
    </span>
  );
}

/** Neutral label chip — stage names, sources, models. Carries no judgement. */
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-raised px-1.5 py-0.5 text-[11px] text-ink-secondary">
      {children}
    </span>
  );
}

/**
 * Signed change indicator. `lowerIsBetter` inverts the good/bad reading without touching the sign
 * of the number — a falling sales cycle is an improvement, and the arrow must not claim otherwise.
 */
export function TrendIndicator({
  change,
  suffix = "",
  basis,
  lowerIsBetter = false,
}: {
  change: number | null;
  suffix?: string;
  basis?: string;
  lowerIsBetter?: boolean;
}) {
  if (change === null) {
    return <span className="text-xs text-ink-muted">No comparable prior period</span>;
  }
  const rounded = Math.round(change * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="text-xs text-ink-muted">
        <span aria-hidden="true">→</span> no change{basis ? ` ${basis}` : ""}
      </span>
    );
  }
  const up = rounded > 0;
  const isGood = lowerIsBetter ? !up : up;
  return (
    <span className={`text-xs ${isGood ? "text-good-ink" : "text-critical-ink"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>{" "}
      <span className="tabular-nums">
        {up ? "+" : "−"}
        {Math.abs(rounded)}
        {suffix}
      </span>
      {basis && <span className="text-ink-muted"> {basis}</span>}
    </span>
  );
}
