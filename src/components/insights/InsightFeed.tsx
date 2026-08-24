import Link from "next/link";
import type { Insight } from "@/lib/insights/types";
import type { Filters } from "@/lib/filters/types";
import { buildHref } from "@/lib/filters/parse";
import { InsightCard } from "./InsightCard";
import { EmptyState } from "@/components/ui/EmptyState";

const FEED_LIMIT = 5;

function withInsightsParam(pathname: string, filters: Filters, expand: boolean): string {
  const base = buildHref(pathname, filters);
  if (!expand) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}insights=all`;
}

/**
 * The Action Center — the visual anchor of the overview (FR-007). Top 5 always shown regardless
 * of how many exist, since the engine ranks severity before impact (FR-007a); the remainder is
 * reachable through a single "show all" link, itself a plain server-rendered navigation — no
 * client component needed for this toggle.
 */
export function InsightFeed({
  insights,
  filters,
  expanded,
  pathname = "/",
}: {
  insights: Insight[];
  filters: Filters;
  expanded: boolean;
  pathname?: string;
}) {
  if (insights.length === 0) {
    return (
      <EmptyState
        title="No detected problems"
        description={
          filters.branchId
            ? "This branch has no detected problems under the current filters."
            : "No problems detected under the current filters."
        }
      />
    );
  }

  const visible = expanded ? insights : insights.slice(0, FEED_LIMIT);
  const remaining = insights.length - visible.length;

  return (
    <div>
      <div className="grid gap-3">
        {visible.map((insight) => (
          <InsightCard key={insight.id} insight={insight} filters={filters} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="mt-3 text-center">
          <Link
            href={withInsightsParam(pathname, filters, true)}
            className="text-sm font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Show {remaining} more {remaining === 1 ? "problem" : "problems"}
          </Link>
        </div>
      )}
      {expanded && insights.length > FEED_LIMIT && (
        <div className="mt-3 text-center">
          <Link
            href={withInsightsParam(pathname, filters, false)}
            className="text-sm font-medium text-ink-secondary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Show fewer
          </Link>
        </div>
      )}
    </div>
  );
}
