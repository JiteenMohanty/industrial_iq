import Link from "next/link";
import { notFound } from "next/navigation";
import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import { computeRepDetail, computeRepPerformance } from "@/lib/analytics/reps";
import { computeFunnel } from "@/lib/analytics/funnel";
import { computeGates } from "@/lib/analytics/gates";
import { computeLeadDetail } from "@/lib/analytics/leads";
import { median } from "@/lib/analytics/benchmark";
import { formatCount, formatCurrency, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout, Figure } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Badge";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";

export default async function RepDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { repId } = await params;
  const { filters, ctx, param } = await resolvePage(searchParams);

  const detail = computeRepDetail(ctx, repId);
  if (!detail) notFound();

  const groupFunnel = computeFunnel(ctx);
  const repFunnel = computeFunnel(ctx, { repId });
  const gates = computeGates(ctx);

  const peers = computeRepPerformance(ctx).filter(
    (r) => r.branchId === detail.branchId && r.role === "sales_officer" && r.leadCount > 0,
  );
  const peerConversion = median(
    peers.map((p) => p.conversionPct).filter((v): v is number => v !== null),
  );

  const selectedLeadId = param("lead");
  const selectedLead = selectedLeadId ? computeLeadDetail(ctx, selectedLeadId) : null;
  const baseHref = buildHref(`/reps/${repId}`, filters);

  const columns: Column<(typeof detail.assignedLeads)[number]>[] = [
    { header: "Customer", accessor: (r) => r.customerName },
    { header: "Model", accessor: (r) => r.modelInterested },
    { header: "Source", accessor: (r) => <Pill>{r.source.replace(/_/g, " ")}</Pill> },
    {
      header: "Stage",
      accessor: (r) => (
        <span className="flex items-center gap-1.5">
          <Pill>{r.status === "lost" ? "lost" : r.currentStage.replace(/_/g, " ")}</Pill>
          {!r.tookTestDrive && (
            <span className="text-[10px] text-critical-ink" title="Never took a test drive">
              no test drive
            </span>
          )}
        </span>
      ),
    },
    { header: "Value", align: "right", accessor: (r) => formatCurrency(r.dealValueRupees) },
    { header: "Age", align: "right", hint: "days open", accessor: (r) => formatCount(r.ageDays) },
    {
      header: "Idle",
      align: "right",
      hint: "days since activity",
      accessor: (r) =>
        r.isOpen ? (
          <span className={r.daysSinceActivity >= 7 ? "text-critical-ink" : undefined}>
            {formatCount(r.daysSinceActivity)}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <Link href={buildHref("/reps", filters)} className="text-xs text-accent hover:underline">
          ← All reps
        </Link>
        <SectionHeading
          as="h1"
          title={detail.repName}
          hint={`${detail.role === "branch_manager" ? "Branch manager" : "Sales officer"} · ${detail.branchLabel} · joined ${detail.joined}`}
        />
      </div>

      {detail.leadCount === 0 ? (
        <Callout tone="neutral" label="No assigned leads">
          {detail.repName} holds no assigned leads in this dataset, so no rate can be calculated.
          Every branch manager in this extract is in the same position — leads are assigned only to
          sales officers. This is a real property of the data, not a loading failure.
        </Callout>
      ) : (
        <>
          <section aria-label="Rep headline metrics">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <StatTile label="Revenue" value={formatCurrency(detail.revenueRupees)} emphasis />
              <StatTile label="Assigned leads" value={formatCount(detail.leadCount)} />
              <StatTile label="Delivered" value={formatCount(detail.deliveredCount)} />
              <StatTile
                label="Contact rate"
                value={detail.contactRatePct === null ? "—" : formatPercent(detail.contactRatePct)}
                hint={
                  gates.steps[0]?.passRatePct != null
                    ? `group ${formatPercent(gates.steps[0].passRatePct)}`
                    : undefined
                }
              />
              <StatTile
                label="Test-drive rate"
                value={
                  detail.testDriveRatePct === null ? "—" : formatPercent(detail.testDriveRatePct)
                }
                hint={
                  gates.steps[1]?.passRatePct != null
                    ? `group ${formatPercent(gates.steps[1].passRatePct)}`
                    : undefined
                }
              />
              <StatTile
                label="Revenue / lead"
                value={
                  detail.revenuePerLeadRupees === null
                    ? "—"
                    : formatCurrency(detail.revenuePerLeadRupees)
                }
                hint="efficiency"
              />
            </div>
          </section>

          <section aria-label="Rep reading" className="grid gap-4 lg:grid-cols-2">
            <Callout
              tone={
                peerConversion !== null &&
                detail.conversionPct !== null &&
                detail.conversionPct < peerConversion - 10
                  ? "critical"
                  : "neutral"
              }
              label="Against branch peers"
            >
              {detail.repName} converts{" "}
              <Figure>
                {detail.conversionPct === null ? "—" : formatPercent(detail.conversionPct)}
              </Figure>{" "}
              of assigned leads. The median sales officer at {detail.branchLabel.replace(/ \(.*\)/, "")}{" "}
              converts <Figure>{peerConversion === null ? "—" : formatPercent(peerConversion)}</Figure>
              , across {formatCount(peers.length)} officers.
            </Callout>

            <Callout
              tone="neutral"
              label="Where this rep's leads stop"
              href={buildHref("/leads", filters, undefined, {
                rep: repId,
                cohort: "no_test_drive",
              })}
              linkText="See the stalled leads"
            >
              <Figure>{formatCount(detail.leadCount - Math.round((detail.contactRatePct ?? 0) / 100 * detail.leadCount))}</Figure>{" "}
              of {detail.repName}&apos;s leads were never contacted, and of those that were,{" "}
              <Figure>
                {formatPercent(100 - (detail.testDriveRatePct ?? 100))}
              </Figure>{" "}
              never reached a test drive. Both are gates rather than losses — nothing downstream can
              recover a lead stopped at either one.
            </Callout>
          </section>

          <section aria-label="Rep funnel">
            <Card>
              <SectionHeading
                title="Funnel against the group"
                hint="Each series is scaled within itself, so shape compares despite very different lead counts."
              />
              <FunnelChart group={groupFunnel} overlay={repFunnel} overlayLabel={detail.repName} />
            </Card>
          </section>

          <section aria-label="Assigned leads">
            <Card>
              <SectionHeading
                title="Assigned leads"
                hint="Every lead ever assigned — open, delivered and lost. Click a customer for the full stage-by-stage history."
              />
              <DataTable
                columns={columns}
                rows={detail.assignedLeads}
                getRowKey={(r) => r.leadId}
                rowHref={(r) =>
                  buildHref(`/reps/${repId}`, filters, undefined, { lead: r.leadId })
                }
                minWidth={840}
                caption={`Leads assigned to ${detail.repName}`}
              />
            </Card>
          </section>
        </>
      )}

      <LeadDetailSheet lead={selectedLead} closeHref={baseHref} />
    </div>
  );
}
