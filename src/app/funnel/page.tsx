import Link from "next/link";
import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeFunnel, computeStageDurations, computeLossBreakdown } from "@/lib/analytics/funnel";
import { computeGates, computeBranchGates } from "@/lib/analytics/gates";
import { formatCount, formatCurrency, formatPercent, formatDays } from "@/lib/format";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { DistributionBars } from "@/components/charts/RankedBar";
import { GateFunnel } from "@/components/charts/GateFunnel";

export const metadata = { title: "Funnel · DealerPulse" };

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx, param } = await resolvePage(searchParams);

  // Deliberately separate from the shared branch filter: narrowing the branch filter would also
  // narrow the group baseline this overlay compares against, which defeats the comparison.
  const overlayId = param("overlay");
  const overlayBranch = overlayId ? ctx.dataset.branchById.get(overlayId) : undefined;

  const group = computeFunnel(ctx);
  const overlay = overlayBranch ? computeFunnel(ctx, { branchId: overlayBranch.id }) : undefined;
  const durations = computeStageDurations(ctx);
  const loss = computeLossBreakdown(ctx);
  const gates = computeGates(ctx);
  const branchGates = computeBranchGates(ctx);

  const worstStep = [...group.stages]
    .filter((s) => s.stepConversionPct !== null)
    .sort((a, b) => (a.stepConversionPct as number) - (b.stepConversionPct as number))[0];

  const slowest = [...durations].sort((a, b) => b.medianDays - a.medianDays)[0];

  const lossColumns: Column<(typeof loss.byReason)[number]>[] = [
    { header: "Reason", accessor: (r) => r.reason },
    { header: "Leads", align: "right", accessor: (r) => formatCount(r.count) },
    {
      header: "Share",
      align: "right",
      accessor: (r) => formatPercent((r.count / Math.max(loss.totalLost, 1)) * 100, 0),
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <section aria-label="Gates">
        <SectionHeading
          title="The two gates"
          as="h1"
          hint="Full history, every branch. Contact and test drive decide the outcome before any negotiating skill applies."
        />
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
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
            <Callout tone="critical" label="Why this framing">
              Across all {formatCount(ctx.groupLeads.length)} leads, not one skipped a stage, and{" "}
              <Figure>
                {gates.noTestDriveDelivered} of {formatCount(gates.noTestDriveCount)}
              </Figure>{" "}
              contacted-but-never-test-driven leads were ever delivered. The funnel is strictly
              sequential and the test drive is the hard gate, so everything downstream is competing
              for a pool these two steps have already fixed the size of.
            </Callout>
            <Callout
              tone="neutral"
              label="Worst step"
              href={buildHref("/leads", filters, undefined, { cohort: "lost" })}
              linkText="See lost leads"
            >
              Group-wide the weakest single transition is into{" "}
              <Figure>{worstStep?.stage.replace(/_/g, " ")}</Figure> at{" "}
              <Figure>{formatPercent(worstStep?.stepConversionPct ?? 0)}</Figure>. The slowest is{" "}
              <Figure>
                {slowest?.fromStage.replace(/_/g, " ")} → {slowest?.toStage.replace(/_/g, " ")}
              </Figure>{" "}
              at a median of <Figure>{formatDays(slowest?.medianDays ?? 0)}</Figure>. Slow and leaky
              are different problems — this pairing tells them apart.
            </Callout>
          </div>
        </div>
      </section>

      <section aria-label="Conversion funnel">
        <Card>
          <SectionHeading
            title="Stage funnel"
            hint="Bar length is the population still alive at each stage; the percentage beside it is conversion from the previous stage."
            action={
              <SegmentedControl
                label="Branch overlay"
                activeKey={overlayBranch?.id ?? "none"}
                options={[
                  { key: "none", label: "Group only" },
                  ...ctx.dataset.branches.map((b) => ({
                    key: b.id,
                    label: b.name.replace(" Toyota", ""),
                    title: `Overlay ${b.label}`,
                  })),
                ]}
                hrefFor={(key) =>
                  buildHref("/funnel", filters, undefined, {
                    overlay: key === "none" ? undefined : key,
                  })
                }
              />
            }
          />
          <FunnelChart
            group={group}
            overlay={overlay}
            overlayLabel={overlayBranch?.name}
          />
          {overlayBranch && overlay && (
            <p className="mt-3 border-l-2 border-series-2 pl-3 text-xs leading-relaxed text-ink-secondary">
              {(() => {
                const gaps = overlay.stages
                  .map((s, i) => ({
                    stage: s.stage,
                    gap:
                      s.stepConversionPct !== null &&
                      group.stages[i]?.stepConversionPct !== undefined &&
                      group.stages[i]?.stepConversionPct !== null
                        ? (s.stepConversionPct as number) -
                          (group.stages[i]?.stepConversionPct as number)
                        : null,
                  }))
                  .filter((g) => g.gap !== null);
                const behind = gaps.filter((g) => (g.gap as number) < -5);
                if (behind.length === 0) {
                  return `${overlayBranch.name} tracks the group shape within 5 points at every stage.`;
                }
                if (behind.length === gaps.length) {
                  return `${overlayBranch.name} is behind the group at every single transition, by ${Math.round(
                    Math.min(...behind.map((b) => Math.abs(b.gap as number))),
                  )} to ${Math.round(
                    Math.max(...behind.map((b) => Math.abs(b.gap as number))),
                  )} points. That is not one broken stage — it is the whole branch, which points at management rather than a training gap at one step.`;
                }
                return `${overlayBranch.name} falls behind the group at ${behind
                  .map((b) => b.stage.replace(/_/g, " "))
                  .join(", ")} and tracks it elsewhere.`;
              })()}
            </p>
          )}
        </Card>
      </section>

      <section aria-label="Branch gate comparison">
        <Card>
          <SectionHeading
            title="Gate rates by branch"
            hint="Where each branch loses its leads, on the same basis."
          />
          <DataTable
            minWidth={620}
            columns={[
              { header: "Branch", accessor: (r) => r.branchName.replace(" Toyota", "") },
              { header: "Leads", align: "right", accessor: (r) => formatCount(r.leads) },
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
                accessor: (r) =>
                  r.testDriveRatePct === null ? "—" : formatPercent(r.testDriveRatePct),
              },
              {
                header: "Close",
                align: "right",
                hint: "of test-driven",
                accessor: (r) => (r.closeRatePct === null ? "—" : formatPercent(r.closeRatePct)),
              },
              {
                header: "Lost pre-test-drive",
                align: "right",
                accessor: (r) => formatCurrency(r.preTestDriveLostValueRupees),
              },
            ]}
            rows={branchGates}
            getRowKey={(r) => r.branchId}
            rowHref={(r) => buildHref(`/branches/${r.branchId}`, filters)}
            caption="Gate pass rates by branch"
          />
        </Card>
      </section>

      <section aria-label="Stage durations and loss analysis" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Time at each stage"
            hint="Median days between consecutive stages, for leads that made the transition."
          />
          <DistributionBars
            buckets={durations.map((d) => ({
              label: `${d.fromStage.replace(/_/g, " ")} → ${d.toStage.replace(/_/g, " ")}`,
              count: Math.round(d.medianDays),
            }))}
            totalLabel="Bars are median days, not lead counts."
          />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Every transition in this dataset has a hard ceiling and almost no tail — the longest
            first contact on record is 3.3 days. Real pipelines are heavily right-skewed, so the
            aging thresholds used elsewhere in this product are calibrated to a distribution that
            production data would not share.
          </p>
        </Card>

        <Card>
          <SectionHeading
            title="Why leads are lost"
            hint={`${formatCount(loss.totalLost)} losses, derived from recorded stage history rather than the flat status field.`}
          />
          <DataTable
            minWidth={360}
            columns={lossColumns}
            rows={loss.byReason}
            getRowKey={(r) => r.reason}
            caption="Loss reasons"
          />
          <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
            Treat these as weak evidence. The eight reasons are near-uniform (nothing above{" "}
            {formatPercent(
              (Math.max(...loss.byReason.map((r) => r.count)) / Math.max(loss.totalLost, 1)) * 100,
              0,
            )}
            ), and the field is not consistent with the stage reached — leads recorded as
            &ldquo;dissatisfied with test drive&rdquo; include some that never took one. The stage a
            lead died at is the reliable signal here; the stated reason is not.
          </p>
        </Card>
      </section>

      <section aria-label="Losses by stage">
        <Card>
          <SectionHeading
            title="Where losses happen"
            hint="The stage each lost lead had reached when it exited."
          />
          <DistributionBars
            buckets={loss.byStage.map((s) => ({
              label: s.stage.replace(/_/g, " "),
              count: s.count,
              tone: s.stage === "new" ? "critical" : "accent",
            }))}
            totalLabel={`${formatCount(loss.totalLost)} losses in total. The largest bucket is leads lost at "new" — before anyone spoke to them.`}
          />
          <Link
            href={buildHref("/leads", filters, undefined, { cohort: "never_contacted" })}
            className="mt-3 inline-block text-xs font-medium text-accent hover:underline"
          >
            View the never-contacted leads →
          </Link>
        </Card>
      </section>
    </div>
  );
}
