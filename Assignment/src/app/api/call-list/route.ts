import { NextRequest } from "next/server";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { runInsights } from "@/lib/insights/engine";
import { buildCallListRows, toCsv } from "@/lib/export/csv";

/**
 * The product's only HTTP endpoint (ADR-0006 — a deliberate, narrow deviation from plan.md §4.3's
 * "no export feature needed", driven by spec FR-039). Read-only, deterministic: same insight +
 * same filters -> byte-identical file (FR-040, FR-041).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const insightId = searchParams.get("insight");

  if (!insightId) {
    return new Response("Missing required 'insight' query parameter.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const dataset = getDataset();
  const filters = parseFilters(searchParams, buildParseFiltersContext(dataset));
  const ctx = buildContext(filters);
  const insight = runInsights(ctx).find((i) => i.id === insightId);

  if (!insight) {
    return new Response(
      `No insight with id "${insightId}" is currently active for the given filters.`,
      { status: 404, headers: { "Content-Type": "text/plain" } },
    );
  }

  const rows = buildCallListRows(insight, ctx);
  const csv = toCsv(rows);
  const dateSlug = dataset.dataAsOf.toISOString().slice(0, 10);
  const filename = `dealerpulse-${insight.rule}-${insight.entity.id}-${dateSlug}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
