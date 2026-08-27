import Link from "next/link";
import type { Insight } from "@/lib/insights/types";
import type { Filters } from "@/lib/filters/types";
import { buildHref } from "@/lib/filters/parse";
import { formatCurrency } from "@/lib/format";
import { SeverityBadge } from "@/components/ui/Badge";

function callListHref(insight: Insight, filters: Filters): string {
  return buildHref("/api/call-list", filters, { branchId: filters.branchId }, {
    insight: insight.id,
  });
}

/**
 * One detected problem.
 *
 * Four things, in the order a manager needs them: how bad, what it is, what it costs, and what to
 * do. The `action` line is the addition that makes the feed a work queue rather than a report —
 * it is authored by the rule that fired, never generated, and never contains a figure the rule did
 * not itself compute.
 *
 * Two exits, deliberately distinct: the entity link goes to the branch or rep the alert is about,
 * and the evidence link goes to the specific leads it counted. In the first version only the first
 * existed, so "view evidence" landed on a summary page that never listed the records — the exact
 * dead end FR-008 exists to prevent.
 */
export function InsightCard({
  insight,
  filters,
  compact = false,
}: {
  insight: Insight;
  filters: Filters;
  compact?: boolean;
}) {
  return (
    <article className="rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-3">
        <SeverityBadge severity={insight.severity} />
        {insight.impactRupees !== null && (
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums text-ink-primary">
              {formatCurrency(insight.impactRupees)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted">at stake</div>
          </div>
        )}
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug text-ink-primary">
        <Link href={insight.href} className="hover:text-accent hover:underline">
          {insight.title}
        </Link>
      </h3>

      {!compact && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{insight.body}</p>
      )}

      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-primary">
        <span aria-hidden="true" className="mt-px text-accent">
          →
        </span>
        <span className="font-medium">{insight.action}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-grid pt-2.5 text-xs">
        <Link
          href={insight.evidenceHref}
          className="font-medium text-accent hover:underline"
        >
          View the {insight.evidence.length} leads →
        </Link>
        <a href={callListHref(insight, filters)} className="text-ink-secondary hover:text-accent hover:underline">
          Download call list
        </a>
        <Link href={insight.href} className="text-ink-secondary hover:text-accent hover:underline">
          {insight.entity.kind === "rep" ? "Rep page" : insight.entity.kind === "branch" ? "Branch page" : "Details"}
        </Link>
      </div>
    </article>
  );
}
