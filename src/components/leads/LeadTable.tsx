import Link from "next/link";
import type { StuckOrder } from "@/lib/analytics/pipeline";
import { formatCurrency, formatDays } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { buildHref } from "@/lib/filters/parse";
import type { Filters } from "@/lib/filters/types";

/**
 * Stuck-order watchlist. Rows open the per-lead detail sheet (LeadDetailSheet, FR-025) via a
 * `?lead=<id>` query param on the current page, which the caller must read and resolve — the same
 * pattern used everywhere else a drill-through target isn't a Filters field (cf. `/funnel`'s
 * `?overlay=`).
 */
export function LeadTable({
  rows,
  filters,
  pathname,
}: {
  rows: StuckOrder[];
  filters: Filters;
  pathname: string;
}) {
  const base = buildHref(pathname, filters);
  function leadHref(leadId: string): string {
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}lead=${encodeURIComponent(leadId)}`;
  }

  const columns: Column<StuckOrder>[] = [
    {
      header: "Customer",
      accessor: (r) => (
        <Link
          href={leadHref(r.leadId)}
          className="font-medium text-ink-primary hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {r.customerName}
        </Link>
      ),
    },
    { header: "Branch", accessor: (r) => r.branchLabel },
    { header: "Sales Rep", accessor: (r) => r.repName },
    { header: "Model", accessor: (r) => r.model },
    { header: "Age", align: "right", accessor: (r) => formatDays(r.daysSinceOrder) },
    { header: "Value", align: "right", accessor: (r) => formatCurrency(r.dealValueRupees) },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.leadId}
      caption="Stuck orders — placed but not delivered, oldest and highest-value first"
    />
  );
}
