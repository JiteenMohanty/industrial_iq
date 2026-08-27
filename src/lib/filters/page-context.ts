import "server-only";
import { getDataset } from "@/lib/data/dataset";
import { buildContext, type AnalyticsContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "./parse";
import type { Filters } from "./types";

export type SearchParams = { [key: string]: string | string[] | undefined };

/**
 * Normalises Next's `searchParams` into a `URLSearchParams`. Array values (a repeated query key)
 * collapse to the first entry rather than throwing — `parseFilters` is a total function and this
 * boundary has to be one too, so a hand-mangled URL renders the default view instead of a 500.
 */
export function toURLSearchParams(sp: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) params.set(key, value[0]);
  }
  return params;
}

export interface PageContext {
  params: URLSearchParams;
  filters: Filters;
  ctx: AnalyticsContext;
  /** Reads a non-filter query parameter (cohort, metric, overlay, sort, ...). */
  param: (key: string) => string | null;
}

/**
 * The four lines every route used to repeat. Kept as one call so a page can never accidentally
 * build its analytics context from different filters than the ones it renders its links with.
 */
export async function resolvePage(
  searchParams: Promise<SearchParams>,
): Promise<PageContext> {
  const resolved = await searchParams;
  const params = toURLSearchParams(resolved);
  const dataset = getDataset();
  const filters = parseFilters(params, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);
  return { params, filters, ctx, param: (key) => params.get(key) };
}
