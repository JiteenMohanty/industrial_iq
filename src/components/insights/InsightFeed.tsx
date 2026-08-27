import Link from "next/link";
import type { Insight } from "@/lib/insights/types";
import type { Filters } from "@/lib/filters/types";
import { buildHref } from "@/lib/filters/parse";
import { formatCurrency } from "@/lib/format";
import { InsightCard } from "./InsightCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { selectHeadlines } from "@/lib/insights/engine";

/**
 * The Action Center.
 *
 * Shows five alerts by default, chosen by `selectHeadlines` rather than by slicing the ranked list
 * — round-robin across rules, so the five slots spend themselves on five *different* problems.
 * Slicing the raw ranking produced a feed where four of five cards were the same rule fired at
 * four branches: strictly the most severe items, and close to useless as a summary of the
 * business. The full ranked list stays one click away and is what the CSV endpoint uses.
 */
export function InsightFeed({
  insights,
  filters,
  expanded,
  pathname,
  branchName,
  limit = 5,
}: {
  insights: Insight[];
  filters: Filters;
  expanded: boolean;
  pathname: string;
  branchName?: string | undefined;
  limit?: number;
}) {
  if (insights.length === 0) {
    return (
      <EmptyState
        title={
          branchName
            ? `No detected problems at ${branchName}`
            : "No detected problems in this selection"
        }
        body={
          branchName
            ? `Every detection rule ran against ${branchName} and none of them fired. This is a real result, not a loading failure.`
            : "Every detection rule ran and none of them fired against the current branch selection."
        }
      />
    );
  }

  const shown = expanded ? insights : selectHeadlines(insights, limit);
  const remaining = insights.length - shown.length;
  const totalAtStake = insights.reduce((s, i) => s + (i.impactRupees ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((insight) => (
          <InsightCard key={insight.id} insight={insight} filters={filters} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>
          {insights.length} detected {insights.length === 1 ? "problem" : "problems"} ·{" "}
          {formatCurrency(totalAtStake)} at stake in total
          {!expanded && remaining > 0 && (
            <> · showing one per problem type, most severe first</>
          )}
        </span>
        {remaining > 0 && !expanded && (
          <Link
            href={buildHref(pathname, filters, undefined, { insights: "all" })}
            className="font-medium text-accent hover:underline"
          >
            Show all {insights.length} →
          </Link>
        )}
        {expanded && (
          <Link href={buildHref(pathname, filters)} className="font-medium text-accent hover:underline">
            Show top {limit} only
          </Link>
        )}
      </div>
    </div>
  );
}
