import { cache } from "react";
import { getDataset } from "@/lib/data/dataset";
import type { Dataset, EnrichedLead, EnrichedDelivery } from "@/lib/data/types";
import type { Filters } from "@/lib/filters/types";
import { applyFilters, byBranch, byCreatedWindow, byDeliveryWindow } from "@/lib/filters/apply";
import { daysBetween, addDays } from "@/lib/time";

/**
 * The single input to every analytics and insight function. Three scopes, deliberately kept
 * distinct (ADR-0005) — confusing them is the single most likely correctness bug in this codebase:
 *
 *   - leads/deliveries       window-scoped: respects BOTH the time range and the branch filter.
 *                            Leads filter on created_at, deliveries on delivery_date (FR-030).
 *   - detectionLeads         branch-filtered only. Time range is deliberately NOT applied, so a
 *                            narrow window never hides an active problem (FR-009), while a branch
 *                            selection still scopes the alert feed (FR-009a).
 *   - windowLeads/Deliveries time-scoped, all branches. The baseline for any comparison made
 *                            *inside* a selected window, and the pool the per-branch comparison
 *                            tables are built from -- so those tables respond to the time filter
 *                            while still showing every branch.
 *   - groupLeads/Deliveries  never filtered by anything. The baseline every comparative insight
 *                            (contact-rate, funnel-collapse, rep-outlier, channel-quality) is
 *                            measured against, so the comparison stays visible even in a
 *                            branch-narrowed view.
 *
 * Which scope a function reads is the single most important decision in this layer. The rule:
 * population views (funnel shape, model mix, source mix, rep performance) read the reader's
 * selection; present-tense state (alerts, gates, stuck orders) reads branch-only so a narrow
 * window can never hide a live problem; cross-branch comparison tables read the window pool so
 * they respond to time while still ranking every branch.
 */
export interface AnalyticsContext {
  filters: Filters;

  leads: EnrichedLead[];
  deliveries: EnrichedDelivery[];
  priorLeads: EnrichedLead[];
  priorDeliveries: EnrichedDelivery[];
  hasPriorPeriod: boolean;

  detectionLeads: EnrichedLead[];

  windowLeads: EnrichedLead[];
  windowDeliveries: EnrichedDelivery[];

  groupLeads: EnrichedLead[];
  groupDeliveries: EnrichedDelivery[];

  dataset: Dataset;
  asOf: Date;
}

function computePriorWindow(filters: Filters, minDate: Date): { from: Date; to: Date } | null {
  const windowDays = daysBetween(filters.from, filters.to);
  const priorTo = addDays(filters.from, -1);
  const priorFrom = addDays(priorTo, -windowDays);

  if (priorFrom < minDate) {
    return null;
  }
  return { from: priorFrom, to: priorTo };
}

export const buildContext = cache((filters: Filters): AnalyticsContext => {
  const dataset = getDataset();

  const { leads, deliveries } = applyFilters(dataset.leads, dataset.deliveries, filters);

  const priorWindow = computePriorWindow(filters, dataset.minCreatedAt);
  let priorLeads: EnrichedLead[] = [];
  let priorDeliveries: EnrichedDelivery[] = [];
  if (priorWindow) {
    const inBranch = byBranch(filters.branchId);
    priorLeads = dataset.leads.filter(
      (l) => inBranch(l) && byCreatedWindow(priorWindow.from, priorWindow.to)(l),
    );
    priorDeliveries = dataset.deliveries.filter(
      (d) => inBranch(d.lead) && byDeliveryWindow(priorWindow.from, priorWindow.to)(d),
    );
  }

  const detectionLeads = dataset.leads.filter(byBranch(filters.branchId));

  // Time-scoped, all branches. This is the correct baseline for any comparison made *inside* a
  // selected window: judging a branch's contact rate against the all-time group figure while the
  // reader is looking at November compares two different populations.
  const { leads: windowLeads, deliveries: windowDeliveries } = applyFilters(
    dataset.leads,
    dataset.deliveries,
    { ...filters, branchId: null },
  );

  return {
    filters,
    leads,
    deliveries,
    priorLeads,
    priorDeliveries,
    hasPriorPeriod: priorWindow !== null,
    detectionLeads,
    windowLeads,
    windowDeliveries,
    groupLeads: dataset.leads,
    groupDeliveries: dataset.deliveries,
    dataset,
    asOf: dataset.dataAsOf,
  };
});
