import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import {
  computeModelPerformance,
  computeInterestMatrix,
  computeAspTrend,
  computeSeasonality,
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
  const topByUnits = [...models].sort((a, b) => b.delivered - a.delivered)[0];
  const totalUnits = models.reduce((s, m) => s + m.delivered, 0);
  const season = computeSeasonality(ctx);
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
        hint="What customers ask about, where that interest lands, and which of it turns into revenue. Scoped by both filters — shares always sum to 100% of the selection on screen."
      />

      <section aria-label="Demand headlines">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Models in range"
            value={formatCount(models.length)}
            hint={`${formatCount(totalLeads)} leads across all of them`}
          />
          <StatTile
            label="Top seller by units"
            value={topByUnits?.model ?? "—"}
            hint={
              topByUnits
                ? `${formatCount(topByUnits.delivered)} of ${formatCount(totalUnits)} units · ${formatPercent(
                    totalUnits > 0 ? (topByUnits.delivered / totalUnits) * 100 : 0,
                    0,
                  )} of everything delivered`
                : undefined
            }
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

      {/* ---------------------------------------------------------------------- Seasonality */}
      {season.peakDemand && season.peakSales && (
        <section aria-label="Seasonality">
          <Card>
            <SectionHeading
              title="When demand arrives, and when it becomes revenue"
              hint="Enquiries counted on the month they arrived; units on the month the customer took delivery. Follows the branch filter but not the time range — a seasonality view narrowed to one month would report that month as its own peak."
            />

            <div className="scroll-x">
              <table className="w-full border-collapse text-sm" style={{ minWidth: 620 }}>
                <caption className="sr-only">
                  Enquiries and units delivered by month, against the monthly mean
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="px-3 py-2 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                        Month
                      </span>
                    </th>
                    <th scope="col" className="px-3 py-2 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                        Enquiries
                      </span>
                      <span className="block text-[10px] font-normal normal-case text-ink-muted">
                        when interest arrived
                      </span>
                    </th>
                    <th scope="col" className="px-3 py-2 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                        Units delivered
                      </span>
                      <span className="block text-[10px] font-normal normal-case text-ink-muted">
                        when the car was handed over
                      </span>
                    </th>
                    <th scope="col" className="px-3 py-2 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                        Revenue
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {season.points.map((p) => {
                    const maxLeads = Math.max(...season.points.map((x) => x.leadsCreated), 1);
                    const maxUnits = Math.max(...season.points.map((x) => x.unitsDelivered), 1);
                    const isPeakDemand = p.month === season.peakDemand?.month;
                    const isPeakSales = p.month === season.peakSales?.month;
                    return (
                      <tr key={p.month} className="border-b border-grid last:border-0">
                        <td className="px-3 py-2 text-ink-primary">{p.label}</td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="w-8 shrink-0 tabular-nums text-ink-primary">
                              {formatCount(p.leadsCreated)}
                            </span>
                            <span
                              aria-hidden="true"
                              className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                            >
                              <span
                                className={`block h-full rounded-full ${isPeakDemand ? "bg-series-2" : "bg-baseline"}`}
                                style={{ width: `${(p.leadsCreated / maxLeads) * 100}%` }}
                              />
                            </span>
                            {isPeakDemand && (
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                                peak
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="w-8 shrink-0 tabular-nums text-ink-primary">
                              {formatCount(p.unitsDelivered)}
                            </span>
                            <span
                              aria-hidden="true"
                              className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                            >
                              <span
                                className={`block h-full rounded-full ${isPeakSales ? "bg-accent" : "bg-baseline"}`}
                                style={{ width: `${(p.unitsDelivered / maxUnits) * 100}%` }}
                              />
                            </span>
                            {isPeakSales && (
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                                peak
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-secondary">
                          {formatCurrency(p.revenueRupees)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 border-t border-grid pt-4 lg:grid-cols-2">
              <Callout tone="accent" label="The peak selling month">
                <Figure>{season.peakSales.label}</Figure> is comfortably the biggest month —{" "}
                <Figure>{formatCount(season.peakSales.unitsDelivered)}</Figure> cars worth{" "}
                <Figure>{formatCurrency(season.peakSales.revenueRupees)}</Figure>, about{" "}
                <Figure>
                  {formatPercent(season.peakSales.salesVsMeanPct ?? 0, 0)}
                </Figure>{" "}
                above the monthly average of{" "}
                <Figure>{formatCount(Math.round(season.meanUnitsPerMonth ?? 0))}</Figure> units.
              </Callout>

              <Callout tone="neutral" label="But demand arrived earlier">
                Enquiries peaked in <Figure>{season.peakDemand.label}</Figure> at{" "}
                <Figure>{formatCount(season.peakDemand.leadsCreated)}</Figure> leads,{" "}
                <Figure>{formatPercent(season.peakDemand.demandVsMeanPct ?? 0, 0)}</Figure> above
                average
                {season.lagMonths !== null && season.lagMonths > 0 && season.medianCycleDays !== null && (
                  <>
                    {" "}
                    — <Figure>{season.lagMonths}</Figure>{" "}
                    {season.lagMonths === 1 ? "month" : "months"} before the delivery peak, which is
                    what a median sales cycle of{" "}
                    <Figure>{formatDays(season.medianCycleDays)}</Figure> would predict. The
                    festive-quarter surge is not a December event; it is an October–November event
                    being handed over in December
                  </>
                )}
                .
              </Callout>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              Read as an operations signal rather than a marketing one: stock and delivery capacity
              need to be in place for the delivery peak, but the enquiry surge that creates it lands
              roughly {season.medianCycleDays === null ? "a month" : formatDays(season.medianCycleDays)}{" "}
              earlier, and that is when contact and test-drive capacity decide how much of it
              converts. Context this dataset does not itself contain: Diwali fell on 20 October 2025,
              inside the enquiry peak — but the elevation runs broadly across October and November
              rather than spiking in any single week, so the data supports a festive-quarter reading
              and not a single-festival one.
            </p>
          </Card>
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
