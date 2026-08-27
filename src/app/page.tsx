import Link from "next/link";
import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeKpis } from "@/lib/analytics/kpis";
import { computeGates, computeBranchGates } from "@/lib/analytics/gates";
import { computeRevenueTrend } from "@/lib/analytics/trends";
import { runInsights } from "@/lib/insights/engine";
import { rankBy, statusVsGroup, rate } from "@/lib/analytics/benchmark";
import { formatCurrency, formatCount, formatPercent, formatDays } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatusDot, RankBadge } from "@/components/ui/Badge";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { GateFunnel } from "@/components/charts/GateFunnel";
import { TrendChart, type TrendMetric } from "@/components/charts/TrendChart";
import { Sparkline } from "@/components/charts/Sparkline";

export const metadata = { title: "Overview · DealerPulse" };

const TREND_OPTIONS: { key: TrendMetric; label: string; title: string }[] = [
  { key: "revenue", label: "Revenue", title: "Delivered revenue by delivery month" },
  { key: "units", label: "Units", title: "Units delivered by delivery month, against target" },
  { key: "leads", label: "Leads", title: "Leads received by creation month" },
  { key: "cycle", label: "Sales cycle", title: "Median days from lead to delivery" },
];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx, param } = await resolvePage(searchParams);

  const kpis = computeKpis(ctx);
  const gates = computeGates(ctx);
  const insights = runInsights(ctx);
  const trend = computeRevenueTrend(ctx);
  const branchGates = computeBranchGates(ctx);

  const expanded = param("insights") === "all";
  const trendMetric = (TREND_OPTIONS.find((o) => o.key === param("trend"))?.key ??
    "revenue") as TrendMetric;

  // --- storytelling inputs, all derived on this render -----------------------------------
  const groupConversion = rate(
    ctx.groupLeads.filter((l) => l.reachedStages.has("delivered")).length,
    ctx.groupLeads.length,
  );
  const ranked = rankBy(branchGates, (b) => b.conversionPct, (b) => b.branchId);
  const best = ranked[0]?.row;
  const worst = ranked[ranked.length - 1]?.row;
  const rankOf = new Map(ranked.map((r) => [r.row.branchId, r.rank]));

  const biggestGateStep = [...gates.steps]
    .filter((s) => s.key !== "close")
    .sort((a, b) => b.lostValueRupees - a.lostValueRupees)[0];

  const branchRevenue = new Map(
    ctx.dataset.branches.map((b) => [
      b.id,
      ctx.groupDeliveries
        .filter((d) => d.lead.branchId === b.id)
        .reduce((s, d) => s + d.lead.dealValue, 0),
    ]),
  );
  const maxBranchRevenue = Math.max(...branchRevenue.values(), 1);

  const columns: Column<(typeof branchGates)[number]>[] = [
    {
      header: "Branch",
      accessor: (r) => (
        <span className="flex items-center gap-2">
          <RankBadge rank={rankOf.get(r.branchId) ?? 0} total={branchGates.length} />
          <span>{r.branchName.replace(" Toyota", "")}</span>
        </span>
      ),
    },
    { header: "Leads", align: "right", accessor: (r) => formatCount(r.leads) },
    {
      header: "Contact",
      align: "right",
      hint: "of leads",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot
            status={statusVsGroup(r.contactRatePct, gates.steps[0]?.passRatePct ?? null, r.leads)}
          />
          {r.contactRatePct === null ? "—" : formatPercent(r.contactRatePct)}
        </span>
      ),
    },
    {
      header: "Test drive",
      align: "right",
      hint: "of contacted",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot
            status={statusVsGroup(
              r.testDriveRatePct,
              gates.steps[1]?.passRatePct ?? null,
              r.leads,
            )}
          />
          {r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct)}
        </span>
      ),
    },
    {
      header: "Conversion",
      align: "right",
      hint: "lead → delivered",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={statusVsGroup(r.conversionPct, groupConversion, r.leads)} />
          {r.conversionPct === null ? "—" : formatPercent(r.conversionPct)}
        </span>
      ),
    },
    {
      header: "Revenue",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCurrency(branchRevenue.get(r.branchId) ?? 0)}
          <MetricBar value={branchRevenue.get(r.branchId) ?? 0} max={maxBranchRevenue} />
        </span>
      ),
    },
    {
      header: "Trend",
      align: "center",
      hint: "units/month",
      accessor: (r) => (
        <Sparkline
          label={`${r.branchName} monthly units`}
          points={ctx.dataset.months.map(
            (m) =>
              ctx.groupDeliveries.filter(
                (d) => d.deliveryMonth === m && d.lead.branchId === r.branchId,
              ).length,
          )}
        />
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* ---------------------------------------------------------------- Layer 1: position */}
      <section aria-label="Headline metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile
            label="Revenue delivered"
            value={
              kpis.deliveredRevenue.value !== null
                ? formatCurrency(kpis.deliveredRevenue.value)
                : "—"
            }
            delta={ctx.hasPriorPeriod ? (kpis.deliveredRevenue.delta?.change ?? null) : undefined}
            basis={kpis.deliveredRevenue.delta?.basis}
            emphasis
          />
          <StatTile
            label="Units delivered"
            value={
              kpis.deliveredUnits.value !== null ? formatCount(kpis.deliveredUnits.value) : "—"
            }
            delta={ctx.hasPriorPeriod ? (kpis.deliveredUnits.delta?.change ?? null) : undefined}
            basis={kpis.deliveredUnits.delta?.basis}
          />
          <StatTile
            label="Conversion"
            value={
              kpis.conversionRate.value !== null ? formatPercent(kpis.conversionRate.value) : "No data"
            }
            hint="lead → delivered"
            delta={ctx.hasPriorPeriod ? (kpis.conversionRate.delta?.change ?? null) : undefined}
            deltaSuffix="pp"
            basis={kpis.conversionRate.delta?.basis}
          />
          <StatTile
            label="Test-drive rate"
            value={
              kpis.testDriveRate.value !== null ? formatPercent(kpis.testDriveRate.value) : "No data"
            }
            hint="of contacted leads"
            delta={ctx.hasPriorPeriod ? (kpis.testDriveRate.delta?.change ?? null) : undefined}
            deltaSuffix="pp"
            basis={kpis.testDriveRate.delta?.basis}
          />
          <StatTile
            label="Sales cycle"
            value={kpis.avgCycleDays.value !== null ? formatDays(kpis.avgCycleDays.value) : "No data"}
            hint="median, lead → delivery"
            delta={ctx.hasPriorPeriod ? (kpis.avgCycleDays.delta?.change ?? null) : undefined}
            deltaSuffix="d"
            basis={kpis.avgCycleDays.delta?.basis}
            lowerIsBetter
          />
          <StatTile
            label="Target attainment"
            value={kpis.attainment.value !== null ? formatPercent(kpis.attainment.value) : "No data"}
            caveat={kpis.attainment.caveat}
          />
        </div>
        {/* SC-005 requires the absence of a comparison to be stated explicitly. Stated once here
            rather than repeated on all six tiles, where it became the loudest text on a cold open
            and drowned out the figures it was qualifying. */}
        {!ctx.hasPriorPeriod && (
          <p className="mt-2 text-[11px] text-ink-muted">
            {filters.preset === "full"
              ? "Showing the full data range, so there is no prior period to compare against. Pick a month or a rolling window in the filter bar to see period-over-period change."
              : "The period immediately before this one falls outside the data's coverage, so no comparison is shown rather than one against a partial period."}
          </p>
        )}
      </section>

      {/* ------------------------------------------------- Layer 2: the diagnosis, up front */}
      <section aria-label="Where the business is lost" className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionHeading
            title="Where the business is lost"
            hint="Every lead ever received, and the gate it died at. Whole dataset — not scoped by the time filter."
          />
          <GateFunnel
            gates={gates}
            hrefs={{
              neverContacted: buildHref("/leads", filters, undefined, {
                cohort: "never_contacted",
              }),
              noTestDrive: buildHref("/leads", filters, undefined, { cohort: "no_test_drive" }),
              notClosed: buildHref("/leads", filters, undefined, { cohort: "lost" }),
            }}
          />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Callout
            tone="critical"
            label="The headline"
            href={buildHref("/leads", filters, undefined, { cohort: "never_contacted" })}
            linkText="See the leads nobody called"
          >
            <Figure>{formatCurrency(gates.preTestDriveLostValueRupees)}</Figure> of pipeline —{" "}
            <Figure>{formatCount(gates.preTestDriveLost)}</Figure> leads,{" "}
            <Figure>{formatPercent(gates.preTestDriveLostSharePct ?? 0, 0)}</Figure> of everything
            received — died before anyone sat in a car. Since no lead in this dataset has ever been
            delivered without a test drive, that is not weak pipeline. It is closed pipeline.
          </Callout>

          <Callout tone="neutral" label="Biggest single leak">
            The <Figure>{biggestGateStep?.label.toLowerCase()}</Figure> gate loses the most:{" "}
            <Figure>{formatCount(biggestGateStep?.lost ?? 0)}</Figure> leads worth{" "}
            <Figure>{formatCurrency(biggestGateStep?.lostValueRupees ?? 0)}</Figure>. Fixing the
            gate ahead of the funnel is worth more than improving anything after it.
          </Callout>

          {best && worst && (
            <Callout
              tone="neutral"
              label="Spread"
              href={buildHref(`/branches/${worst.branchId}`, filters)}
              linkText={`Open ${worst.branchName}`}
            >
              <Figure>{best.branchName}</Figure> converts{" "}
              <Figure>{formatPercent(best.conversionPct ?? 0)}</Figure> of its leads;{" "}
              <Figure>{worst.branchName}</Figure> converts{" "}
              <Figure>{formatPercent(worst.conversionPct ?? 0)}</Figure> —{" "}
              {worst.leads > 0 && (
                <>
                  on {formatCount(worst.leads)} leads, the{" "}
                  {worst.leads === Math.min(...branchGates.map((b) => b.leads))
                    ? "smallest book in the group"
                    : "same kind of book"}
                  .
                </>
              )}
            </Callout>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------ Layer 2: what to do now */}
      <section aria-label="Action Center">
        <SectionHeading
          title="Action Center"
          hint="Rule-detected problems, ranked by severity then money at stake. Not affected by the time filter — a live problem must not disappear behind a narrow window."
        />
        <InsightFeed
          insights={insights}
          filters={filters}
          expanded={expanded}
          pathname="/"
          branchName={
            filters.branchId
              ? ctx.dataset.branchById.get(filters.branchId)?.name
              : undefined
          }
        />
      </section>

      {/* ---------------------------------------------------------------- Layer 3: direction */}
      <section aria-label="Trend over time">
        <Card>
          <SectionHeading
            title="Direction of travel"
            hint="Revenue and units on the delivery month; leads on the month they arrived. One measure at a time — never two scales on one axis."
            action={
              <SegmentedControl
                label="Trend metric"
                activeKey={trendMetric}
                options={TREND_OPTIONS}
                hrefFor={(key) => buildHref("/", filters, undefined, { trend: key })}
              />
            }
          />
          <TrendChart data={trend} metric={trendMetric} showTarget />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
            {trendMetric === "cycle"
              ? "Median days from first contact record to handover, for units delivered that month."
              : trendMetric === "units"
                ? "Dashed line is the official monthly target, shown as-is. Targets in this dataset are set at roughly seven times demonstrated capacity."
                : trendMetric === "leads"
                  ? "Leads received, on the month each was created — supply, not sales."
                  : "Revenue recognised on the delivery date, not the date the lead arrived."}
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------------- Layer 2: branch comparison */}
      <section aria-label="Branch comparison">
        <SectionHeading
          title="Branch scorecard"
          hint="Full history for every branch, so the comparison is like-for-like. Status marks are relative to the group's own figure, never an external benchmark."
          action={
            <Link
              href={buildHref("/branches", filters)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Full comparison →
            </Link>
          }
        />
        <DataTable
          columns={columns}
          rows={branchGates}
          getRowKey={(r) => r.branchId}
          rowHref={(r) => buildHref(`/branches/${r.branchId}`, filters)}
          caption="Branch performance across the two gates and overall conversion"
          minWidth={780}
        />
      </section>
    </div>
  );
}
