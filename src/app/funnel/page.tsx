import Link from "next/link";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext, buildHref } from "@/lib/filters/parse";
import { computeFunnel, computeStageDurations, computeLossBreakdown } from "@/lib/analytics/funnel";
import { computeChannelPerformance } from "@/lib/analytics/channels";
import { formatCount, formatPercent, formatDays } from "@/lib/format";
import { FunnelChart } from "@/components/charts/FunnelChart";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import type { LossReasonBucket } from "@/lib/analytics/funnel";
import type { ChannelPerformance } from "@/lib/analytics/channels";

type SearchParams = { [key: string]: string | string[] | undefined };

function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const urlParams = toURLSearchParams(resolvedSearchParams);
  const dataset = getDataset();
  const filters = parseFilters(urlParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);

  // `overlay` is deliberately separate from the shared branch filter — narrowing the branch
  // filter would also narrow the "group" baseline this chart compares against, defeating the
  // overlay's purpose (compare one branch against the whole group, not filter everything to it).
  const overlayBranchId = urlParams.get("overlay");
  const overlayBranch = overlayBranchId ? dataset.branchById.get(overlayBranchId) : undefined;

  const groupFunnel = computeFunnel(ctx);
  const branchFunnel = overlayBranchId ? computeFunnel(ctx, { branchId: overlayBranchId }) : undefined;
  const durations = computeStageDurations(ctx);
  const lossBreakdown = computeLossBreakdown(ctx);
  const channels = computeChannelPerformance(ctx);

  function overlayHref(branchId: string | null): string {
    const base = buildHref("/funnel", filters);
    if (!branchId) return base;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}overlay=${branchId}`;
  }

  const reasonColumns: Column<LossReasonBucket>[] = [
    { header: "Reason", accessor: (r) => r.reason },
    { header: "Losses", align: "right", accessor: (r) => formatCount(r.count) },
  ];

  const channelColumns: Column<ChannelPerformance>[] = [
    { header: "Channel", accessor: (c) => c.channel.replace("_", " ") },
    { header: "Leads", align: "right", accessor: (c) => formatCount(c.totalLeads) },
    { header: "Conversion", align: "right", accessor: (c) => formatPercent(c.conversionPct) },
  ];

  return (
    <div className="space-y-8">
      <section aria-label="Conversion funnel">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-primary">Conversion funnel</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-ink-secondary">Overlay branch:</span>
            <Link
              href={overlayHref(null)}
              className={`rounded-full px-2 py-1 ${!overlayBranchId ? "bg-accent text-white" : "text-accent hover:underline"}`}
            >
              None
            </Link>
            {dataset.branches.map((b) => (
              <Link
                key={b.id}
                href={overlayHref(b.id)}
                className={`rounded-full px-2 py-1 ${overlayBranchId === b.id ? "bg-accent text-white" : "text-accent hover:underline"}`}
              >
                {b.name}
              </Link>
            ))}
          </div>
        </div>
        <FunnelChart
          group={groupFunnel.stages}
          branch={branchFunnel?.stages}
          branchLabel={overlayBranch?.label}
        />
      </section>

      <section aria-label="Time spent per stage">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Typical time per stage</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {durations.map((d) => (
            <Card key={`${d.fromStage}-${d.toStage}`} className="text-center">
              <div className="text-xs text-ink-secondary">
                {d.fromStage.replace("_", " ")} → {d.toStage.replace("_", " ")}
              </div>
              <div className="tabular-nums mt-1 text-lg font-semibold text-ink-primary">
                {formatDays(Math.round(d.avgDays))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Lost reasons and channel quality" className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Why leads are lost</h2>
          <DataTable
            columns={reasonColumns}
            rows={lossBreakdown.byReason}
            rowKey={(r) => r.reason}
            caption="Loss reasons, most common first"
          />
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Channel quality</h2>
          <DataTable
            columns={channelColumns}
            rows={channels}
            rowKey={(c) => c.channel}
            caption="Conversion rate by acquisition channel"
          />
        </div>
      </section>
    </div>
  );
}
