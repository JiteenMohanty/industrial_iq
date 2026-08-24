import Link from "next/link";
import type { StuckOrder } from "@/lib/analytics/pipeline";
import { formatCurrency, formatDays } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { buildHref } from "@/lib/filters/parse";
import type { Filters } from "@/lib/filters/types";

/**
 * Stuck-order watchlist. Rows drill to the branch detail page for now — the per-lead detail
 * sheet (LeadDetailSheet, Phase 6/US4) is the eventual finest-grained target; until that phase
 * lands, this is the same pattern every insight href already uses.
 */
export function LeadTable({ rows, filters }: { rows: StuckOrder[]; filters: Filters }) {
  const columns: Column<StuckOrder>[] = [
    {
      header: "Customer",
      accessor: (r) => (
        <Link
          href={buildHref(`/branches/${r.branchId}`, filters)}
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
