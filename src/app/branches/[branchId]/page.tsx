import { notFound } from "next/navigation";
import Link from "next/link";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext, buildHref } from "@/lib/filters/parse";
import { computeKpis } from "@/lib/analytics/kpis";
import { computeFunnel } from "@/lib/analytics/funnel";
import { computeRepPerformance } from "@/lib/analytics/reps";
import { runInsights } from "@/lib/insights/engine";
import { formatCurrency, formatCount, formatPercent, formatDelta } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { RepPerformance } from "@/lib/analytics/reps";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

/**
 * Single-entity detail view — unlike `/branches`, this DOES respect the active time-range filter:
 * `filters.branchId` is forced to the route segment (the URL path is this page's branch, whatever
 * the query string says), which makes `ctx.leads`/`ctx.deliveries` window+branch scoped for
 * `computeKpis` (giving a real prior-period delta, same as the Overview), `ctx.detectionLeads`
 * branch-scoped-only for `runInsights` (FR-023's "its own detected problems"), and `ctx.groupLeads`
 * still the full, unfiltered group so `computeFunnel`'s overlay has the correct baseline to compare
 * against. This is exactly the scenario the three-scope `AnalyticsContext` design exists for — see
 * decision-log.md.
 */
export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { branchId } = await params;
  const dataset = getDataset();
  const branch = dataset.branchById.get(branchId);
  if (!branch) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const baseFilters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const filters = { ...baseFilters, branchId };
  const ctx = buildContext(filters);

  const kpis = computeKpis(ctx);
  const insights = runInsights(ctx);
  const groupFunnel = computeFunnel(ctx);
  const branchFunnel = computeFunnel(ctx, { branchId });
  const reps: RepPerformance[] = computeRepPerformance(ctx).filter((r) => r.branchId === branchId);
  const expanded = urlParams.get("insights") === "all";

  const repColumns: Column<RepPerformance>[] = [
    {
      header: "Rep",
      accessor: (r) => (
        <Link
          href={buildHref(`/reps/${r.repId}`, filters)}
          className="font-medium text-ink-primary hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {r.repName}
        </Link>
      ),
    },
    { header: "Role", accessor: (r) => (r.role === "branch_manager" ? "Branch manager" : "Sales officer") },
    { header: "Leads", align: "right", accessor: (r) => formatCount(r.leadCount) },
    { header: "Delivered", align: "right", accessor: (r) => formatCount(r.deliveredCount) },
    {
      header: "Conversion",
      align: "right",
      accessor: (r) => (r.conversionPct !== null ? formatPercent(r.conversionPct) : "—"),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-primary">{branch.label}</h1>
      </div>

      <section aria-label="Branch headline metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Delivered units"
          value={kpis.deliveredUnits.value !== null ? formatCount(kpis.deliveredUnits.value) : "—"}
          deltaText={formatDelta(kpis.deliveredUnits.delta, "count")}
        />
        <StatTile
          label="Delivered revenue"
          value={
            kpis.deliveredRevenue.value !== null ? formatCurrency(kpis.deliveredRevenue.value) : "—"
          }
          deltaText={formatDelta(kpis.deliveredRevenue.delta, "rupees")}
        />
        <StatTile
          label="Conversion rate"
          value={
            kpis.conversionRate.value !== null ? formatPercent(kpis.conversionRate.value) : "No data"
          }
          deltaText={formatDelta(kpis.conversionRate.delta, "pct")}
        />
        <StatTile
          label="Target attainment"
          value={kpis.attainment.value !== null ? formatPercent(kpis.attainment.value) : "No data"}
          deltaText={null}
          caveat={kpis.attainment.caveat}
        />
      </section>

      <section aria-label="Branch alerts">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Detected problems</h2>
        <InsightFeed
          insights={insights}
          filters={filters}
          expanded={expanded}
          pathname={`/branches/${branchId}`}
        />
      </section>

      <section aria-label="Branch funnel against group">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">
          {branch.name}&apos;s funnel vs. the group
        </h2>
        <FunnelChart group={groupFunnel.stages} branch={branchFunnel.stages} branchLabel={branch.name} />
      </section>

      <section aria-label="Sales reps at this branch">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Sales reps</h2>
        <DataTable
          columns={repColumns}
          rows={reps}
          rowKey={(r) => r.repId}
          caption={`Sales reps at ${branch.label}`}
        />
      </section>
    </div>
  );
}
