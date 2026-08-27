import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeRepPerformance, computeRepHeadToHead } from "@/lib/analytics/reps";
import { computeGates } from "@/lib/analytics/gates";
import { median, statusVsGroup, rankBy, rate, BENCHMARK } from "@/lib/analytics/benchmark";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatusDot, RankBadge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { RepScatter } from "@/components/charts/RepScatter";
import { RepHeadToHead } from "@/components/charts/RepHeadToHead";
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

  const headToHead = computeRepHeadToHead(ctx);

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

      {!headToHead && (
        <section aria-label="Top versus bottom performer">
          <Card>
            <SectionHeading title="Best against worst" />
            <EmptyState
              title={`No rep carries ${BENCHMARK.minSample} or more leads in this selection`}
              body="A best-versus-worst ranking needs enough leads at both ends to mean anything. Inside a single month the group's leads spread thinly enough across 25 officers that none clears the floor, so ranking them would be comparing a handful of leads against a handful. Widen the time range to compare."
            />
          </Card>
        </section>
      )}

      {headToHead && (
        <section aria-label="Top versus bottom performer">
          <Card>
            <SectionHeading
              title="Best against worst"
              hint={`Ranked by revenue per lead among the ${formatCount(headToHead.poolSize)} sales officers carrying ${headToHead.minSample} or more leads. Total revenue would only reward whoever was handed the biggest book; the minimum sample keeps a lucky handful of leads out of either end.`}
            />
            <RepHeadToHead
              data={headToHead}
              hrefFor={(repId) => buildHref(`/reps/${repId}`, filters)}
            />

            <div className="mt-4 grid gap-3 border-t border-grid pt-4 lg:grid-cols-2">
              <Callout tone="accent" label="Where the gap opens">
                {headToHead.widestGate ? (
                  <>
                    The widest single gap is at the{" "}
                    <Figure>{headToHead.widestGate.label}</Figure> gate —{" "}
                    <Figure>{Math.round(headToHead.widestGate.gapPoints)} points</Figure> between
                    them.{" "}
                    {headToHead.widestGate.key === "close" ? (
                      <>
                        Both reps work their leads to a test drive at broadly similar rates; the
                        difference is in what happens at the table.
                      </>
                    ) : (
                      <>
                        That is upstream of any negotiating skill. By the time either rep reaches a
                        negotiation the outcome is largely already decided, because the size of the
                        pool they are negotiating over was fixed before it.
                      </>
                    )}
                  </>
                ) : (
                  <>Not enough delivered volume at one end to locate the gap at a single gate.</>
                )}
              </Callout>

              <Callout tone="neutral" label="Like-for-like">
                {headToHead.top.repName} carries{" "}
                <Figure>{formatCount(headToHead.top.leadCount)}</Figure> leads against{" "}
                {headToHead.bottom.repName}&apos;s{" "}
                <Figure>{formatCount(headToHead.bottom.leadCount)}</Figure>
                {Math.abs(headToHead.top.leadCount - headToHead.bottom.leadCount) <= 5 ? (
                  <>
                    {" "}
                    — near-identical books, so the difference in outcome is not explained by
                    workload. Whatever separates them, it is not how many leads they were given.
                  </>
                ) : (
                  <>
                    {" "}
                    — different book sizes, which is exactly why the ranking uses revenue per lead
                    rather than revenue. The rate columns above are unaffected by book size.
                  </>
                )}
              </Callout>
            </div>
          </Card>
        </section>
      )}

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
