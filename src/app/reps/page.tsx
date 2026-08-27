import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeRepPerformance } from "@/lib/analytics/reps";
import { computeGates } from "@/lib/analytics/gates";
import { median, statusVsGroup, rankBy, rate } from "@/lib/analytics/benchmark";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatusDot, RankBadge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { RepScatter } from "@/components/charts/RepScatter";
import { RankedBar } from "@/components/charts/RankedBar";

export const metadata = { title: "Sales reps · DealerPulse" };

export default async function RepsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx } = await resolvePage(searchParams);

  const all = computeRepPerformance(ctx);
  // Branch managers hold zero leads in this dataset, so including them would put five permanent
  // "no reading" rows at the bottom of every benchmark. They are excluded from the comparison and
  // said to be excluded, rather than silently dropped.
  const officers = all.filter((r) => r.role === "sales_officer" && r.leadCount > 0);
  const managersWithoutLeads = all.filter((r) => r.role === "branch_manager" && r.leadCount === 0);

  const gates = computeGates(ctx);
  const groupContact = gates.steps[0]?.passRatePct ?? null;
  const groupTd = gates.steps[1]?.passRatePct ?? null;
  const groupConversion = rate(
    ctx.groupLeads.filter((l) => l.reachedStages.has("delivered")).length,
    ctx.groupLeads.length,
  );

  const medLeads = median(officers.map((r) => r.leadCount)) ?? 0;
  const medConversion = median(
    officers.map((r) => r.conversionPct).filter((v): v is number => v !== null),
  ) ?? 0;

  const ranked = rankBy(officers, (r) => r.revenuePerLeadRupees, (r) => r.repId);
  const rankOf = new Map(ranked.map((r) => [r.row.repId, r.rank]));
  const ordered = ranked.map((r) => r.row);

  const maxRevPerLead = Math.max(...officers.map((r) => r.revenuePerLeadRupees ?? 0), 1);
  const maxRevenue = Math.max(...officers.map((r) => r.revenueRupees), 1);

  // The two readings a ranked table cannot give you.
  const efficiencyStar = [...officers]
    .filter((r) => r.leadCount < medLeads)
    .sort((a, b) => (b.conversionPct ?? 0) - (a.conversionPct ?? 0))[0];
  const volumeNoConversion = [...officers]
    .filter((r) => r.leadCount >= medLeads)
    .sort((a, b) => (a.conversionPct ?? 0) - (b.conversionPct ?? 0))[0];
  const worstGate = [...officers]
    .filter((r) => r.contactedCount >= 5)
    .sort((a, b) => (a.testDriveRatePct ?? 100) - (b.testDriveRatePct ?? 100))[0];

  const columns: Column<(typeof officers)[number]>[] = [
    {
      header: "Rep",
      accessor: (r) => (
        <span className="flex items-center gap-2">
          <RankBadge rank={rankOf.get(r.repId) ?? 0} total={officers.length} />
          <span className="block">
            {r.repName}
            <span className="block text-[10px] font-normal text-ink-muted">
              {r.branchLabel.replace(/ \(.*\)/, "")}
            </span>
          </span>
        </span>
      ),
    },
    {
      header: "Leads",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCount(r.leadCount)}
          <MetricBar
            value={r.leadCount}
            max={Math.max(...officers.map((o) => o.leadCount))}
            tone="muted"
          />
        </span>
      ),
    },
    {
      header: "Contact",
      align: "right",
      hint: "of leads",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={statusVsGroup(r.contactRatePct, groupContact, r.leadCount)} />
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
          <StatusDot status={statusVsGroup(r.testDriveRatePct, groupTd, r.contactedCount)} />
          {r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct)}
        </span>
      ),
    },
    {
      header: "Conversion",
      align: "right",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={statusVsGroup(r.conversionPct, groupConversion, r.leadCount)} />
          {r.conversionPct === null ? "—" : formatPercent(r.conversionPct)}
        </span>
      ),
    },
    { header: "Delivered", align: "right", accessor: (r) => formatCount(r.deliveredCount) },
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
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <SectionHeading
        title="Sales rep benchmark"
        as="h1"
        hint={`${formatCount(officers.length)} sales officers in the current selection. ${
          managersWithoutLeads.length > 0
            ? `${managersWithoutLeads.length} branch managers are excluded — none holds any assigned leads in this dataset.`
            : ""
        }`}
      />

      <section aria-label="Rep headlines">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Median lead load" value={formatCount(medLeads)} hint="leads per officer" />
          <StatTile
            label="Median conversion"
            value={formatPercent(medConversion)}
            hint="across sales officers"
          />
          <StatTile
            label="Contact rate spread"
            value={`${formatPercent(
              Math.min(...officers.map((r) => r.contactRatePct ?? 100)),
              0,
            )} – ${formatPercent(Math.max(...officers.map((r) => r.contactRatePct ?? 0)), 0)}`}
            hint="worst to best officer"
          />
          <StatTile
            label="Test-drive spread"
            value={`${formatPercent(
              Math.min(...officers.map((r) => r.testDriveRatePct ?? 100)),
              0,
            )} – ${formatPercent(Math.max(...officers.map((r) => r.testDriveRatePct ?? 0)), 0)}`}
            hint="of contacted leads"
          />
        </div>
      </section>

      <section aria-label="Volume versus efficiency">
        <Card>
          <SectionHeading
            title="Volume against efficiency"
            hint="A ranked table cannot show this: sorting by revenue surfaces big books, sorting by conversion surfaces small ones, and neither reveals that those are different populations."
          />
          <RepScatter
            points={officers.map((r) => ({
              repId: r.repId,
              name: r.repName,
              branchName: r.branchLabel.replace(/ \(.*\)/, ""),
              leads: r.leadCount,
              conversionPct: r.conversionPct ?? 0,
              revenueRupees: r.revenueRupees,
              testDriveRatePct: r.testDriveRatePct,
            }))}
            medianLeads={medLeads}
            medianConversionPct={medConversion}
          />
        </Card>
      </section>

      <section aria-label="Rep readings" className="grid gap-4 lg:grid-cols-3">
        {efficiencyStar && (
          <Callout
            tone="good"
            label="Hidden by volume"
            href={buildHref(`/reps/${efficiencyStar.repId}`, filters)}
            linkText={`Open ${efficiencyStar.repName}`}
          >
            <Figure>{efficiencyStar.repName}</Figure> carries only{" "}
            <Figure>{formatCount(efficiencyStar.leadCount)}</Figure> leads — below the median load —
            yet converts <Figure>{formatPercent(efficiencyStar.conversionPct ?? 0)}</Figure> of them
            and returns{" "}
            <Figure>{formatCurrency(efficiencyStar.revenuePerLeadRupees ?? 0)}</Figure> per lead. A
            revenue leaderboard buries this rep; the question is whether they can take more volume.
          </Callout>
        )}
        {volumeNoConversion && (
          <Callout
            tone="critical"
            label="Volume without conversion"
            href={buildHref(`/reps/${volumeNoConversion.repId}`, filters)}
            linkText={`Open ${volumeNoConversion.repName}`}
          >
            <Figure>{volumeNoConversion.repName}</Figure> holds{" "}
            <Figure>{formatCount(volumeNoConversion.leadCount)}</Figure> leads at or above the
            median load but converts{" "}
            <Figure>{formatPercent(volumeNoConversion.conversionPct ?? 0)}</Figure>. Every extra
            lead routed here is worth less than the same lead routed elsewhere.
          </Callout>
        )}
        {worstGate && (
          <Callout
            tone="neutral"
            label="The coachable number"
            href={buildHref(`/reps/${worstGate.repId}`, filters)}
            linkText={`Open ${worstGate.repName}`}
          >
            <Figure>{worstGate.repName}</Figure> gets only{" "}
            <Figure>{formatPercent(worstGate.testDriveRatePct ?? 0)}</Figure> of contacted leads into
            a car, against a group rate of{" "}
            <Figure>{groupTd === null ? "—" : formatPercent(groupTd)}</Figure>. Since no lead has
            ever been delivered without a test drive, this is the single most improvable number on
            this page.
          </Callout>
        )}
      </section>

      <section aria-label="Rep benchmark table">
        <Card>
          <SectionHeading
            title="All sales officers"
            hint="Ranked by revenue per lead. Status marks compare each rep to the group's own figure; reps under 15 leads get no mark."
          />
          <DataTable
            columns={columns}
            rows={ordered}
            getRowKey={(r) => r.repId}
            rowHref={(r) => buildHref(`/reps/${r.repId}`, filters)}
            minWidth={900}
            caption="Sales rep benchmark"
          />
        </Card>
      </section>

      <section aria-label="Gate leaderboards" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Contact rate"
            hint="Share of assigned leads each rep ever contacted — the first gate."
          />
          <RankedBar
            max={100}
            rows={[...officers]
              .sort((a, b) => (a.contactRatePct ?? 0) - (b.contactRatePct ?? 0))
              .slice(0, 8)
              .map((r) => ({
                key: r.repId,
                label: r.repName,
                value: r.contactRatePct,
                display: r.contactRatePct === null ? "—" : formatPercent(r.contactRatePct),
                sublabel: `${r.branchLabel.replace(/ \(.*\)/, "")} · ${formatCount(
                  r.leadCount - r.contactedCount,
                )} never contacted`,
                status: statusVsGroup(r.contactRatePct, groupContact, r.leadCount),
                href: buildHref(`/reps/${r.repId}`, filters),
              }))}
          />
          <p className="mt-3 text-[11px] text-ink-muted">
            Eight weakest shown. Group rate {groupContact === null ? "—" : formatPercent(groupContact)}.
          </p>
        </Card>

        <Card>
          <SectionHeading
            title="Test-drive rate"
            hint="Share of each rep's contacted leads that reached a car — the second gate."
          />
          <RankedBar
            max={100}
            rows={[...officers]
              .sort((a, b) => (a.testDriveRatePct ?? 0) - (b.testDriveRatePct ?? 0))
              .slice(0, 8)
              .map((r) => ({
                key: r.repId,
                label: r.repName,
                value: r.testDriveRatePct,
                display: r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct),
                sublabel: `${r.branchLabel.replace(/ \(.*\)/, "")} · ${formatCount(
                  r.contactedCount - r.testDrivenCount,
                )} stalled at the gate`,
                status: statusVsGroup(r.testDriveRatePct, groupTd, r.contactedCount),
                href: buildHref(`/reps/${r.repId}`, filters),
              }))}
          />
          <p className="mt-3 text-[11px] text-ink-muted">
            Eight weakest shown. Group rate {groupTd === null ? "—" : formatPercent(groupTd)}.
          </p>
        </Card>
      </section>
    </div>
  );
}
