import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeBranchGates } from "@/lib/analytics/gates";
import { computePromiseReliabilityByBranch } from "@/lib/analytics/deliveries";
import { rankBy, statusVsGroup, rate } from "@/lib/analytics/benchmark";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatusDot, RankBadge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/Sparkline";
import { RankedBar } from "@/components/charts/RankedBar";

export const metadata = { title: "Branches · DealerPulse" };

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx } = await resolvePage(searchParams);

  const gates = computeBranchGates(ctx);
  const reliability = new Map(
    computePromiseReliabilityByBranch(ctx).map((r) => [r.branchId, r]),
  );

  // Baselines come from windowLeads — all branches, same time range as the rows themselves — so a
  // status mark compares like with like when the reader narrows to a month.
  const groupConversion = rate(
    ctx.windowLeads.filter((l) => l.reachedStages.has("delivered")).length,
    ctx.windowLeads.length,
  );
  const groupContact = rate(
    ctx.windowLeads.filter((l) => l.wasContacted).length,
    ctx.windowLeads.length,
  );
  const groupTd = rate(
    ctx.windowLeads.filter((l) => l.tookTestDrive).length,
    ctx.windowLeads.filter((l) => l.wasContacted).length,
  );

  interface Row {
    branchId: string;
    branchName: string;
    city: string;
    leads: number;
    contactRatePct: number | null;
    testDriveRatePct: number | null;
    conversionPct: number | null;
    delivered: number;
    revenueRupees: number;
    revenuePerLeadRupees: number | null;
    targetUnits: number;
    attainmentPct: number | null;
    latePct: number | null;
    stuck: number;
    sparkline: number[];
  }

  const rows: Row[] = gates.map((g) => {
    const branch = ctx.dataset.branchById.get(g.branchId);
    const leads = ctx.windowLeads.filter((l) => l.branchId === g.branchId);
    const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
    const revenue = delivered.reduce((s, l) => s + l.dealValue, 0);
    const targetUnits = ctx.dataset.months.reduce(
      (s, m) => s + (ctx.dataset.targetsByBranchMonth.get(`${g.branchId}:${m}`)?.target_units ?? 0),
      0,
    );
    return {
      branchId: g.branchId,
      branchName: g.branchName,
      city: branch?.city ?? "",
      leads: g.leads,
      contactRatePct: g.contactRatePct,
      testDriveRatePct: g.testDriveRatePct,
      conversionPct: g.conversionPct,
      delivered: delivered.length,
      revenueRupees: revenue,
      revenuePerLeadRupees: leads.length === 0 ? null : revenue / leads.length,
      targetUnits,
      attainmentPct: rate(delivered.length, targetUnits),
      latePct: reliability.get(g.branchId)?.latePct ?? null,
      stuck: leads.filter((l) => l.isStuckOrder).length,
      sparkline: ctx.dataset.months.map(
        (m) =>
          ctx.groupDeliveries.filter(
            (d) => d.deliveryMonth === m && d.lead.branchId === g.branchId,
          ).length,
      ),
    };
  });

  const ranked = rankBy(rows, (r) => r.revenuePerLeadRupees, (r) => r.branchId);
  const rankOf = new Map(ranked.map((r) => [r.row.branchId, r.rank]));
  const ordered = ranked.map((r) => r.row);

  const top = ordered[0];
  const bottom = ordered[ordered.length - 1];
  const maxRevenue = Math.max(...rows.map((r) => r.revenueRupees), 1);
  const maxRevPerLead = Math.max(...rows.map((r) => r.revenuePerLeadRupees ?? 0), 1);

  // Highest-revenue branch is not necessarily the most reliable one — worth surfacing explicitly.
  const byRevenue = [...rows].sort((a, b) => b.revenueRupees - a.revenueRupees)[0];
  const leastReliable = [...rows]
    .filter((r) => r.latePct !== null)
    .sort((a, b) => (b.latePct as number) - (a.latePct as number))[0];

  const columns: Column<Row>[] = [
    {
      header: "Branch",
      accessor: (r) => (
        <span className="flex items-center gap-2">
          <RankBadge rank={rankOf.get(r.branchId) ?? 0} total={rows.length} />
          <span className="block">
            {r.branchName.replace(" Toyota", "")}
            <span className="block text-[10px] font-normal text-ink-muted">{r.city}</span>
          </span>
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
          <StatusDot status={statusVsGroup(r.contactRatePct, groupContact, r.leads)} />
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
          <StatusDot status={statusVsGroup(r.testDriveRatePct, groupTd, r.leads)} />
          {r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct)}
        </span>
      ),
    },
    {
      header: "Conversion",
      align: "right",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={statusVsGroup(r.conversionPct, groupConversion, r.leads)} />
          {r.conversionPct === null ? "—" : formatPercent(r.conversionPct)}
        </span>
      ),
    },
    { header: "Units", align: "right", accessor: (r) => formatCount(r.delivered) },
    {
      header: "Revenue",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCurrency(r.revenueRupees)}
          <MetricBar value={r.revenueRupees} max={maxRevenue} />
        </span>
      ),
    },
    {
      header: "Revenue / lead",
      align: "right",
      hint: "efficiency",
      accessor: (r) => (
        <span className="block">
          {r.revenuePerLeadRupees === null ? "—" : formatCurrency(r.revenuePerLeadRupees)}
          <MetricBar value={r.revenuePerLeadRupees} max={maxRevPerLead} />
        </span>
      ),
    },
    {
      header: "Late deliveries",
      align: "right",
      hint: "vs promised date",
      accessor: (r) => (r.latePct === null ? "—" : formatPercent(r.latePct, 0)),
    },
    { header: "Stuck", align: "right", hint: "orders", accessor: (r) => formatCount(r.stuck) },
    {
      header: "Units trend",
      align: "center",
      accessor: (r) => <Sparkline label={`${r.branchName} monthly units`} points={r.sparkline} />,
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <SectionHeading
        title="Branch benchmark"
        as="h1"
        hint="Every branch on the selected time range, so the comparison stays like-for-like. Ranked by revenue per lead — the efficiency figure lead volume hides. The branch filter does not narrow this page: it exists to compare branches."
      />

      <section aria-label="Branch readings" className="grid gap-4 lg:grid-cols-3">
        {top && bottom && (
          <Callout
            tone="critical"
            label="The spread"
            href={buildHref(`/branches/${bottom.branchId}`, filters)}
            linkText={`Open ${bottom.branchName}`}
          >
            <Figure>{top.branchName}</Figure> turns every lead it receives into{" "}
            <Figure>{formatCurrency(top.revenuePerLeadRupees ?? 0)}</Figure>.{" "}
            <Figure>{bottom.branchName}</Figure> turns it into{" "}
            <Figure>{formatCurrency(bottom.revenuePerLeadRupees ?? 0)}</Figure> — a{" "}
            <Figure>
              {(
                (top.revenuePerLeadRupees ?? 1) / Math.max(bottom.revenuePerLeadRupees ?? 1, 1)
              ).toFixed(1)}
              ×
            </Figure>{" "}
            gap on the same product at broadly the same price.
          </Callout>
        )}

        {byRevenue && leastReliable && (
          <Callout tone="neutral" label="Revenue and reliability are not the same ranking">
            {byRevenue.branchId === leastReliable.branchId ? (
              <>
                <Figure>{byRevenue.branchName}</Figure> is the group&apos;s biggest earner at{" "}
                <Figure>{formatCurrency(byRevenue.revenueRupees)}</Figure> and also its least
                reliable, missing its promised delivery date on{" "}
                <Figure>{formatPercent(leastReliable.latePct ?? 0, 0)}</Figure> of sales. A units
                dashboard would never show that.
              </>
            ) : (
              <>
                <Figure>{byRevenue.branchName}</Figure> earns the most (
                {formatCurrency(byRevenue.revenueRupees)}), but{" "}
                <Figure>{leastReliable.branchName}</Figure> misses its promised delivery date most
                often, on <Figure>{formatPercent(leastReliable.latePct ?? 0, 0)}</Figure> of sales.
              </>
            )}
          </Callout>
        )}

        <Callout tone="neutral" label="How to read the status marks">
          Every ▲/▼ compares a branch to the <Figure>group&apos;s own</Figure> figure on that
          metric, not to an external industry benchmark — the dataset supplies none, and inventing
          one would make the judgement unfalsifiable. Branches under 15 leads get no mark at all.
        </Callout>
      </section>

      <section aria-label="Branch comparison table">
        <Card>
          <SectionHeading title="All branches" hint="Click a branch for its own funnel, alerts, reps and model mix." />
          <DataTable
            columns={columns}
            rows={ordered}
            getRowKey={(r) => r.branchId}
            rowHref={(r) => buildHref(`/branches/${r.branchId}`, filters)}
            minWidth={1080}
            caption="Branch benchmark across gates, revenue and reliability"
          />
        </Card>
      </section>

      <section aria-label="Branch charts" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Revenue by branch" hint="Total delivered revenue, full history." />
          <RankedBar
            rows={[...rows]
              .sort((a, b) => b.revenueRupees - a.revenueRupees)
              .map((r) => ({
                key: r.branchId,
                label: r.branchName.replace(" Toyota", ""),
                value: r.revenueRupees,
                display: formatCurrency(r.revenueRupees),
                sublabel: `${formatCount(r.delivered)} units from ${formatCount(r.leads)} leads`,
                href: buildHref(`/branches/${r.branchId}`, filters),
              }))}
          />
        </Card>
        <Card>
          <SectionHeading
            title="Value lost before a test drive"
            hint="Leads that never reached a car — by branch, guaranteed zero."
          />
          <RankedBar
            rows={[...gates]
              .sort((a, b) => b.preTestDriveLostValueRupees - a.preTestDriveLostValueRupees)
              .map((g) => ({
                key: g.branchId,
                label: g.branchName.replace(" Toyota", ""),
                value: g.preTestDriveLostValueRupees,
                display: formatCurrency(g.preTestDriveLostValueRupees),
                sublabel: `contact ${g.contactRatePct === null ? "—" : formatPercent(g.contactRatePct, 0)} · test drive ${
                  g.testDriveRatePct === null ? "—" : formatPercent(g.testDriveRatePct, 0)
                }`,
                href: buildHref("/leads", filters, undefined, {
                  cohort: "never_contacted",
                  branch: g.branchId,
                }),
              }))}
          />
        </Card>
      </section>
    </div>
  );
}
