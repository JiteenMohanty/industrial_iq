import type { EnrichedLead } from "@/lib/data/types";

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
