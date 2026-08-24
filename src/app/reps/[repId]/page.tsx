import { notFound } from "next/navigation";
import Link from "next/link";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext, buildHref } from "@/lib/filters/parse";
import { computeRepDetail, type RepAssignedLead } from "@/lib/analytics/reps";
import { computeFunnel } from "@/lib/analytics/funnel";
import { computeLeadDetail } from "@/lib/analytics/leads";
import { formatCurrency, formatCount, formatDays, formatPercent } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

/**
 * Rep-level metrics are full-history and unfiltered by time (see `reps.ts`) — `Filters` has no rep
 * dimension, so there is no window to scope this page by even if that were desired; consistent
 * with `/branches` (the other multi/single-entity comparison surface that reads `groupLeads`).
 */
export default async function RepDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { repId } = await params;
  const dataset = getDataset();
  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const filters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);

  const detail = computeRepDetail(ctx, repId);
  if (!detail) {
    notFound();
  }

  const groupFunnel = computeFunnel(ctx);
  const repFunnel = computeFunnel(ctx, { repId });

  const basePath = `/reps/${repId}`;
  const baseHref = buildHref(basePath, filters);
  function leadHref(leadId: string): string {
    const separator = baseHref.includes("?") ? "&" : "?";
    return `${baseHref}${separator}lead=${encodeURIComponent(leadId)}`;
  }

  const selectedLeadId = urlParams.get("lead");
  const selectedLead = selectedLeadId ? computeLeadDetail(ctx, selectedLeadId) : null;

  const leadColumns: Column<RepAssignedLead>[] = [
    {
      header: "Customer",
      accessor: (l) => (
        <Link
          href={leadHref(l.leadId)}
          className="font-medium text-ink-primary hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {l.customerName}
        </Link>
      ),
    },
    { header: "Model", accessor: (l) => l.modelInterested },
    {
      header: "Status",
      accessor: (l) => (
        <Badge>
          {l.isOpen ? `Open — ${l.currentStage.replace("_", " ")}` : l.status.replace("_", " ")}
        </Badge>
      ),
    },
    { header: "Age", align: "right", accessor: (l) => formatDays(l.ageDays) },
    { header: "Value", align: "right", accessor: (l) => formatCurrency(l.dealValueRupees) },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-primary">{detail.repName}</h1>
        <p className="text-sm text-ink-secondary">
          {detail.role === "branch_manager" ? "Branch manager" : "Sales officer"} ·{" "}
          <Link href={buildHref(`/branches/${detail.branchId}`, filters)} className="text-accent hover:underline">
            {detail.branchLabel}
          </Link>
        </p>
      </div>

      <section aria-label="Rep headline metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Assigned leads" value={formatCount(detail.leadCount)} />
        <StatTile label="Delivered" value={formatCount(detail.deliveredCount)} />
        <StatTile
          label="Conversion rate"
          value={detail.conversionPct !== null ? formatPercent(detail.conversionPct) : "No data"}
        />
        <StatTile label="Open pipeline value" value={formatCurrency(detail.openPipelineValueRupees)} />
      </section>

      <section aria-label="Rep funnel against group">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">
          {detail.repName}&apos;s funnel vs. the group
        </h2>
        <FunnelChart group={groupFunnel.stages} branch={repFunnel.stages} branchLabel={detail.repName} />
      </section>

      <section aria-label="Assigned leads">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Assigned leads</h2>
        <DataTable
          columns={leadColumns}
          rows={detail.assignedLeads}
          rowKey={(l) => l.leadId}
          caption={`Every lead assigned to ${detail.repName}, oldest first`}
        />
      </section>

      <LeadDetailSheet lead={selectedLead} closeHref={baseHref} />
    </div>
  );
}
