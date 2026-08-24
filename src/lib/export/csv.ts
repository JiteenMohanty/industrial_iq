import type { AnalyticsContext } from "@/lib/analytics/context";
import type { Insight, InsightRuleSlug } from "@/lib/insights/types";

export interface CallListRow {
  leadId: string;
  customer: string;
  phone: string;
  branch: string;
  salesRep: string;
  model: string;
  dealValueRupees: number;
  currentStage: string;
  daysSinceActivity: number;
  qualifyingFigure: string;
}

const HEADERS = [
  "Lead ID",
  "Customer",
  "Phone",
  "Branch",
  "Sales Rep",
  "Model",
  "Deal Value (INR)",
  "Current Stage",
  "Days Since Activity",
  "Qualifying Figure",
] as const;

function qualifyingFigureFor(rule: InsightRuleSlug, leadId: string, ctx: AnalyticsContext): string {
  const lead = ctx.dataset.leadById.get(leadId);
  if (!lead) return "";

  switch (rule) {
    case "never-contacted":
      return `${lead.ageDays} days since created`;
    case "stuck-orders":
      return lead.daysSinceOrder !== null ? `${lead.daysSinceOrder} days since order placed` : "";
    case "cold-leads":
      return `${lead.daysSinceActivity} days since last activity`;
    case "rep-outlier": {
      const repLeads = ctx.dataset.leadsByRep.get(lead.assignedTo) ?? [];
      const delivered = repLeads.filter((l) => l.reachedStages.has("delivered")).length;
      const pct = repLeads.length > 0 ? ((delivered / repLeads.length) * 100).toFixed(1) : "0";
      return `${pct}% rep conversion rate`;
    }
    default:
      return `${lead.daysSinceActivity} days since last activity`;
  }
}

/** Pure — resolves an Insight's evidence lead ids into call-list rows. No I/O, no request object. */
export function buildCallListRows(insight: Insight, ctx: AnalyticsContext): CallListRow[] {
  const rows: CallListRow[] = [];
  for (const leadId of insight.evidence) {
    const lead = ctx.dataset.leadById.get(leadId);
    if (!lead) continue;
    rows.push({
      leadId: lead.id,
      customer: lead.customerName,
      phone: lead.phone,
      branch: lead.branch.name,
      salesRep: lead.rep.name,
      model: lead.modelInterested,
      dealValueRupees: lead.dealValue,
      currentStage: lead.status === "lost" ? "Lost" : lead.currentStage.replace("_", " "),
      daysSinceActivity: lead.daysSinceActivity,
      qualifyingFigure: qualifyingFigureFor(insight.rule, leadId, ctx),
    });
  }
  return rows;
}

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Pure CSV serialisation. UTF-8 BOM so Excel renders Indian customer names correctly; CRLF line
 * endings per RFC 4180; phone numbers quoted to preserve leading digits; rupee values as bare
 * integers (no currency symbol, no grouping separator) so a spreadsheet parses the column as
 * numbers rather than text (FR-040a).
 */
export function toCsv(rows: readonly CallListRow[]): string {
  const BOM = "﻿";
  const headerLine = HEADERS.join(",");
  const dataLines = rows.map((row) =>
    [
      escapeCsvField(row.leadId),
      escapeCsvField(row.customer),
      escapeCsvField(`'${row.phone}`), // leading `'` preserves leading digits when opened in Excel
      escapeCsvField(row.branch),
      escapeCsvField(row.salesRep),
      escapeCsvField(row.model),
      escapeCsvField(row.dealValueRupees),
      escapeCsvField(row.currentStage),
      escapeCsvField(row.daysSinceActivity),
      escapeCsvField(row.qualifyingFigure),
    ].join(","),
  );
  return BOM + [headerLine, ...dataLines].join("\r\n") + "\r\n";
}
