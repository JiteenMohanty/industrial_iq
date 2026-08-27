import Link from "next/link";
import type { GateAnalysis } from "@/lib/analytics/gates";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";

/**
 * The product's signature visual: the funnel drawn as *what survives each gate*, with the value
 * that dies at each one annotated in place.
 *
 * Form choice (dataviz skill's heuristic): the job is magnitude plus attrition across an ordered
 * sequence, and the reader's question is "where does it go". Nested proportional bars answer that
 * directly — every bar shares the same left edge and the same 100% baseline, so the eye reads the
 * shrinking width as attrition without doing arithmetic. A classic tapered funnel encodes the same
 * data but makes the *lost* portion invisible, which is precisely the quantity this product exists
 * to show.
 *
 * Built in HTML/CSS rather than SVG: it reflows to any width, the labels stay real selectable text
 * at every size, and each row is a link, so the whole thing is keyboard-operable with no JS.
 */
export function GateFunnel({
  gates,
  hrefs,
}: {
  gates: GateAnalysis;
  hrefs: { neverContacted: string; noTestDrive: string; notClosed: string };
}) {
  const total = gates.totalLeads;
  const rows = [
    {
      key: "all",
      label: "Leads received",
      count: total,
      share: 100,
      lost: null as null | {
        count: number;
        value: number;
        label: string;
        href: string;
        note: string;
      },
    },
    {
      key: "contacted",
      label: "Contacted",
      count: gates.steps[0]?.passed ?? 0,
      share: ((gates.steps[0]?.passed ?? 0) / total) * 100,
      lost: {
        count: gates.steps[0]?.lost ?? 0,
        value: gates.steps[0]?.lostValueRupees ?? 0,
        label: "never contacted",
        href: hrefs.neverContacted,
        note: "Nobody ever followed up.",
      },
    },
    {
      key: "test_drive",
      label: "Took a test drive",
      count: gates.steps[1]?.passed ?? 0,
      share: ((gates.steps[1]?.passed ?? 0) / total) * 100,
      lost: {
        count: gates.steps[1]?.lost ?? 0,
        value: gates.steps[1]?.lostValueRupees ?? 0,
        label: "contacted, never test-driven",
        href: hrefs.noTestDrive,
        note: `${gates.noTestDriveDelivered} of these ${gates.noTestDriveCount} were ever delivered.`,
      },
    },
    {
      key: "delivered",
      label: "Delivered",
      count: gates.steps[2]?.passed ?? 0,
      share: ((gates.steps[2]?.passed ?? 0) / total) * 100,
      lost: {
        count: gates.steps[2]?.lost ?? 0,
        value: gates.steps[2]?.lostValueRupees ?? 0,
        label: "test-driven, did not close",
        href: hrefs.notClosed,
        note: "Reached a car but not a signature.",
      },
    },
  ];

  return (
    <div
      className="space-y-2.5"
      role="img"
      aria-label={`Lead funnel: ${formatCount(total)} leads received, ${formatCount(
        gates.steps[0]?.passed ?? 0,
      )} contacted, ${formatCount(gates.steps[1]?.passed ?? 0)} took a test drive, ${formatCount(
        gates.steps[2]?.passed ?? 0,
      )} delivered.`}
    >
      {rows.map((row, i) => (
        <div key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-ink-primary">{row.label}</span>
            <span className="tabular-nums text-ink-secondary">
              <span className="font-semibold text-ink-primary">{formatCount(row.count)}</span>
              <span className="ml-1.5 text-xs text-ink-muted">
                {formatPercent(row.share, 0)} of all leads
              </span>
            </span>
          </div>

          {/* The bar track is the full lead population; the fill is what survived to this row. */}
          <div className="mt-1 h-7 w-full overflow-hidden rounded bg-raised">
            <div
              className="flex h-full items-center rounded bg-accent"
              style={{ width: `${Math.max(row.share, 1.5)}%` }}
            />
          </div>

          {row.lost && row.lost.count > 0 && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-0.5 text-xs">
              <span aria-hidden="true" className="text-critical">
                ▼
              </span>
              <Link
                href={row.lost.href}
                className="font-medium text-critical-ink hover:underline"
              >
                {formatCount(row.lost.count)} {row.lost.label}
              </Link>
              <span className="tabular-nums text-ink-secondary">
                {formatCurrency(row.lost.value)}
              </span>
              <span className="text-ink-muted">{row.lost.note}</span>
            </div>
          )}

          {i === 2 && (
            <p className="mt-2 border-l-2 border-critical pl-3 text-xs leading-relaxed text-ink-secondary">
              The test drive is an absolute gate in this data:{" "}
              <strong className="font-semibold text-ink-primary">
                {gates.noTestDriveDelivered} of {formatCount(gates.noTestDriveCount)}
              </strong>{" "}
              contacted-but-never-test-driven leads went on to be delivered. A lead stalled above
              this line is not a weaker chance — it is already worth nothing.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
