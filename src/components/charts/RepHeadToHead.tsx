import Link from "next/link";
import type { RepHeadToHead as HeadToHead } from "@/lib/analytics/reps";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { RankBadge } from "@/components/ui/Badge";

/**
 * Best against worst, on one metric set.
 *
 * Form choice: a two-column comparison rather than two separate cards, because the reader's
 * question is about the *difference*, and a difference is far easier to read when the two figures
 * sit on the same row against a shared scale. Rate metrics carry a proportional bar so the gap is
 * visible before the numbers are read; count and money metrics do not, because a bar comparing two
 * revenue totals just restates the ratio already printed beside it.
 *
 * The gap column is the point of the whole thing — percentage points for rates, a multiple for
 * money — so nobody has to do the subtraction themselves.
 */
export function RepHeadToHead({ data, hrefFor }: { data: HeadToHead; hrefFor: (repId: string) => string }) {
  const fmt = (value: number | null, unit: "count" | "pct" | "rupees"): string => {
    if (value === null) return "—";
    if (unit === "pct") return formatPercent(value);
    if (unit === "rupees") return formatCurrency(value);
    return formatCount(value);
  };

  return (
    <div className="scroll-x">
      <table className="w-full border-collapse text-sm" style={{ minWidth: 560 }}>
        <caption className="sr-only">
          {data.top.repName} compared with {data.bottom.repName} across the metrics that decide
          revenue per lead
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-left">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Metric
              </span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="flex items-center justify-end gap-1.5">
                <RankBadge rank={data.topRank} total={data.poolSize} />
                <Link
                  href={hrefFor(data.top.repId)}
                  className="text-sm font-semibold text-ink-primary hover:text-accent hover:underline"
                >
                  {data.top.repName}
                </Link>
              </span>
              <span className="block text-[10px] font-normal text-ink-muted">
                {data.top.branchLabel.replace(/ \(.*\)/, "")} · best
              </span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="flex items-center justify-end gap-1.5">
                <RankBadge rank={data.bottomRank} total={data.poolSize} />
                <Link
                  href={hrefFor(data.bottom.repId)}
                  className="text-sm font-semibold text-ink-primary hover:text-accent hover:underline"
                >
                  {data.bottom.repName}
                </Link>
              </span>
              <span className="block text-[10px] font-normal text-ink-muted">
                {data.bottom.branchLabel.replace(/ \(.*\)/, "")} · worst
              </span>
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Gap
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.metrics.map((m) => (
            <tr key={m.key} className="border-b border-grid last:border-0">
              <td className="px-3 py-2.5 align-top">
                <span className="block text-ink-primary">{m.label}</span>
                {m.hint && <span className="block text-[10px] text-ink-muted">{m.hint}</span>}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums">
                <span className="font-medium text-ink-primary">{fmt(m.topValue, m.unit)}</span>
                {m.topBar !== null && (
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-grid"
                  >
                    <span
                      className="block h-full rounded-full bg-good"
                      style={{ width: `${Math.min(100, m.topBar * 100)}%` }}
                    />
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums">
                <span className="font-medium text-ink-primary">{fmt(m.bottomValue, m.unit)}</span>
                {m.bottomBar !== null && (
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-grid"
                  >
                    <span
                      className="block h-full rounded-full bg-critical"
                      style={{ width: `${Math.min(100, m.bottomBar * 100)}%` }}
                    />
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-ink-secondary">
                {m.gapText}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
