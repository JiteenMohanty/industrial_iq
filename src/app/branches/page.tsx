import Link from "next/link";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext, buildHref } from "@/lib/filters/parse";
import { computeBranchSparklines } from "@/lib/analytics/trends";
import { formatCurrency, formatCount, formatPercent } from "@/lib/format";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Sparkline } from "@/components/charts/Sparkline";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

interface BranchRow {
  branchId: string;
  branchLabel: string;
  href: string;
  deliveredUnits: number;
  deliveredRevenue: number;
  conversionPct: number | null;
  attainmentPct: number | null;
  openPipelineValueRupees: number;
  sparklinePoints: number[];
}

/**
 * Full-group comparison grid — deliberately unfiltered by time range, matching the convention
 * already established by `computeDeliveryByBranch`/`computeBranchSparklines`/`computeFunnel`
 * (ComparisonBar on the Overview follows the same rule): a side-by-side ranking of all five
 * branches is only meaningful measured on the same basis for every branch, and FR-022 asks for a
 * comparison, not a windowed metric. Contrast with `/branches/[branchId]`, a single-entity detail
 * view that DOES respect the time filter — see decision-log.md.
 */
export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const dataset = getDataset();
  const filters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);

  const sparklines = new Map(computeBranchSparklines(ctx).map((s) => [s.branchId, s]));

  const rows: BranchRow[] = dataset.branches.map((branch) => {
    const leads = ctx.groupLeads.filter((l) => l.branchId === branch.id);
    const deliveries = ctx.groupDeliveries.filter((d) => d.lead.branchId === branch.id);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
    const open = leads.filter((l) => l.isOpen);

    const targetTotal = dataset.months.reduce((sum, month) => {
      const target = dataset.targetsByBranchMonth.get(`${branch.id}:${month}`);
      return sum + (target?.target_units ?? 0);
    }, 0);

    return {
      branchId: branch.id,
      branchLabel: branch.label,
      href: buildHref(`/branches/${branch.id}`, filters),
      deliveredUnits: deliveries.length,
      deliveredRevenue: deliveries.reduce((sum, d) => sum + d.lead.dealValue, 0),
      conversionPct: leads.length > 0 ? (delivered.length / leads.length) * 100 : null,
      attainmentPct: targetTotal > 0 ? (deliveries.length / targetTotal) * 100 : null,
      openPipelineValueRupees: open.reduce((sum, l) => sum + l.dealValue, 0),
      sparklinePoints:
        sparklines.get(branch.id)?.points.map((p) => p.deliveredUnits) ?? [],
    };
  });

  rows.sort((a, b) => b.deliveredUnits - a.deliveredUnits);

  const columns: Column<BranchRow>[] = [
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
    { header: "Delivered", align: "right", accessor: (r) => formatCount(r.deliveredUnits) },
    { header: "Revenue", align: "right", accessor: (r) => formatCurrency(r.deliveredRevenue) },
    {
      header: "Conversion",
      align: "right",
      accessor: (r) => (r.conversionPct !== null ? formatPercent(r.conversionPct) : "—"),
    },
    {
      header: "Attainment",
      align: "right",
      accessor: (r) => (r.attainmentPct !== null ? formatPercent(r.attainmentPct) : "—"),
    },
    {
      header: "Open pipeline",
      align: "right",
      accessor: (r) => formatCurrency(r.openPipelineValueRupees),
    },
    {
      header: "Trend",
      accessor: (r) => <Sparkline points={r.sparklinePoints} />,
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <section aria-label="Branch comparison">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Branches</h2>
        <p className="mb-4 text-sm text-ink-secondary">
          All five branches on the same comparable metrics, ranked by units delivered.
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.branchId}
          caption="All branches compared on delivered units, revenue, conversion, attainment, open pipeline, and monthly delivery trend"
        />
      </section>
    </div>
  );
}
