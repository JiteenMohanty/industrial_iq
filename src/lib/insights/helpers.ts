import type { EnrichedLead } from "@/lib/data/types";
import type { Filters } from "@/lib/filters/types";
import { buildHref } from "@/lib/filters/parse";
import type { LeadCohort } from "@/lib/analytics/leads";

export function sumDealValue(leads: readonly EnrichedLead[]): number {
  return leads.reduce((sum, l) => sum + l.dealValue, 0);
}

export function groupByBranch<T extends { branchId: string }>(
  items: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(item.branchId) ?? [];
    list.push(item);
    map.set(item.branchId, list);
  }
  return map;
}

/**
 * Builds the evidence link for an alert: the lead explorer, pre-filtered to exactly the cohort
 * and entity the alert counted. Filter state is preserved through `buildHref` so a drill-through
 * never silently drops the reader's time range or branch selection (FR-029).
 */
export function evidenceHref(
  filters: Filters,
  cohort: LeadCohort,
  extra: Record<string, string | undefined> = {},
): string {
  return buildHref("/leads", filters, undefined, { cohort, ...extra });
}
