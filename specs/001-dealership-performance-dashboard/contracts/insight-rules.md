# Contract: Insight Rules & Engine

Implements FR-005 through FR-011a. No LLM, no network, no randomness (Constitution II).

## Rule contract

```ts
interface InsightRule {
  slug: InsightRuleSlug;
  run(ctx: AnalyticsContext): Insight[];
}
```

Every rule is a pure function of the context. Rules read `ctx.detectionLeads` (branch-filtered,
**not** time-filtered — FR-009/FR-009a) and compare against `ctx.groupLeads` (never
branch-filtered, so the comparison baseline survives a narrowed view).

**A rule returning `[]` is a valid outcome, not a failure.** Rules 7 and 9 may legitimately find
nothing in this extract (research R7); tests assert they run and return `[]`, not that they emit.

## Thresholds

Fixed absolute values from spec FR-011. Defined once in `lib/insights/thresholds.ts` and imported
by both rules and tests — never inlined at a call site.

| # | Slug | Fires when | Min sample | Severity | Impact |
|---|---|---|---|---|---|
| 1 | `never-contacted` | Lead never reached `contacted` — open or already lost as a result; raised per branch at ≥5 such leads | 5 leads | critical | Σ `deal_value` |
| 2 | `contact-rate` | Branch contacts <70% of its leads | 15 leads | critical | Σ `deal_value` of uncontacted |
| 3 | `stuck-orders` | Order placed ≥27 days ago, no delivery; raised per branch | 1 order | critical | Σ `deal_value` |
| 4 | `cold-leads` | Open lead with no activity ≥7 days | 1 lead | ≥30d critical · ≥14d warning · ≥7d info | Σ `deal_value` |
| 5 | `funnel-collapse` | Branch stage conversion ≥15pp below group at that stage | 15 leads | warning | Σ `deal_value` lost at stage |
| 6 | `rep-outlier` | Rep lead→delivery ≥15pp below branch average | 15 leads | warning | Σ `deal_value` of their open leads |
| 7 | `lost-reason` | One reason ≥40% of a branch's losses | 10 losses | warning | Σ `deal_value` lost to it |
| 8 | `channel-quality` | Channel converts <20% while supplying ≥10% of volume | 10% share | info | Σ `deal_value` of its lost leads |
| 9 | `delay-reason` | One reason ≥40% of a branch's delayed deliveries | 5 delayed | info | `null` |

**FR-011a**: an entity below a rule's minimum sample is excluded from that rule entirely — no
insight, no caveated insight. Guard before computing the rate, so a 3-lead rep never reaches the
comparison.

**Threshold statement**: every `body` states the threshold that fired and the value that breached
it — *"contacted 46 of 79 leads (58%), below the 70% floor; group average is 79%"*. An alert that
doesn't show its own arithmetic asks to be taken on trust, which FR-011 forbids.

## Engine

```
runInsights(ctx: AnalyticsContext): Insight[]
```

1. Run all nine rules in declaration order.
2. Concatenate.
3. Sort by the total order: severity rank → `impactRupees` desc (`null` last) → `id` asc.
4. Return the full ranked list. **Truncation to 5 is a presentation concern** (FR-007a) and belongs
   in the Action Center component, not here — the CSV endpoint and branch pages need the full list.

Step 3's `id` tiebreak is what makes the order total and therefore reproducible (FR-010, research
R10). Without it, two equal-severity equal-impact insights could swap between runs.

## Identity

`id = ${slug}:${entityId}` — `never-contacted:B3`, `channel-quality:social_media`,
`cold-leads:B5`. URL-safe, stable across runs, human-legible in a shared link. This is the handle
`GET /api/call-list` resolves.

## Drill-through

Every `href` is built with `buildHref()` so the reader's filters survive the jump (FR-029).

| Rule | Target |
|---|---|
| `never-contacted`, `contact-rate`, `funnel-collapse`, `lost-reason` | `/branches/{id}` |
| `stuck-orders`, `delay-reason` | `/deliveries?branch={id}` |
| `cold-leads` | `/branches/{id}` |
| `rep-outlier` | `/reps/{id}` |
| `channel-quality` | `/funnel` |

## Expected output on this extract

A smoke check, not an assertion of exact feed contents:

- `never-contacted:B3` — Lakeside, 33 never-contacted leads (all already lost — see
  decision-log.md). Critical, high impact.
- `contact-rate:B3` — 58.2% against the 70% floor. Fires for B3 alone (peers 78.0–82.5%).
- These two draw from nearly the same evidence population, so they tie on severity and impact;
  **a Lakeside (B3) insight must rank first** regardless of which of the two wins the id-ascending
  tiebreak — SC-001's 30-second test depends on B3 leading, not on a specific rule slug winning.
- `stuck-orders:B*` — 25 alerting orders across branches, B5 heaviest.
- `funnel-collapse:B3` — 7.6% delivered vs group 31.4%.
- `channel-quality:social_media` — 13.9% at 14.1% share. Fires alone.
- `lost-reason`, `delay-reason` — may return `[]`.

## Test requirements (Constitution V)

Per rule: one test proving it fires on the known-positive case, one proving it does **not** fire on
a known-negative (e.g. rule 2 must be silent for B1/B2/B4/B5), one proving minimum-sample exclusion.

Engine: ordering is a total order; a Lakeside (B3) insight ranks first on the unfiltered context;
running twice on the same context yields identical `id` sequences.
