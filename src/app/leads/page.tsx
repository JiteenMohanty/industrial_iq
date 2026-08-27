import { resolvePage, type SearchParams } from "@/lib/filters/page-context";
import { buildHref } from "@/lib/filters/parse";
import {
  queryLeads,
  computeLeadDetail,
  LEAD_COHORTS,
  type LeadCohort,
  type LeadSortKey,
} from "@/lib/analytics/leads";
import { sourceLabel } from "@/lib/analytics/sources";
import type { Source, Stage } from "@/lib/data/types";
import { formatCount, formatCurrency } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { Card, SectionHeading } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Pill } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LeadDetailSheet } from "@/components/leads/LeadDetailSheet";

export const metadata = { title: "Leads · DealerPulse" };

const SORTS: { key: LeadSortKey; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "age", label: "Age" },
  { key: "idle", label: "Idle" },
  { key: "customer", label: "Customer" },
  { key: "stage", label: "Stage" },
];

/**
 * The lead explorer — the evidence layer.
 *
 * Every alert links here with its cohort and entity already applied, which is what makes the
 * drill-down claim literally true: a manager clicking "view the 33 leads" arrives at those 33
 * leads, named, sortable, and one more click from each customer's full history. In the first
 * version this route did not exist and alerts landed on a branch summary instead.
 *
 * Scope note: this reads `detectionLeads` (branch-filtered, never time-filtered), matching the
 * alert feed exactly. A time window must never remove records an alert just counted.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { filters, ctx, param } = await resolvePage(searchParams);

  const cohort = (LEAD_COHORTS.find((c) => c.key === param("cohort"))?.key ?? "all") as LeadCohort;
  const sort = (SORTS.find((s) => s.key === param("sort"))?.key ?? "value") as LeadSortKey;
  const dir = param("dir") === "asc" ? "asc" : "desc";

  const repId = param("rep") ?? undefined;
  const model = param("model") ?? undefined;
  const source = (param("source") as Source | null) ?? undefined;
  const stage = (param("stage") as Stage | null) ?? undefined;

  const result = queryLeads(ctx, {
    cohort,
    repId,
    model,
    source,
    stage,
    sort,
    dir,
  });

  const selectedLeadId = param("lead");
  const selectedLead = selectedLeadId ? computeLeadDetail(ctx, selectedLeadId) : null;

  const keep = {
    cohort,
    rep: repId,
    model,
    source,
    stage,
    sort,
    dir,
  };
  const baseHref = buildHref("/leads", filters, undefined, keep);
  const sortHref = (key: string, nextDir: "asc" | "desc") =>
    buildHref("/leads", filters, undefined, { ...keep, sort: key, dir: nextDir });

  const rep = repId ? ctx.dataset.repById.get(repId) : undefined;
  const branch = filters.branchId ? ctx.dataset.branchById.get(filters.branchId) : undefined;

  const activeFilters = [
    branch && `Branch: ${branch.name}`,
    rep && `Rep: ${rep.name}`,
    model && `Model: ${model}`,
    source && `Source: ${sourceLabel(source)}`,
    stage && `Stage: ${stage.replace(/_/g, " ")}`,
  ].filter(Boolean) as string[];

  const columns: Column<(typeof result.rows)[number]>[] = [
    { header: "Customer", sortKey: "customer", accessor: (r) => r.customerName },
    { header: "Phone", accessor: (r) => <span className="tabular-nums">{r.phone}</span> },
    { header: "Branch", accessor: (r) => r.branchName.replace(" Toyota", "") },
    { header: "Rep", accessor: (r) => r.repName },
    { header: "Model", accessor: (r) => <Pill>{r.model}</Pill> },
    { header: "Source", accessor: (r) => <Pill>{sourceLabel(r.source)}</Pill> },
    {
      header: "Stage",
      sortKey: "stage",
      accessor: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          <Pill>{r.status === "lost" ? "lost" : r.currentStage.replace(/_/g, " ")}</Pill>
          {!r.wasContacted && (
            <span className="text-[10px] font-medium text-critical-ink">never contacted</span>
          )}
          {r.wasContacted && !r.tookTestDrive && (
            <span className="text-[10px] font-medium text-critical-ink">no test drive</span>
          )}
        </span>
      ),
    },
    {
      header: "Value",
      sortKey: "value",
      align: "right",
      accessor: (r) => formatCurrency(r.dealValueRupees),
    },
    { header: "Age", sortKey: "age", align: "right", hint: "days", accessor: (r) => r.ageDays },
    {
      header: "Idle",
      sortKey: "idle",
      align: "right",
      hint: "days since activity",
      accessor: (r) =>
        r.isOpen ? (
          <span className={r.daysSinceActivity >= 7 ? "font-semibold text-critical-ink" : undefined}>
            {r.daysSinceActivity}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <SectionHeading
        title="Leads"
        as="h1"
        hint="The records behind every figure in this product. Scoped by branch, never by the time filter — so a list opened from an alert always contains exactly what that alert counted."
      />

      <section aria-label="Lead cohort summary">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Leads shown" value={formatCount(result.rows.length)} emphasis />
          <StatTile label="Combined value" value={formatCurrency(result.totalValueRupees)} />
          <StatTile
            label="Cohort"
            value={result.cohortLabel}
            hint={result.cohortDescription}
          />
          <StatTile
            label="Active filters"
            value={activeFilters.length === 0 ? "None" : formatCount(activeFilters.length)}
            hint={activeFilters.length ? activeFilters.join(" · ") : "Whole group"}
          />
        </div>
      </section>

      <section aria-label="Cohort selection">
        <Card>
          <SectionHeading
            title="Filter"
            hint="Cohorts are the same definitions the detection rules use, so a list here and an alert there can never disagree."
            action={
              (repId || model || source || stage) && (
                <a
                  href={buildHref("/leads", filters, undefined, { cohort })}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Clear entity filters
                </a>
              )
            }
          />
          <div className="scroll-x pb-1">
            <SegmentedControl
              label="Lead cohort"
              activeKey={cohort}
              options={LEAD_COHORTS.map((c) => ({
                key: c.key,
                label: c.label,
                title: c.description,
              }))}
              hrefFor={(key) =>
                buildHref("/leads", filters, undefined, { ...keep, cohort: key })
              }
            />
          </div>
        </Card>
      </section>

      {cohort === "no_test_drive" && result.rows.length > 0 && (
        <Callout tone="critical" label="Why this cohort matters">
          Every lead below was contacted and then never got into a car. Across the whole dataset,
          zero leads in this position have ever been delivered — so this list is not weak pipeline,
          it is {formatCurrency(result.totalValueRupees)} of closed pipeline that a booked test
          drive is the only way to reopen.
        </Callout>
      )}
      {cohort === "never_contacted" && result.rows.length > 0 && (
        <Callout tone="critical" label="Why this cohort matters">
          Nobody ever followed up on any of these {formatCount(result.rows.length)} leads. They are
          the largest single loss category in the business and the cheapest to act on — each row has
          a name and a phone number.
        </Callout>
      )}

      <section aria-label="Lead list">
        <DataTable
          columns={columns}
          rows={result.rows}
          getRowKey={(r) => r.leadId}
          rowHref={(r) =>
            buildHref("/leads", filters, undefined, { ...keep, lead: r.leadId })
          }
          sortHref={sortHref}
          activeSort={sort}
          activeDir={dir}
          minWidth={1040}
          emptyTitle="No leads match this selection"
          emptyBody="Try a different cohort, or clear the branch and entity filters. This is an empty result, not an error."
          caption="Lead records"
        />
      </section>

      <LeadDetailSheet lead={selectedLead} closeHref={baseHref} />
    </div>
  );
}
