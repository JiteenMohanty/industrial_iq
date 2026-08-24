import type { Severity } from "@/lib/data/types";

export type InsightRuleSlug =
  | "never-contacted"
  | "contact-rate"
  | "stuck-orders"
  | "cold-leads"
  | "funnel-collapse"
  | "rep-outlier"
  | "lost-reason"
  | "channel-quality"
  | "delay-reason";

export type MetricUnit = "pct" | "days" | "rupees" | "count";

export interface InsightMetric {
  value: number;
  comparison: number | null;
  unit: MetricUnit;
}

export type InsightEntityKind = "branch" | "rep" | "channel" | "group";

export interface InsightEntity {
  kind: InsightEntityKind;
  id: string;
  label: string;
}

/**
 * `evidence` and `href` are required, never optional (FR-008 — a problem that cannot be drilled
 * into MUST NOT be displayed; a rule with nothing to point at must return no Insight at all
 * rather than one with empty evidence). `impactRupees: null` is distinct from `0` — "no money at
 * stake" must not sort as "zero rupees at stake" ahead of genuine values (data-model.md §7).
 */
export interface Insight {
  id: string;
  rule: InsightRuleSlug;
  severity: Severity;
  title: string;
  body: string;
  impactRupees: number | null;
  metric: InsightMetric;
  entity: InsightEntity;
  href: string;
  evidence: string[];
}
