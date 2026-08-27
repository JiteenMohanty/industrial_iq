import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  header: string;
  accessor: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** When set with `sortHref`, the header renders as a sort link. */
  sortKey?: string;
  /** Short definition shown under the header — what this column actually measures. */
  hint?: string;
  className?: string;
}

/**
 * Table primitive.
 *
 * Sorting is URL-driven rather than client state: a header is a link, the server re-queries, and
 * the sorted view is shareable and reproducible like every other view in the product (Constitution
 * VI). That also keeps this a Server Component, so no row data crosses the client boundary.
 *
 * The table scrolls inside its own container rather than widening the page, which is what keeps
 * every route free of horizontal page scroll down to tablet widths.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  emptyTitle = "Nothing to show",
  emptyBody,
  sortHref,
  activeSort,
  activeDir,
  minWidth = 640,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyBody?: string;
  sortHref?: (sortKey: string, dir: "asc" | "desc") => string;
  activeSort?: string;
  activeDir?: "asc" | "desc";
  minWidth?: number;
  caption?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="scroll-x min-w-0 rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => {
              const isActive = col.sortKey !== undefined && col.sortKey === activeSort;
              const nextDir: "asc" | "desc" = isActive && activeDir === "desc" ? "asc" : "desc";
              const align =
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                    ? "text-center"
                    : "text-left";
              return (
                <th
                  key={col.header}
                  scope="col"
                  aria-sort={
                    isActive ? (activeDir === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`px-3 py-2.5 align-bottom ${align} ${col.className ?? ""}`}
                >
                  {col.sortKey && sortHref ? (
                    <Link
                      href={sortHref(col.sortKey, nextDir)}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ink-secondary hover:text-ink-primary"
                    >
                      {col.header}
                      <span aria-hidden="true" className="text-[9px]">
                        {isActive ? (activeDir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                      {col.header}
                    </span>
                  )}
                  {col.hint && (
                    <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-ink-muted">
                      {col.hint}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={getRowKey(row, i)}
                className="border-b border-grid last:border-0 hover:bg-raised"
              >
                {columns.map((col, ci) => {
                  const align =
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                        ? "text-center"
                        : "text-left";
                  const content = col.accessor(row, i);
                  return (
                    <td
                      key={col.header}
                      className={`px-3 py-2.5 ${align} ${col.align === "right" ? "tabular-nums" : ""} ${col.className ?? ""}`}
                    >
                      {/* Only the first cell carries the row link — a whole row of nested anchors
                          is hostile to keyboard traversal and to screen-reader row navigation. */}
                      {href && ci === 0 ? (
                        <Link
                          href={href}
                          className="font-medium text-ink-primary hover:text-accent hover:underline"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Inline proportional bar for a table cell — magnitude at a glance beside the figure it encodes.
 * The number is always present; the bar is redundant reinforcement, never the only encoding.
 */
export function MetricBar({
  value,
  max,
  tone = "accent",
}: {
  value: number | null;
  max: number;
  tone?: "accent" | "critical" | "good" | "muted";
}) {
  if (value === null || max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bg =
    tone === "critical"
      ? "bg-critical"
      : tone === "good"
        ? "bg-good"
        : tone === "muted"
          ? "bg-baseline"
          : "bg-accent";
  return (
    <span
      aria-hidden="true"
      className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-grid"
    >
      <span className={`block h-full rounded-full ${bg}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
