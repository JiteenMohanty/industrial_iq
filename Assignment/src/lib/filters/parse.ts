import type { Dataset } from "@/lib/data/types";
import { addDays } from "@/lib/time";
import type { Filters, TimePreset } from "./types";

const VALID_PRESETS: readonly TimePreset[] = ["last30", "last90", "month", "full", "custom"];
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Everything parseFilters needs to resolve a URL into a concrete Filters — bundled here rather
 * than having parseFilters read the dataset singleton itself, so it stays a pure, dataset-agnostic
 * function that's trivial to unit test with a handful of fake branch/month ids.
 */
export interface ParseFiltersContext {
  dataAsOf: Date;
  minDate: Date;
  validBranchIds: ReadonlySet<string>;
  validMonths: ReadonlySet<string>;
}

export function buildParseFiltersContext(dataset: Dataset): ParseFiltersContext {
  return {
    dataAsOf: dataset.dataAsOf,
    minDate: dataset.minCreatedAt,
    validBranchIds: new Set(dataset.branches.map((b) => b.id)),
    validMonths: new Set(dataset.months),
  };
}

function fullRange(ctx: ParseFiltersContext): { from: Date; to: Date } {
  return { from: ctx.minDate, to: ctx.dataAsOf };
}

function asFull(ctx: ParseFiltersContext, branchId: string | null): Filters {
  const { from, to } = fullRange(ctx);
  return { preset: "full", from, to, month: null, branchId };
}

/**
 * Total: never throws, never produces an invalid Filters. Every malformed or unrecognised input
 * degrades to the full-range default rather than erroring (FR-035, SC-006) — a bad URL must
 * render the default view, not an error page.
 */
export function parseFilters(searchParams: URLSearchParams, ctx: ParseFiltersContext): Filters {
  const presetRaw = searchParams.get("preset");
  const preset: TimePreset = (VALID_PRESETS as readonly string[]).includes(presetRaw ?? "")
    ? (presetRaw as TimePreset)
    : "full";

  const branchRaw = searchParams.get("branch");
  const branchId = branchRaw && ctx.validBranchIds.has(branchRaw) ? branchRaw : null;

  switch (preset) {
    case "last30":
      return { preset, from: addDays(ctx.dataAsOf, -30), to: ctx.dataAsOf, month: null, branchId };

    case "last90":
      return { preset, from: addDays(ctx.dataAsOf, -90), to: ctx.dataAsOf, month: null, branchId };

    case "month": {
      const monthRaw = searchParams.get("month");
      if (!monthRaw || !MONTH_PATTERN.test(monthRaw) || !ctx.validMonths.has(monthRaw)) {
        return asFull(ctx, branchId);
      }
      const [year, month] = monthRaw.split("-").map(Number) as [number, number];
      const from = new Date(Date.UTC(year, month - 1, 1));
      const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
      const to = lastDayOfMonth > ctx.dataAsOf ? ctx.dataAsOf : lastDayOfMonth;
      return { preset, from, to, month: monthRaw, branchId };
    }

    case "custom": {
      const fromRaw = searchParams.get("from");
      const toRaw = searchParams.get("to");
      if (!fromRaw || !toRaw || !DATE_PATTERN.test(fromRaw) || !DATE_PATTERN.test(toRaw)) {
        return asFull(ctx, branchId);
      }
      const fromParsed = new Date(`${fromRaw}T00:00:00.000Z`);
      const toParsed = new Date(`${toRaw}T00:00:00.000Z`);
      if (Number.isNaN(fromParsed.getTime()) || Number.isNaN(toParsed.getTime())) {
        return asFull(ctx, branchId);
      }
      const [from, to] =
        fromParsed <= toParsed ? [fromParsed, toParsed] : [toParsed, fromParsed];
      return { preset, from, to, month: null, branchId };
    }

    case "full":
    default:
      return asFull(ctx, branchId);
  }
}

function toDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The only sanctioned way to construct an internal link (Constitution VI). Every drill-through —
 * insight href, branch row, breadcrumb — goes through this, which is what preserves filter state
 * on navigation (FR-029) without every call site having to remember to do it by hand.
 */
export function buildHref(
  pathname: string,
  filters: Filters,
  overrides?: Partial<Filters>,
): string {
  const merged: Filters = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.preset !== "full") {
    params.set("preset", merged.preset);
  }
  if (merged.preset === "month" && merged.month) {
    params.set("month", merged.month);
  }
  if (merged.preset === "custom") {
    params.set("from", toDateParam(merged.from));
    params.set("to", toDateParam(merged.to));
  }
  if (merged.branchId) {
    params.set("branch", merged.branchId);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
