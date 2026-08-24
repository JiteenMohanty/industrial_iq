import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { computeKpis } from "@/lib/analytics/kpis";
import { computeMonthlyTrend } from "@/lib/analytics/trends";
import { runInsights } from "@/lib/insights/engine";
import { formatCurrency, formatCount, formatPercent, formatDelta } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { TrendChart } from "@/components/charts/TrendChart";
import { ComparisonBar, type BranchComparisonRow } from "@/components/charts/ComparisonBar";
import { buildHref } from "@/lib/filters/parse";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const dataset = getDataset();
  const filters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);

  const kpis = computeKpis(ctx);
  const insights = runInsights(ctx);
  const trend = computeMonthlyTrend(ctx);
  const expanded = urlParams.get("insights") === "all";

  const branchRows: BranchComparisonRow[] = dataset.branches.map((branch) => {
    const branchDeliveries = ctx.groupDeliveries.filter((d) => d.lead.branchId === branch.id);
    const deliveredUnits = branchDeliveries.length;
    const deliveredRevenue = branchDeliveries.reduce((sum, d) => sum + d.lead.dealValue, 0);
    const targetTotal = dataset.months.reduce((sum, month) => {
      const target = dataset.targetsByBranchMonth.get(`${branch.id}:${month}`);
      return sum + (target?.target_units ?? 0);
    }, 0);
    const sparklinePoints = dataset.months.map(
      (month) => branchDeliveries.filter((d) => d.deliveryMonth === month).length,
    );

    return {
      branchId: branch.id,
      branchLabel: branch.label,
      href: buildHref(`/branches/${branch.id}`, filters),
      deliveredUnits,
      deliveredRevenue,
      attainmentPct: targetTotal > 0 ? (deliveredUnits / targetTotal) * 100 : null,
      sparklinePoints,
    };
  });

  return (
    <div className="space-y-8">
      <section aria-label="Headline metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
          value={kpis.conversionRate.value !== null ? formatPercent(kpis.conversionRate.value) : "No data"}
          deltaText={formatDelta(kpis.conversionRate.delta, "pct")}
        />
        <StatTile
          label="Open pipeline value"
          value={
            kpis.openPipelineValue.value !== null ? formatCurrency(kpis.openPipelineValue.value) : "—"
          }
          deltaText={null}
        />
        <StatTile
          label="Target attainment"
          value={kpis.attainment.value !== null ? formatPercent(kpis.attainment.value) : "No data"}
          deltaText={null}
          caveat={kpis.attainment.caveat}
        />
      </section>

      <section aria-label="Action Center">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Action Center</h2>
        <InsightFeed insights={insights} filters={filters} expanded={expanded} pathname="/" />
      </section>

      <section aria-label="Delivery and lead trend">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Trend</h2>
        <TrendChart data={trend} />
      </section>

      <section aria-label="Branch comparison">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Branches</h2>
        <ComparisonBar rows={branchRows} />
      </section>
    </div>
  );
}
