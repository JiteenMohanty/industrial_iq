import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import {
  computeModelPerformance,
  computeInterestMatrix,
  computeAspTrend,
  heatmapHighlights,
  type HeatmapDimension,
  type HeatmapMetric,
} from "@/lib/analytics/models";
import { formatCount, formatCurrency, formatPercent, formatDays } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DataTable, type Column, MetricBar } from "@/components/ui/DataTable";
import { StatTile } from "@/components/ui/StatTile";
import { InterestHeatmap } from "@/components/charts/InterestHeatmap";
import { RankedBar } from "@/components/charts/RankedBar";

export const metadata = { title: "Demand · DealerPulse" };

const DIMENSIONS: { key: HeatmapDimension; label: string; title: string }[] = [
  { key: "branch", label: "By branch", title: "Which branch sees demand for which model" },
  { key: "source", label: "By source", title: "Which channel brings which model" },
  { key: "month", label: "By month", title: "How model interest moves through the year" },
];

const METRICS: { key: HeatmapMetric; label: string; title: string }[] = [
  { key: "volume", label: "Interest", title: "Lead volume" },
  { key: "conversion", label: "Conversion", title: "Share of leads delivered" },
  { key: "testDrive", label: "Test drives", title: "Share of contacted leads test-driven" },
];

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx, param } = await resolvePage(searchParams);

  const dimension = (DIMENSIONS.find((d) => d.key === param("by"))?.key ??
    "branch") as HeatmapDimension;
  const metric = (METRICS.find((m) => m.key === param("metric"))?.key ??
    "volume") as HeatmapMetric;

  const models = computeModelPerformance(ctx);
  const matrix = computeInterestMatrix(ctx, dimension, metric);
  const highlights = heatmapHighlights(matrix);
  const asp = computeAspTrend(ctx);

  const totalLeads = models.reduce((s, m) => s + m.leads, 0);
  const topByRevenue = models[0];
  const topByVolume = [...models].sort((a, b) => b.leads - a.leads)[0];
  const topTwoShare = models.slice(0, 2).reduce((s, m) => s + (m.revenueSharePct ?? 0), 0);

  const firstAsp = asp.find((a) => a.aspRupees !== null);
  const lastAsp = [...asp].reverse().find((a) => a.aspRupees !== null);

  const columns: Column<(typeof models)[number]>[] = [
    { header: "Model", accessor: (r) => r.model },
    {
      header: "Leads",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCount(r.leads)}
          <MetricBar value={r.leads} max={Math.max(...models.map((m) => m.leads))} tone="muted" />
        </span>
      ),
    },
    {
      header: "Test drive",
      align: "right",
      hint: "of contacted",
      accessor: (r) => (r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct)),
    },
    {
      header: "Conversion",
      align: "right",
      accessor: (r) => (r.conversionPct === null ? "—" : formatPercent(r.conversionPct)),
    },
    { header: "Delivered", align: "right", accessor: (r) => formatCount(r.delivered) },
    {
      header: "Revenue",
      align: "right",
      accessor: (r) => (
        <span className="block">
          {formatCurrency(r.revenueRupees)}
          <MetricBar value={r.revenueRupees} max={Math.max(...models.map((m) => m.revenueRupees))} />
        </span>
      ),
    },
    {
      header: "Revenue share",
      align: "right",
      accessor: (r) => (r.revenueSharePct === null ? "—" : formatPercent(r.revenueSharePct)),
    },
    {
      header: "Price band",
      align: "right",
      hint: "median",
      accessor: (r) => (r.medianPriceRupees === null ? "—" : formatCurrency(r.medianPriceRupees)),
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
        title="Customer demand"
        as="h1"
        hint="What customers ask about, where that interest lands, and which of it turns into revenue. Full history — not scoped by the time filter, so the mix is measured on the same basis throughout."
      />

      <section aria-label="Demand headlines">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Models in range"
            value={formatCount(models.length)}
            hint={`${formatCount(totalLeads)} leads across all of them`}
          />
          <StatTile
            label="Top model by revenue"
            value={topByRevenue?.model ?? "—"}
            hint={`${formatCurrency(topByRevenue?.revenueRupees ?? 0)} · ${formatPercent(
              topByRevenue?.revenueSharePct ?? 0,
              0,
            )} of group revenue`}
            emphasis
          />
          <StatTile
            label="Top model by interest"
            value={topByVolume?.model ?? "—"}
            hint={`${formatCount(topByVolume?.leads ?? 0)} leads · ${formatPercent(
              topByVolume?.revenueSharePct ?? 0,
              0,
            )} of revenue`}
          />
          <StatTile
            label="Average selling price"
            value={lastAsp?.aspRupees ? formatCurrency(lastAsp.aspRupees) : "—"}
            hint={`${lastAsp?.label ?? ""}, delivered units`}
            delta={
              firstAsp?.aspRupees && lastAsp?.aspRupees
                ? ((lastAsp.aspRupees - firstAsp.aspRupees) / firstAsp.aspRupees) * 100
                : null
            }
            deltaSuffix="%"
            basis={firstAsp ? `vs ${firstAsp.label}` : undefined}
          />
        </div>
      </section>

      {topByRevenue && topByVolume && (
        <section aria-label="Mix reading" className="grid gap-4 lg:grid-cols-2">
          <Callout tone="accent" label="Revenue is a mix problem, not only a conversion problem">
            <Figure>{topByRevenue.model}</Figure> is{" "}
            <Figure>{formatPercent((topByRevenue.leads / totalLeads) * 100, 0)}</Figure> of leads but{" "}
            <Figure>{formatPercent(topByRevenue.revenueSharePct ?? 0, 0)}</Figure> of revenue.{" "}
            <Figure>{topByVolume.model}</Figure> is the opposite —{" "}
            <Figure>{formatPercent((topByVolume.leads / totalLeads) * 100, 0)}</Figure> of leads for{" "}
            <Figure>{formatPercent(topByVolume.revenueSharePct ?? 0, 0)}</Figure> of revenue. The top
            two models alone carry <Figure>{formatPercent(topTwoShare, 0)}</Figure> of everything
            delivered, so a point of conversion is not worth the same everywhere.
          </Callout>
          <Callout tone="neutral" label="A caution on price">
            Deal value in this dataset is effectively set by the model — each one occupies a tight,
            barely-overlapping band. So average selling price reads as a{" "}
            <Figure>mix</Figure> indicator, not as discounting or negotiating skill, and it is not
            used anywhere in this product to judge a rep or a branch.
          </Callout>
        </section>
      )}

      {/* ------------------------------------------------------ The customer interest heatmap */}
      <section aria-label="Customer interest heatmap">
        <Card>
          <SectionHeading
            title="Customer interest heatmap"
            hint={`${matrix.metricLabel} for every model against ${matrix.colLabel.toLowerCase()}. Read a row for a model's demand profile, a column for a ${matrix.colLabel.toLowerCase()}'s mix.`}
            action={
              <div className="flex flex-wrap gap-2">
                <SegmentedControl
                  label="Heatmap dimension"
                  activeKey={dimension}
                  options={DIMENSIONS}
                  hrefFor={(key) =>
                    buildHref("/models", filters, undefined, { by: key, metric })
                  }
                />
                <SegmentedControl
                  label="Heatmap metric"
                  activeKey={metric}
                  options={METRICS}
                  hrefFor={(key) =>
                    buildHref("/models", filters, undefined, { by: dimension, metric: key })
                  }
                />
              </div>
            }
          />
          <InterestHeatmap matrix={matrix} />

          <div className="mt-4 border-t border-grid pt-3 text-xs leading-relaxed text-ink-secondary">
            {metric === "volume" ? (
              <>
                Strongest single pocket of demand:{" "}
                <strong className="text-ink-primary">
                  {highlights.hottest?.row} at {highlights.hottest?.col}
                </strong>{" "}
                with {formatCount(highlights.hottest?.leads ?? 0)} leads. Switch to{" "}
                <em>Conversion</em> to see whether that interest is being converted, or to{" "}
                <em>Test drives</em> to see whether it even reaches a car.
              </>
            ) : (
              <>
                {highlights.bestRated && highlights.coldestRated && (
                  <>
                    Best cell:{" "}
                    <strong className="text-ink-primary">
                      {highlights.bestRated.row} at {highlights.bestRated.col}
                    </strong>{" "}
                    ({formatPercent(highlights.bestRated.value, 0)}). Worst:{" "}
                    <strong className="text-ink-primary">
                      {highlights.coldestRated.row} at {highlights.coldestRated.col}
                    </strong>{" "}
                    ({formatPercent(highlights.coldestRated.value, 0)}). A cold cell against a model
                    with real demand at that {matrix.colLabel.toLowerCase()} is a specific, local
                    capability gap — not a group-wide problem.
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </section>

      <section aria-label="Model economics" className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeading
            title="Model economics"
            hint="Sorted by revenue delivered. Test-drive rate is measured against contacted leads, matching the gate framing used throughout."
          />
          <DataTable
            columns={columns}
            rows={models}
            getRowKey={(r) => r.model}
            minWidth={900}
            caption="Performance by vehicle model"
          />
        </Card>

        <Card>
          <SectionHeading
            title="Value stranded before a test drive"
            hint="Leads for each model that never reached a car — guaranteed zero, by model."
          />
          <RankedBar
            rows={[...models]
              .sort((a, b) => b.strandedValueRupees - a.strandedValueRupees)
              .map((m) => ({
                key: m.model,
                label: m.model,
                value: m.strandedValueRupees,
                display: formatCurrency(m.strandedValueRupees),
                sublabel: `${formatCount(m.leads - m.testDriven)} of ${formatCount(m.leads)} leads never test-driven`,
                href: buildHref("/leads", filters, undefined, {
                  cohort: "no_test_drive",
                  model: m.model,
                }),
              }))}
          />
        </Card>
      </section>
    </div>
  );
}
