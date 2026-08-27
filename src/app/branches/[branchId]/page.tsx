import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeFunnel } from "@/lib/analytics/funnel";
import { computeGates, computeGatesFor } from "@/lib/analytics/gates";
import { computeRepPerformance } from "@/lib/analytics/reps";
import { computePromiseReliabilityByBranch } from "@/lib/analytics/deliveries";
import { runInsights } from "@/lib/insights/engine";
import { rate, statusVsGroup } from "@/lib/analytics/benchmark";
import { formatCount, formatCurrency, formatPercent, formatDays } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/Badge";
import { InsightFeed } from "@/components/insights/InsightFeed";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { GateFunnel } from "@/components/charts/GateFunnel";
import { RankedBar } from "@/components/charts/RankedBar";

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { branchId } = await params;
  const { filters, ctx, param } = await resolvePage(searchParams);

  const branch = ctx.dataset.branchById.get(branchId);
  if (!branch) notFound();

  const leads = ctx.dataset.leadsByBranch.get(branchId) ?? [];
  const gates = computeGatesFor(leads);
  const groupGates = computeGates(ctx);
  const branchFunnel = computeFunnel(ctx, { branchId });
  const groupFunnel = computeFunnel(ctx);

  const delivered = leads.filter((l) => l.reachedStages.has("delivered"));
  const revenue = delivered.reduce((s, l) => s + l.dealValue, 0);
  const conversionPct = rate(delivered.length, leads.length);
  const groupConversion = rate(
    ctx.groupLeads.filter((l) => l.reachedStages.has("delivered")).length,
    ctx.groupLeads.length,
  );
  const targetUnits = ctx.dataset.months.reduce(
    (s, m) => s + (ctx.dataset.targetsByBranchMonth.get(`${branchId}:${m}`)?.target_units ?? 0),
    0,
  );
  const reliability = computePromiseReliabilityByBranch(ctx).find((r) => r.branchId === branchId);

  // Alerts for this branch only — the feed reads `detectionLeads`, so a branch page must build its
  // insights from a branch-scoped context rather than filtering the group list after the fact.
  const branchInsights = runInsights({ ...ctx, detectionLeads: leads });

  const reps = computeRepPerformance(ctx).filter((r) => r.branchId === branchId);
  const expanded = param("insights") === "all";

  const modelMix = ctx.dataset.models
    .map((model) => {
      const ls = leads.filter((l) => l.modelInterested === model);
      const del = ls.filter((l) => l.reachedStages.has("delivered"));
      return {
        model,
        leads: ls.length,
        delivered: del.length,
        revenue: del.reduce((s, l) => s + l.dealValue, 0),
      };
    })
    .filter((m) => m.leads > 0);

  const repColumns: Column<(typeof reps)[number]>[] = [
    { header: "Rep", accessor: (r) => r.repName },
    { header: "Role", accessor: (r) => (r.role === "branch_manager" ? "Manager" : "Officer") },
    { header: "Leads", align: "right", accessor: (r) => formatCount(r.leadCount) },
    {
      header: "Contact",
      align: "right",
      hint: "of leads",
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusDot
            status={statusVsGroup(r.contactRatePct, groupGates.steps[0]?.passRatePct ?? null, r.leadCount)}
          />
          {r.contactRatePct === null ? "—" : formatPercent(r.contactRatePct)}
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
    { header: "Delivered", align: "right", accessor: (r) => formatCount(r.deliveredCount) },
    { header: "Revenue", align: "right", accessor: (r) => formatCurrency(r.revenueRupees) },
  ];

  const worstGap = branchFunnel.stages
    .map((s, i) => ({
      stage: s.stage,
      gap:
        s.stepConversionPct !== null && groupFunnel.stages[i]?.stepConversionPct != null
          ? s.stepConversionPct - (groupFunnel.stages[i]?.stepConversionPct as number)
          : null,
    }))
    .filter((g) => g.gap !== null)
    .sort((a, b) => (a.gap as number) - (b.gap as number))[0];

  const behindEverywhere = branchFunnel.stages
    .map((s, i) =>
      s.stepConversionPct !== null && groupFunnel.stages[i]?.stepConversionPct != null
        ? s.stepConversionPct - (groupFunnel.stages[i]?.stepConversionPct as number)
        : null,
    )
    .filter((g): g is number => g !== null)
    .every((g) => g < -5);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link href={buildHref("/branches", filters)} className="text-xs text-accent hover:underline">
          ← All branches
        </Link>
        <SectionHeading
          as="h1"
          title={branch.name}
          hint={`${branch.city} · ${formatCount(leads.length)} leads across the full history. Headline tiles below use the full history so this page compares cleanly against the group.`}
        />
      </div>

      <section aria-label="Branch headline metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Revenue" value={formatCurrency(revenue)} emphasis />
          <StatTile label="Units delivered" value={formatCount(delivered.length)} />
          <StatTile
            label="Conversion"
            value={conversionPct === null ? "No data" : formatPercent(conversionPct)}
            hint={groupConversion !== null ? `group ${formatPercent(groupConversion)}` : undefined}
          />
          <StatTile
            label="Contact rate"
            value={
              gates.steps[0]?.passRatePct === null || gates.steps[0]?.passRatePct === undefined
                ? "No data"
                : formatPercent(gates.steps[0].passRatePct)
            }
            hint={
              groupGates.steps[0]?.passRatePct != null
                ? `group ${formatPercent(groupGates.steps[0].passRatePct)}`
                : undefined
            }
          />
          <StatTile
            label="Test-drive rate"
            value={
              gates.steps[1]?.passRatePct == null ? "No data" : formatPercent(gates.steps[1].passRatePct)
            }
            hint={
              groupGates.steps[1]?.passRatePct != null
                ? `group ${formatPercent(groupGates.steps[1].passRatePct)}`
                : undefined
            }
          />
          <StatTile
            label="Target attainment"
            value={
              rate(delivered.length, targetUnits) === null
                ? "No data"
                : formatPercent(rate(delivered.length, targetUnits) as number)
            }
            caveat={`Official target ${formatCount(targetUnits)} units — set far above demonstrated capacity across every branch.`}
          />
        </div>
      </section>

      <section aria-label="Branch alerts">
        <SectionHeading
          title="Detected problems"
          hint="Rules evaluated against this branch's current state, regardless of the time filter."
        />
        <InsightFeed
          insights={branchInsights}
          filters={filters}
          expanded={expanded}
          pathname={`/branches/${branchId}`}
          branchName={branch.name}
        />
      </section>

      <section aria-label="Branch gates and funnel" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Where this branch loses leads" hint="Its own three gates." />
          <GateFunnel
            gates={gates}
            hrefs={{
              neverContacted: buildHref("/leads", filters, undefined, {
                cohort: "never_contacted",
                branch: branchId,
              }),
              noTestDrive: buildHref("/leads", filters, undefined, {
                cohort: "no_test_drive",
                branch: branchId,
              }),
              notClosed: buildHref("/leads", filters, undefined, {
                cohort: "lost",
                branch: branchId,
              }),
            }}
          />
        </Card>

        <Card>
          <SectionHeading
            title="Funnel against the group"
            hint="Each series is scaled within itself, so shape compares directly despite different lead volumes."
          />
          <FunnelChart group={groupFunnel} overlay={branchFunnel} overlayLabel={branch.name} />
          {worstGap && (
            <p className="mt-3 border-l-2 border-series-2 pl-3 text-xs leading-relaxed text-ink-secondary">
              {behindEverywhere ? (
                <>
                  {branch.name} converts below the group at{" "}
                  <strong className="text-ink-primary">every single transition</strong>. That is not
                  a leak at one stage — a uniform shortfall across the whole journey points at how
                  the branch is run, not at a training gap in one skill.
                </>
              ) : (
                <>
                  Widest gap:{" "}
                  <strong className="text-ink-primary">
                    {worstGap.stage.replace(/_/g, " ")}
                  </strong>
                  , {Math.abs(Math.round(worstGap.gap as number))} points{" "}
                  {(worstGap.gap as number) < 0 ? "below" : "above"} the group.
                </>
              )}
            </p>
          )}
        </Card>
      </section>

      <section aria-label="Reps at this branch">
        <Card>
          <SectionHeading
            title="Sales reps"
            hint="Contact rate and test-drive rate are the coachable numbers; conversion is the scoreboard."
          />
          <DataTable
            columns={repColumns}
            rows={reps}
            getRowKey={(r) => r.repId}
            rowHref={(r) => buildHref(`/reps/${r.repId}`, filters)}
            minWidth={760}
            caption={`Reps at ${branch.name}`}
          />
        </Card>
      </section>

      <section aria-label="Branch model mix and reliability" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Model mix" hint="Which vehicles this branch's customers ask about." />
          <RankedBar
            rows={[...modelMix]
              .sort((a, b) => b.leads - a.leads)
              .map((m) => ({
                key: m.model,
                label: m.model,
                value: m.leads,
                display: formatCount(m.leads),
                sublabel: `${formatCount(m.delivered)} delivered · ${formatCurrency(m.revenue)}`,
                href: buildHref("/leads", filters, undefined, {
                  branch: branchId,
                  model: m.model,
                }),
              }))}
          />
        </Card>

        <Card>
          <SectionHeading
            title="Promise reliability"
            hint="Delivered vs the close date quoted to the customer."
          />
          {reliability && reliability.delivered > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Delivered late"
                  value={reliability.latePct === null ? "—" : formatPercent(reliability.latePct, 0)}
                  hint={`${formatCount(reliability.late)} of ${formatCount(reliability.delivered)} sales`}
                />
                <StatTile
                  label="Typical slip"
                  value={
                    reliability.medianSlipDays === null
                      ? "—"
                      : reliability.medianSlipDays > 0
                        ? `${formatDays(reliability.medianSlipDays)} late`
                        : reliability.medianSlipDays < 0
                          ? `${formatDays(Math.abs(reliability.medianSlipDays))} early`
                          : "On the day"
                  }
                  hint="median across delivered units"
                />
              </div>
              <Callout tone="neutral">
                Revenue is already banked on these — what is at risk is repeat business and
                referral, which this dataset cannot price. No rupee figure is attached for that
                reason.
              </Callout>
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-ink-muted">
              Too few delivered units at this branch to read reliability.
            </p>
          )}
        </Card>
      </section>

      <section aria-label="Branch pipeline value">
        <Callout
          tone={gates.preTestDriveLostValueRupees > 0 ? "critical" : "neutral"}
          label="Pipeline lost before a test drive"
          href={buildHref("/leads", filters, undefined, {
            cohort: "never_contacted",
            branch: branchId,
          })}
          linkText="Work the list"
        >
          <Figure>{formatCurrency(gates.preTestDriveLostValueRupees)}</Figure> across{" "}
          <Figure>{formatCount(gates.preTestDriveLost)}</Figure> leads at {branch.name} never
          reached a car —{" "}
          <Figure>{formatPercent(gates.preTestDriveLostSharePct ?? 0, 0)}</Figure> of everything the
          branch received.
        </Callout>
      </section>
    </div>
  );
}
