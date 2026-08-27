import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeSourcePerformance } from "@/lib/analytics/sources";
import { computeGates } from "@/lib/analytics/gates";
import { formatCount, formatCurrency, formatPercent, formatDays } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatTile } from "@/components/ui/StatTile";
import { RankedBar } from "@/components/charts/RankedBar";
import { StatusDot } from "@/components/ui/Badge";
import { statusVsGroup } from "@/lib/analytics/benchmark";

export const metadata = { title: "Lead sources · DealerPulse" };

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx } = await resolvePage(searchParams);

  const sources = computeSourcePerformance(ctx);
  const gates = computeGates(ctx);
  const groupTdRate = gates.steps[1]?.passRatePct ?? null;

  const best = [...sources].sort(
    (a, b) => (b.revenuePerLeadRupees ?? 0) - (a.revenuePerLeadRupees ?? 0),
  )[0];
  const worst = [...sources].sort(
    (a, b) => (a.revenuePerLeadRupees ?? 0) - (b.revenuePerLeadRupees ?? 0),
  )[0];
  const efficiencySpread =
    best?.revenuePerLeadRupees && worst?.revenuePerLeadRupees
      ? best.revenuePerLeadRupees / worst.revenuePerLeadRupees
      : null;

  const maxRevPerLead = Math.max(...sources.map((s) => s.revenuePerLeadRupees ?? 0), 1);

  const columns: Column<(typeof sources)[number]>[] = [
    { header: "Source", accessor: (r) => r.label },
    {
      header: "Leads",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCount(r.totalLeads)}
          <span className="block text-[10px] text-ink-muted">
            {formatPercent(r.volumeSharePct ?? 0, 0)} of volume
          </span>
        </span>
      ),
    },
    {
      header: "Contact",
      align: "right",
      hint: "of leads",
      accessor: (r) => (r.contactRatePct === null ? "—" : formatPercent(r.contactRatePct)),
    },
    {
      header: "Test drive",
      align: "right",
      hint: "of contacted",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot status={statusVsGroup(r.testDriveRatePct, groupTdRate, r.contactedCount)} />
          {r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct)}
        </span>
      ),
    },
    {
      header: "Conversion",
      align: "right",
      hint: "of all leads",
      accessor: (r) => (r.conversionPct === null ? "—" : formatPercent(r.conversionPct)),
    },
    {
      header: "…of contacted",
      align: "right",
      hint: "neglect stripped out",
      accessor: (r) =>
        r.conversionAmongContactedPct === null
          ? "—"
          : formatPercent(r.conversionAmongContactedPct),
    },
    {
      header: "Revenue",
      align: "right",
      accessor: (r) => formatCurrency(r.revenueRupees),
    },
    {
      header: "Revenue / lead",
      align: "right",
      hint: "the efficiency figure",
      accessor: (r) => (
        <span className="block">
          {r.revenuePerLeadRupees === null ? "—" : formatCurrency(r.revenuePerLeadRupees)}
          <MetricBar value={r.revenuePerLeadRupees} max={maxRevPerLead} />
        </span>
      ),
    },
    {
      header: "Cycle",
      align: "right",
      hint: "median days",
      accessor: (r) => (r.medianCycleDays === null ? "—" : formatDays(r.medianCycleDays)),
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <SectionHeading
        title="Lead sources"
        as="h1"
        hint="Where leads come from, and what each channel is actually worth per lead supplied. Scoped by both filters, so channels compare on the same basis within whatever selection is active."
      />

      <section aria-label="Source headlines">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Best revenue / lead"
            value={best?.label ?? "—"}
            hint={
              best?.revenuePerLeadRupees
                ? `${formatCurrency(best.revenuePerLeadRupees)} per lead supplied`
                : undefined
            }
            emphasis
          />
          <StatTile
            label="Worst revenue / lead"
            value={worst?.label ?? "—"}
            hint={
              worst?.revenuePerLeadRupees
                ? `${formatCurrency(worst.revenuePerLeadRupees)} per lead supplied`
                : undefined
            }
          />
          <StatTile
            label="Efficiency spread"
            value={efficiencySpread ? `${efficiencySpread.toFixed(1)}×` : "—"}
            hint="best channel vs worst, per lead"
          />
          <StatTile
            label="Channels"
            value={formatCount(sources.length)}
            hint={`${formatCount(ctx.groupLeads.length)} leads in total`}
          />
        </div>
      </section>

      {best && worst && (
        <section aria-label="Source reading" className="grid gap-4 lg:grid-cols-2">
          <Callout tone="accent" label="Quality and neglect are different failures">
            <Figure>{worst.label}</Figure> converts{" "}
            <Figure>{formatPercent(worst.conversionPct ?? 0)}</Figure> of everything it supplies —
            but <Figure>{formatPercent(worst.conversionAmongContactedPct ?? 0)}</Figure> of the
            leads it supplies that someone actually contacted. The gap between those two numbers is
            neglect; what remains is genuine lead quality. Only the first one is the branch&apos;s
            problem to fix.
          </Callout>
          <Callout
            tone="neutral"
            label="The gate explains the ranking"
            href={buildHref("/funnel", filters)}
            linkText="See the funnel"
          >
            <Figure>{best.label}</Figure> gets{" "}
            <Figure>{formatPercent(best.testDriveRatePct ?? 0)}</Figure> of its contacted leads into
            a car; <Figure>{worst.label}</Figure> manages{" "}
            <Figure>{formatPercent(worst.testDriveRatePct ?? 0)}</Figure>. Since no lead has ever
            been delivered without a test drive, channel &ldquo;quality&rdquo; is largely a
            test-drive-rate story wearing a different name.
          </Callout>
        </section>
      )}

      <section aria-label="Source scorecard">
        <Card>
          <SectionHeading
            title="Channel scorecard"
            hint="Sorted by revenue delivered. The two conversion columns sit side by side deliberately — the difference between them is the part that is fixable by working the leads."
          />
          <DataTable
            columns={columns}
            rows={sources}
            getRowKey={(r) => r.source}
            rowHref={(r) => buildHref("/leads", filters, undefined, { source: r.source })}
            minWidth={940}
            caption="Lead source performance"
          />
        </Card>
      </section>

      <section aria-label="Source comparisons" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Revenue per lead supplied"
            hint="The figure that decides where acquisition spend should go — volume alone does not."
          />
          <RankedBar
            rows={[...sources]
              .sort((a, b) => (b.revenuePerLeadRupees ?? 0) - (a.revenuePerLeadRupees ?? 0))
              .map((s) => ({
                key: s.source,
                label: s.label,
                value: s.revenuePerLeadRupees,
                display:
                  s.revenuePerLeadRupees === null ? "—" : formatCurrency(s.revenuePerLeadRupees),
                sublabel: `${formatCount(s.totalLeads)} leads · ${formatCurrency(s.revenueRupees)} delivered`,
                href: buildHref("/leads", filters, undefined, { source: s.source }),
              }))}
          />
        </Card>

        <Card>
          <SectionHeading
            title="Test-drive rate by channel"
            hint="Share of each channel's contacted leads that reached a car — the gate that decides everything after it."
          />
          <RankedBar
            rows={[...sources]
              .sort((a, b) => (b.testDriveRatePct ?? 0) - (a.testDriveRatePct ?? 0))
              .map((s) => ({
                key: s.source,
                label: s.label,
                value: s.testDriveRatePct,
                display: s.testDriveRatePct === null ? "—" : formatPercent(s.testDriveRatePct),
                sublabel: `${formatCount(s.testDrivenCount)} of ${formatCount(s.contactedCount)} contacted`,
                status: statusVsGroup(s.testDriveRatePct, groupTdRate, s.contactedCount),
              }))}
            max={100}
          />
          <p className="mt-3 text-[11px] text-ink-muted">
            Status marks compare each channel against the group&apos;s own{" "}
            {groupTdRate === null ? "—" : formatPercent(groupTdRate)} test-drive rate.
          </p>
        </Card>
      </section>

      <section aria-label="Data caveat">
        <Callout tone="neutral" label="What this page cannot tell you">
          The dataset carries no acquisition cost, so revenue per lead is a{" "}
          <Figure>return</Figure> figure, not a return-on-spend figure. Ranking channels by
          efficiency here is sound; concluding which one to cut is not, until cost per lead is
          joined in. No cost-per-lead or ROI number is shown anywhere in this product for that
          reason.
        </Callout>
      </section>
    </div>
  );
}
