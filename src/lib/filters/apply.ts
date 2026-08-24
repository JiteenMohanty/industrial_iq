import type { EnrichedLead, EnrichedDelivery } from "@/lib/data/types";
import { startOfUtcDay } from "@/lib/time";
import type { Filters } from "./types";

export function byBranch(branchId: string | null) {
  return (lead: EnrichedLead): boolean => branchId === null || lead.branchId === branchId;
}

/**
 * Compares calendar dates, not raw instants — a `to` bound parsed as UTC midnight (every
 * "custom"/"month" bound is) must still include the entire day it names, not just the first
 * instant of it.
 */
export function byCreatedWindow(from: Date, to: Date) {
  const fromFloor = startOfUtcDay(from).getTime();
  const toFloor = startOfUtcDay(to).getTime();
  return (lead: EnrichedLead): boolean => {
    const created = startOfUtcDay(lead.createdAt).getTime();
    return created >= fromFloor && created <= toFloor;
  };
}

export function byDeliveryWindow(from: Date, to: Date) {
  const fromFloor = startOfUtcDay(from).getTime();
  const toFloor = startOfUtcDay(to).getTime();
  return (delivery: EnrichedDelivery): boolean => {
    const delivered = startOfUtcDay(delivery.deliveryDate).getTime();
    return delivered >= fromFloor && delivered <= toFloor;
  };
}

/**
 * Window-scoped filtering only — leads on created_at, deliveries on delivery_date (FR-030,
 * deliberately different date fields). Branch-only filtering (for detection scope) and
 * unfiltered access (for group baselines) are the caller's responsibility; see
 * lib/analytics/context.ts for how the three scopes are assembled.
 */
export function applyFilters(
  allLeads: readonly EnrichedLead[],
  allDeliveries: readonly EnrichedDelivery[],
  filters: Filters,
): { leads: EnrichedLead[]; deliveries: EnrichedDelivery[] } {
  const inBranch = byBranch(filters.branchId);
  const inLeadWindow = byCreatedWindow(filters.from, filters.to);
  const inDeliveryWindow = byDeliveryWindow(filters.from, filters.to);

  return {
    leads: allLeads.filter((l) => inBranch(l) && inLeadWindow(l)),
    deliveries: allDeliveries.filter((d) => inBranch(d.lead) && inDeliveryWindow(d)),
  };
}
