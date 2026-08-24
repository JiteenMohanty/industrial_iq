# Contract: Analytics Modules

Every function here is **pure**: takes `AnalyticsContext`, returns a plain serialisable object.
No I/O, no `Date.now()`, no mutation of context arrays, no randomness. This is the contract that
makes Constitution V (fixture testing) achievable and FR-010 (determinism) provable.

Return types are view-shaped — small enough to cross the server/client boundary without carrying
lead records (Constitution I).

## `lib/analytics/context.ts`

```
buildContext(filters: Filters): AnalyticsContext
```

The only impure-ish function in the layer (it reads the memoised dataset). Wrapped in React
`cache()` so one request builds one context regardless of how many components ask.

Applies the three scopes defined in [data-model.md §6](../data-model.md): `leads` filtered on
`created_at`, `deliveries` on `delivery_date`, `detectionLeads` branch-filtered only, `groupLeads`
unfiltered.

## `lib/analytics/kpis.ts`

```
computeKpis(ctx): KpiSet
```

```ts
interface Kpi {
  key: 'deliveredUnits' | 'deliveredRevenue' | 'conversionRate' | 'openPipelineValue' | 'attainment';
  value: number;
  unit: 'count' | 'rupees' | 'pct';
  delta: { change: number; direction: 'up' | 'down' | 'flat'; basis: string } | null;
  caveat?: string;
}
```

- `deliveredUnits` / `deliveredRevenue` — over `ctx.deliveries` (delivery-date scoped).
- `conversionRate` — leads created in window that reached `delivered`, ÷ leads created in window.
- `openPipelineValue` — Σ `deal_value` where `isOpen`. Detection-scoped, not window-scoped: open
  pipeline is a present-tense fact, not a property of a historical window.
- `attainment` — `deliveredUnits ÷ Σ target_units` over branch-months **overlapping the window and
  having a target row**. Missing target rows are excluded from the denominator, never zero-filled.
  Carries the mandatory `caveat` (FR-003).
- `delta` is `null` when `!ctx.hasPriorPeriod` — suppressed, never computed against a partial
  window (FR-002).

**Zero-denominator rule**: every rate returns `null`, not `NaN`/`Infinity`, when its denominator is
zero. Applies to every module below.

## `lib/analytics/funnel.ts`

```
computeFunnel(ctx, scope?: { branchId?: string }): FunnelResult
computeStageDurations(ctx): StageDuration[]
computeLossBreakdown(ctx): LossBucket[]
```

`FunnelResult.stages[]` gives `{ stage, count, pctOfTop, dropOffFromPrevious }` using
`reachedStages` — **ever-reached**, not current status (FR-017). Group result must reproduce
510 → 391 → 300 → 235 → 198 → 160.

`computeFunnel` with a `scope` powers the branch overlay (FR-013) against the same group baseline.
`computeLossBreakdown` buckets by `lostFromStage` and by `lost_reason`, counting only leads whose
`status_history` contains an actual `lost` entry (not the raw `status` field, which is wrong for
14 leads in this dataset — see decision-log.md); must reproduce
new 112 · contacted 75 · test_drive 55 · negotiation 32.

## `lib/analytics/targets.ts`

```
computeAttainment(ctx): AttainmentResult
computeAttainmentByBranch(ctx): BranchAttainment[]
```

Full-range group result: 160 ÷ 1,426 = **11.2%** (not 13% — see research R2). Revenue attainment
12.4% is available but units is the headline. Branch-months without a target row are excluded.

## `lib/analytics/pipeline.ts`

```
computeStuckOrders(ctx): StuckOrder[]
computeOpenPipeline(ctx): PipelineSummary
computeAgingBuckets(ctx): AgingBucket[]
```

`computeStuckOrders` returns **all 38** undelivered placed orders (FR-018/019) — not the 25 that
alert. Sorted by `daysSinceOrder` descending, then `deal_value` descending, with both components
present on every row so the reader can verify the ordering (spec assumption: Ranking of stuck
orders). Aging buckets are 7 / 14 / 30 days, matching insight rule 4.

## `lib/analytics/deliveries.ts`

```
computeDeliveryOps(ctx): DeliveryOpsResult
computeDelayReasons(ctx): DelayReasonBucket[]
computeDeliveryByBranch(ctx): BranchDeliveryPerf[]
```

Must reproduce avg 18.3 days (min 7, max 39) and 72 of 160 delayed.

## `lib/analytics/reps.ts`

```
computeRepPerformance(ctx): RepPerformance[]
computeRepDetail(ctx, repId): RepDetail | null
```

Returns `null` for an unknown id so the route can render a not-found state (spec edge case) rather
than throwing.

## `lib/analytics/channels.ts`

```
computeChannelPerformance(ctx): ChannelPerformance[]
```

Must reproduce social_media 13.9% at 14.1% volume share, walk_in 45.7%.

## `lib/analytics/trends.ts`

```
computeMonthlyTrend(ctx): MonthPoint[]
computeBranchSparklines(ctx): BranchSparkline[]
```

Deliveries by month must reproduce Jul 16 · Aug 18 · Sep 24 · Oct 20 · Nov 30 · Dec 52.

## Shared invariants

1. **Purity** — same context in, identical object out, every time.
2. **No mutation** — copy before sorting; context arrays are shared across the request.
3. **No `Date.now()`** — only `lib/time.ts` may read a clock, and only for `REAL_NOW`
   (Constitution VII).
4. **No currency formatting** — return integer rupees; `lib/format.ts` formats at the edge.
5. **Null over NaN** — every rate with a zero denominator returns `null`.
6. **View-shaped output** — no `EnrichedLead` in any return type except `LeadDetail`, and no lead
   array crosses to a client component.
