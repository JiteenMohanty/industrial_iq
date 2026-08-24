import Link from "next/link";
import type { Insight } from "@/lib/insights/types";
import type { Filters } from "@/lib/filters/types";
import { buildHref } from "@/lib/filters/parse";
import { formatCurrency } from "@/lib/format";
import { SeverityBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function callListHref(insight: Insight, filters: Filters): string {
  const base = buildHref("/api/call-list", filters, { branchId: filters.branchId });
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}insight=${encodeURIComponent(insight.id)}`;
}

export function InsightCard({ insight, filters }: { insight: Insight; filters: Filters }) {
  return (
    <Card hoverable className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <SeverityBadge severity={insight.severity} />
        {insight.impactRupees !== null && (
          <span className="tabular-nums text-sm font-semibold text-ink-primary">
            {formatCurrency(insight.impactRupees)}
          </span>
        )}
      </div>
      <Link
        href={insight.href}
        className="text-sm font-semibold text-ink-primary transition-colors duration-150 hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {insight.title}
      </Link>
      <p className="text-sm text-ink-secondary">{insight.body}</p>
      <div className="mt-1 flex items-center gap-4 text-xs">
        <Link
          href={insight.href}
          className="font-medium text-accent transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          View evidence →
        </Link>
        <a
          href={callListHref(insight, filters)}
          className="font-medium text-accent transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Download call list (CSV)
        </a>
      </div>
    </Card>
  );
}
