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
