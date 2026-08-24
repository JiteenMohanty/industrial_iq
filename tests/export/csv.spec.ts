import { describe, it, expect } from "vitest";
import { toCsv, buildCallListRows, type CallListRow } from "@/lib/export/csv";
import { getDataset } from "@/lib/data/dataset";
import { buildContext } from "@/lib/analytics/context";
import { parseFilters, buildParseFiltersContext } from "@/lib/filters/parse";
import { runInsights } from "@/lib/insights/engine";
import { LAKESIDE_BRANCH_ID } from "../fixtures";

function fullContext() {
  const dataset = getDataset();
  return buildContext(parseFilters(new URLSearchParams(), buildParseFiltersContext(dataset)));
}

const sampleRows: CallListRow[] = [
  {
    leadId: "L0001",
    customer: 'Rāj "The Boss" Kumar',
    phone: "9269820594",
    branch: "Lakeside Toyota",
    salesRep: "Kavitha Sharma",
    model: "Innova Hycross",
    dealValueRupees: 2040000,
    currentStage: "new",
    daysSinceActivity: 8,
    qualifyingFigure: "8 days since last activity",
  },
];

describe("toCsv", () => {
  it("starts with a UTF-8 BOM", () => {
    const csv = toCsv(sampleRows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line endings", () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n").length).toBeGreaterThanOrEqual(2);
  });

  it("escapes fields containing commas and quotes per RFC 4180", () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain('"Rāj ""The Boss"" Kumar"');
  });

  it("writes rupee values as bare integers, no currency symbol or grouping", () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain("2040000");
    expect(csv).not.toContain("₹");
    expect(csv).not.toContain("2,040,000");
  });

  it("prefixes phone numbers with a leading apostrophe so Excel treats them as text", () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain("'9269820594");
  });

  it("header row uses plain-language column names, not internal field names", () => {
    const csv = toCsv(sampleRows);
    expect(csv).toContain("Lead ID");
    expect(csv).toContain("Deal Value (INR)");
    expect(csv).not.toContain("dealValueRupees");
  });
});

describe("buildCallListRows", () => {
  it("produces one row per evidence lead id, resolved from the real dataset", () => {
    const ctx = fullContext();
    const insights = runInsights(ctx);
    const lakesideInsight = insights.find((i) => i.entity.id === LAKESIDE_BRANCH_ID);
    expect(lakesideInsight).toBeDefined();
    if (!lakesideInsight) return;

    const rows = buildCallListRows(lakesideInsight, ctx);
    expect(rows.length).toBe(lakesideInsight.evidence.length);
    for (const row of rows) {
      expect(row.leadId.length).toBeGreaterThan(0);
      expect(row.dealValueRupees).toBeGreaterThan(0);
    }
  });

  it("every row carries a non-empty qualifying figure", () => {
    const ctx = fullContext();
    const insights = runInsights(ctx);
    for (const insight of insights.slice(0, 3)) {
      const rows = buildCallListRows(insight, ctx);
      for (const row of rows) {
        expect(row.qualifyingFigure.length).toBeGreaterThan(0);
      }
    }
  });
});
