import { getDataset } from "@/lib/data/dataset";
import { buildContext, type AnalyticsContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";

/** Full-range, no-branch context — the default cold-open view every rule is primarily tested against. */
export function fullContext(): AnalyticsContext {
  const dataset = getDataset();
  const filters = parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset));
  return buildContext(filters);
}

export function contextForBranch(branchId: string): AnalyticsContext {
  const dataset = getDataset();
  const filters = parseFilters(
    new URLSearchParams({ branch: branchId }),
    buildParseFiltersContext(dataset),
  );
  return buildContext(filters);
}

/** A specific month — used to prove the time filter actually reaches an analytics function. */
export function contextForMonth(month: string): AnalyticsContext {
  const dataset = getDataset();
  const filters = parseFilters(
    new URLSearchParams({ preset: "month", month }),
    buildParseFiltersContext(dataset),
  );
  return buildContext(filters);
}

/** Branch and month together. */
export function contextFor(branchId: string, month: string): AnalyticsContext {
  const dataset = getDataset();
  const filters = parseFilters(
    new URLSearchParams({ branch: branchId, preset: "month", month }),
    buildParseFiltersContext(dataset),
  );
  return buildContext(filters);
}
