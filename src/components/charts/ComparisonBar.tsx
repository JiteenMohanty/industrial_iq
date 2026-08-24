"use client";

import Link from "next/link";
import { formatCount, formatCurrency } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Sparkline } from "./Sparkline";

export interface BranchComparisonRow {
  branchId: string;
  branchLabel: string;
  href: string;
  deliveredUnits: number;
  deliveredRevenue: number;
  attainmentPct: number | null;
  sparklinePoints: number[];
}

/**
 * Compact branch comparison table for the Overview (plan.md's "compact branch comparison table
 * with sparklines"). The full multi-metric grid lives on /branches (US4); this is a scannable
 * summary, not a duplicate of it.
 */
export function ComparisonBar({ rows }: { rows: BranchComparisonRow[] }) {
  const columns: Column<BranchComparisonRow>[] = [
    {
      header: "Branch",
      accessor: (r) => (
        <Link
          href={r.href}
          className="font-medium text-ink-primary hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {r.branchLabel}
        </Link>
      ),
    },
    {
      header: "Delivered",
      align: "right",
      accessor: (r) => formatCount(r.deliveredUnits),
    },
    {
      header: "Revenue",
      align: "right",
      accessor: (r) => formatCurrency(r.deliveredRevenue),
    },
    {
      header: "Attainment",
      align: "right",
      accessor: (r) => (r.attainmentPct !== null ? `${r.attainmentPct.toFixed(1)}%` : "—"),
    },
    {
      header: "Trend",
      accessor: (r) => <Sparkline points={r.sparklinePoints} />,
    },
  ];

  return (
    <DataTable columns={columns} rows={rows} rowKey={(r) => r.branchId} caption="Branch comparison" />
  );
}
