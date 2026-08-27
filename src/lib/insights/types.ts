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
  | "delay-reason"
  | "test-drive-gate"
  | "promise-reliability";

export type MetricUnit = "pct" | "days" | "rupees" | "count";

export interface InsightMetric {
  value: number;
  comparison: number | null;
  unit: MetricUnit;
}

export type InsightEntityKind = "branch" | "rep" | "channel" | "model" | "group";

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
  /**
   * Where the reader goes to see the specific records behind this alert, as opposed to `href`,
   * which goes to the entity the alert is *about* (a branch, a rep). v1 only had `href`, so
   * "view evidence" landed on a branch summary that never listed the leads in question; the
   * evidence link closes that gap (FR-008, SC-002).
   */
  evidenceHref: string;
  /**
   * One short imperative sentence naming what to actually do. Rule-authored and fixed — this is
   * not a generated recommendation, and it never contains a figure the rule did not compute.
   */
  action: string;
}
