import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext, buildHref } from "@/lib/filters/parse";
import { computeStuckOrders } from "@/lib/analytics/pipeline";
import { computeDeliveryOps, computeDelayReasons, computeDeliveryByBranch } from "@/lib/analytics/deliveries";
import { computeLeadDetail } from "@/lib/analytics/leads";
import { formatCurrency, formatCount, formatDays, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { LeadTable } from "@/components/leads/LeadTable";
import { DelayReasonChart, DeliveryDaysDistribution } from "@/components/charts/StageMix";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";
import type { BranchDeliveryPerf } from "@/lib/analytics/deliveries";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const dataset = getDataset();
  const filters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);

  const stuckOrders = computeStuckOrders(ctx);
  const totalStuckValue = stuckOrders.reduce((sum, s) => sum + s.dealValueRupees, 0);
  const ops = computeDeliveryOps(ctx);
  const delayReasons = computeDelayReasons(ctx);
  const byBranch = computeDeliveryByBranch(ctx);
  const daysArray = ctx.groupDeliveries.map((d) => d.daysToDeliver);

  const baseHref = buildHref("/deliveries", filters);
  const selectedLeadId = urlParams.get("lead");
  const selectedLead = selectedLeadId ? computeLeadDetail(ctx, selectedLeadId) : null;

  const branchColumns: Column<BranchDeliveryPerf>[] = [
    { header: "Branch", accessor: (b) => b.branchLabel },
    { header: "Delivered", align: "right", accessor: (b) => formatCount(b.deliveredCount) },
    { header: "Avg days", align: "right", accessor: (b) => b.avgDays.toFixed(1) },
    { header: "Delayed", align: "right", accessor: (b) => formatPercent(b.delayedPct) },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <section aria-label="Stuck order summary" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatTile
          label="Value stuck in undelivered orders"
          value={formatCurrency(totalStuckValue)}
          deltaText={`${formatCount(stuckOrders.length)} orders placed, none delivered`}
        />
        <StatTile
          label="Average order → delivery"
          value={formatDays(Math.round(ops.avgDays))}
          deltaText={`Range: ${formatDays(ops.minDays)} – ${formatDays(ops.maxDays)}`}
        />
        <StatTile
          label="Deliveries delayed"
          value={formatPercent((ops.delayedCount / ops.totalCount) * 100)}
          deltaText={`${formatCount(ops.delayedCount)} of ${formatCount(ops.totalCount)} deliveries`}
        />
      </section>

      <section aria-label="Stuck order watchlist">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">
          Stuck-order watchlist — oldest and highest-value first
        </h2>
        {stuckOrders.length === 0 ? (
          <EmptyState
            title="No stuck orders"
            description="No orders are currently placed without a delivery under the active filters."
          />
        ) : (
          <LeadTable rows={stuckOrders} filters={filters} pathname="/deliveries" />
        )}
      </section>

      <section aria-label="Delay reasons and delivery time" className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Delay reasons</h2>
          {delayReasons.length === 0 ? (
            <EmptyState title="No delayed deliveries" />
          ) : (
            <DelayReasonChart data={delayReasons} />
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Days to deliver</h2>
          {daysArray.length === 0 ? (
            <EmptyState title="No deliveries in range" />
          ) : (
            <DeliveryDaysDistribution days={daysArray} />
          )}
        </div>
      </section>

      <section aria-label="Branch delivery performance">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Branch delivery performance</h2>
        <DataTable
          columns={branchColumns}
          rows={byBranch}
          rowKey={(b) => b.branchId}
          caption="Delivery performance by branch"
        />
      </section>

      <LeadDetailSheet lead={selectedLead} closeHref={baseHref} />
    </div>
  );
}
