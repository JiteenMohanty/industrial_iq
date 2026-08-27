import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeStuckOrders, computeAgingBuckets } from "@/lib/analytics/pipeline";
import {
  computeDeliveryOps,
  computeDelayReasons,
  computeDeliveryByBranch,
  computePromiseReliability,
  computePromiseReliabilityByBranch,
  computeSlipDistribution,
} from "@/lib/analytics/deliveries";
import { computeLeadDetail } from "@/lib/analytics/leads";
import { formatCount, formatCurrency, formatDays, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Badge";
import { DistributionBars, RankedBar } from "@/components/charts/RankedBar";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";

export const metadata = { title: "Deliveries · DealerPulse" };

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx, param } = await resolvePage(searchParams);

  const stuck = computeStuckOrders(ctx);
  const aging = computeAgingBuckets(ctx);
  const ops = computeDeliveryOps(ctx);
  const delays = computeDelayReasons(ctx);
  const byBranch = computeDeliveryByBranch(ctx);
  const reliability = computePromiseReliability(ctx);
  const reliabilityByBranch = computePromiseReliabilityByBranch(ctx);
  const slip = computeSlipDistribution(ctx);

  const stuckValue = stuck.reduce((s, o) => s + o.dealValueRupees, 0);
  const oldest = stuck[0];
  const deadStuck = stuck.filter((o) => o.daysSinceOrder >= 60);
  const openPipelineValue = ctx.detectionLeads
    .filter((l) => l.isOpen)
    .reduce((s, l) => s + l.dealValue, 0);

  const worstReliability = reliabilityByBranch[reliabilityByBranch.length - 1];
  const bestReliability = reliabilityByBranch[0];
  const branchRevenue = new Map(
    ctx.dataset.branches.map((b) => [
      b.id,
      ctx.windowDeliveries
        .filter((d) => d.lead.branchId === b.id)
        .reduce((s, d) => s + d.lead.dealValue, 0),
    ]),
  );
  const topRevenueBranchId = [...branchRevenue.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const selectedLeadId = param("lead");
  const selectedLead = selectedLeadId ? computeLeadDetail(ctx, selectedLeadId) : null;
  const baseHref = buildHref("/deliveries", filters);

  const stuckColumns: Column<(typeof stuck)[number]>[] = [
    { header: "Customer", accessor: (r) => r.customerName },
    { header: "Branch", accessor: (r) => r.branchLabel.replace(/ \(.*\)/, "") },
    { header: "Model", accessor: (r) => <Pill>{r.modelInterested}</Pill> },
    {
      header: "Waiting",
      align: "right",
      hint: "days since order",
      accessor: (r) => (
        <span className={r.daysSinceOrder >= 60 ? "font-semibold text-critical-ink" : undefined}>
          {formatCount(r.daysSinceOrder)}
        </span>
      ),
    },
    { header: "Value", align: "right", accessor: (r) => formatCurrency(r.dealValueRupees) },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <SectionHeading
        title="Deliveries &amp; fulfilment"
        as="h1"
        hint="Orders placed but never handed over, how long fulfilment actually takes, and whether the group keeps the dates it quotes."
      />

      <section aria-label="Delivery headlines">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Value stuck"
            value={formatCurrency(stuckValue)}
            hint={`${formatCount(stuck.length)} orders placed, never delivered`}
            emphasis
          />
          <StatTile
            label="Oldest stuck order"
            value={oldest ? formatDays(oldest.daysSinceOrder) : "—"}
            hint={oldest ? `${oldest.customerName} · ${formatCurrency(oldest.dealValueRupees)}` : undefined}
          />
          <StatTile
            label="Order → delivery"
            value={formatDays(Math.round(ops.avgDays))}
            hint={`average · range ${ops.minDays}–${ops.maxDays} days`}
          />
          <StatTile
            label="Delivered late"
            value={reliability.latePct === null ? "—" : formatPercent(reliability.latePct, 0)}
            hint="vs the date quoted to the customer"
          />
          <StatTile
            label="Delayed deliveries"
            value={`${formatCount(ops.delayedCount)} / ${formatCount(ops.totalCount)}`}
            hint="carry a recorded delay reason"
          />
        </div>
      </section>

      <section aria-label="Delivery readings" className="grid gap-4 lg:grid-cols-3">
        <Callout
          tone="critical"
          label="These are abandoned, not late"
          href={buildHref("/leads", filters, undefined, { cohort: "stuck_orders" })}
          linkText="Work the list"
        >
          Median fulfilment is <Figure>{formatDays(Math.round(ops.avgDays))}</Figure>, yet{" "}
          <Figure>{formatCount(deadStuck.length)}</Figure> of{" "}
          <Figure>{formatCount(stuck.length)}</Figure> stuck orders have been waiting 60 days or
          more. At that age these are not deliveries running behind — they are deals nobody closed
          out.
        </Callout>

        <Callout tone="neutral" label="Half the open pipeline is these orders">
          <Figure>{formatCurrency(stuckValue)}</Figure> of the{" "}
          <Figure>{formatCurrency(openPipelineValue)}</Figure> shown as open pipeline is stuck
          orders. Read the pipeline figure with that in mind — it is not all live opportunity.
        </Callout>

        {worstReliability && bestReliability && (
          <Callout tone="neutral" label="Reliability does not follow revenue">
            <Figure>{worstReliability.branchName}</Figure> misses its promised date on{" "}
            <Figure>{formatPercent(worstReliability.latePct ?? 0, 0)}</Figure> of sales;{" "}
            <Figure>{bestReliability.branchName}</Figure> on{" "}
            <Figure>{formatPercent(bestReliability.latePct ?? 0, 0)}</Figure>.{" "}
            {worstReliability.branchId === topRevenueBranchId && (
              <>
                The least reliable branch is also the group&apos;s highest earner — a ranking that
                units and revenue alone would never surface.
              </>
            )}
          </Callout>
        )}
      </section>

      <section aria-label="Stuck order watchlist">
        <Card>
          <SectionHeading
            title="Stuck order watchlist"
            hint="Ordered by how long each has been waiting, then by value — both components are on the row so the ordering can be checked. Click a customer for the full history."
          />
          <DataTable
            columns={stuckColumns}
            rows={stuck}
            getRowKey={(r) => r.leadId}
            rowHref={(r) => buildHref("/deliveries", filters, undefined, { lead: r.leadId })}
            emptyTitle="No stuck orders"
            emptyBody="Every order placed in this selection has a matching delivery record."
            minWidth={720}
            caption="Orders placed without a delivery"
          />
        </Card>
      </section>

      <section aria-label="Aging and delay reasons" className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeading title="How long they have waited" hint="Stuck orders by age band." />
          <DistributionBars
            buckets={aging.map((b) => ({
              label: b.label,
              count: b.count,
              tone: b.label.includes("30") || b.label.includes("+") ? "critical" : "accent",
            }))}
            totalLabel={`${formatCount(stuck.length)} stuck orders in total.`}
          />
        </Card>

        <Card>
          <SectionHeading
            title="Why deliveries slip"
            hint="Recorded reason on delayed deliveries."
          />
          <DistributionBars
            buckets={delays.map((d) => ({
              label: d.reason,
              count: d.count,
              tone: d.reason.toLowerCase().includes("customer") ? "neutral" : "accent",
            }))}
            totalLabel={`${formatCount(ops.delayedCount)} of ${formatCount(ops.totalCount)} deliveries carried a delay reason.`}
          />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            The largest single reason is a customer-requested date change, and factory allocation
            and RTO registration sit outside dealership control too. &ldquo;
            {formatPercent((ops.delayedCount / Math.max(ops.totalCount, 1)) * 100, 0)} of deliveries
            delayed&rdquo; therefore overstates the group&apos;s own fault; the grey bar is the
            customer-driven share.
          </p>
        </Card>

        <Card>
          <SectionHeading
            title="Against the promised date"
            hint="Delivery date minus the close date quoted to the customer."
          />
          <DistributionBars
            buckets={slip.map((b) => ({
              label: b.label,
              count: b.count,
              tone: b.isLate ? "critical" : "good",
            }))}
            totalLabel={`${formatCount(reliability.delivered)} delivered units. Median slip ${
              reliability.medianSlipDays === null
                ? "—"
                : reliability.medianSlipDays > 0
                  ? `${reliability.medianSlipDays} days late`
                  : reliability.medianSlipDays < 0
                    ? `${Math.abs(reliability.medianSlipDays)} days early`
                    : "zero"
            }.`}
          />
        </Card>
      </section>

      <section aria-label="Branch delivery performance" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Fulfilment speed by branch"
            hint="Average days from order placed to handover."
          />
          <RankedBar
            rows={[...byBranch]
              .sort((a, b) => a.avgDays - b.avgDays)
              .map((b) => ({
                key: b.branchId,
                label: b.branchLabel.replace(/ \(.*\)/, ""),
                value: b.avgDays,
                display: formatDays(Math.round(b.avgDays)),
                sublabel: `${formatCount(b.deliveredCount)} deliveries`,
                href: buildHref(`/branches/${b.branchId}`, filters),
              }))}
          />
        </Card>

        <Card>
          <SectionHeading
            title="Promise reliability by branch"
            hint="Share of deliveries that missed the quoted close date. Lower is better."
          />
          <RankedBar
            max={100}
            rows={[...reliabilityByBranch]
              .sort((a, b) => (b.latePct ?? 0) - (a.latePct ?? 0))
              .map((b) => ({
                key: b.branchId,
                label: b.branchName.replace(" Toyota", ""),
                value: b.latePct,
                display: b.latePct === null ? "—" : formatPercent(b.latePct, 0),
                sublabel: `${formatCount(b.late)} of ${formatCount(b.delivered)} late · median ${
                  b.medianSlipDays === null
                    ? "—"
                    : b.medianSlipDays > 0
                      ? `+${b.medianSlipDays}d`
                      : `${b.medianSlipDays}d`
                }`,
                href: buildHref(`/branches/${b.branchId}`, filters),
              }))}
          />
        </Card>
      </section>

      <section aria-label="Metric definition">
        <Callout tone="neutral" label="A note on “average days to sell”">
          The classic ADS metric divides days in inventory by units sold. This dataset carries no
          inventory or stock records at all — only leads, their stage history, and delivery dates —
          so that figure cannot be computed and is not shown anywhere. The two honest analogues are
          both here and both labelled for what they measure:{" "}
          <Figure>order → delivery</Figure> ({formatDays(Math.round(ops.avgDays))} average) for
          fulfilment, and <Figure>lead → delivery</Figure> on the Overview for the full sales cycle.
        </Callout>
      </section>

      <LeadDetailSheet lead={selectedLead} closeHref={baseHref} />
    </div>
  );
}
