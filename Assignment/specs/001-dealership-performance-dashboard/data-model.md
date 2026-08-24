# Phase 1: Data Model

**Feature**: Dealership Performance Dashboard (DealerPulse)
**Date**: 2026-08-24

Two tiers: **raw** types mirroring `dealership_data.json` exactly, and **enriched** types produced
once by `lib/data/dataset.ts`. Analytics and insight code sees only enriched types. Raw types exist
solely as the parse boundary and are never passed beyond `dataset.ts`.

---

## 1. Closed domains

Model these as string-literal unions, never as `string`. A typo in a rule predicate must fail at
compile time — these rules *are* the product (Constitution II).

```ts
type Stage = 'new' | 'contacted' | 'test_drive' | 'negotiation' | 'order_placed' | 'delivered';
type LeadStatus = Stage | 'lost';
type Source = 'walk_in' | 'website' | 'phone_enquiry' | 'referral' | 'social_media' | 'auto_expo';
type RepRole = 'branch_manager' | 'sales_officer';
type Severity = 'critical' | 'warning' | 'info';
```

`FUNNEL_STAGES` is the ordered tuple `['new','contacted','test_drive','negotiation',
'order_placed','delivered']` — the single source of stage ordering. `lost` is deliberately outside
it: a lead exits the funnel sideways from whichever stage it had reached, so `lost` has no position.

`delay_reason` (7 values, nullable) and `lost_reason` (8 values) are left as `string` — they are
free-text-ish labels used for grouping and display only, never for control flow.

---

## 2. Raw types (parse boundary)

Mirror the JSON exactly. No normalisation, no `Date` objects.

| Type | Fields |
|---|---|
| `RawBranch` | `id`, `name`, `city` |
| `RawRep` | `id`, `name`, `branch_id`, `role: RepRole`, `joined` |
| `RawStatusEntry` | `status: LeadStatus`, `timestamp`, `note` |
| `RawLead` | `id`, `customer_name`, `phone`, `source: Source`, `model_interested`, `status: LeadStatus`, `assigned_to`, `branch_id`, `created_at`, `last_activity_at`, `status_history: RawStatusEntry[]`, `expected_close_date`, `deal_value: number`, `lost_reason: string \| null` |
| `RawTarget` | `branch_id`, `month` (`YYYY-MM`), `target_units: number`, `target_revenue: number` |
| `RawDelivery` | `lead_id`, `order_date`, `delivery_date`, `days_to_deliver: number`, `delay_reason: string \| null` |
| `RawDataset` | `metadata`, `branches[]`, `sales_reps[]`, `leads[]`, `targets[]`, `deliveries[]` |

All timestamps are ISO 8601 strings. `deal_value` and `target_revenue` are integer rupees.

---

## 3. Enriched types

### `EnrichedLead`

Everything `RawLead` has, plus the derived fields below. **`status_history` is the authority for
stage progression; `status` alone is never used to determine how far a lead got** (Constitution III,
FR-017).

| Field | Type | Derivation |
|---|---|---|
| `stageTimestamps` | `Partial<Record<Stage, Date>>` | First timestamp at which each stage appears in `status_history`. First, not last — re-entry must not reset the clock |
| `reachedStages` | `Set<Stage>` | Every stage present in `status_history`. Drives the funnel |
| `currentStage` | `Stage` | Furthest stage reached in `FUNNEL_STAGES` order. For a lost lead this is the stage it was lost *from* |
| `isLost` | `boolean` | `status === 'lost'` |
| `lostFromStage` | `Stage \| null` | Stage of the entry immediately preceding the `lost` entry; `null` if not lost |
| `isOpen` | `boolean` | `!isLost && !reachedStages.has('delivered')` |
| `isStuckOrder` | `boolean` | `reachedStages.has('order_placed') && !delivery && !isLost` |
| `createdAt` | `Date` | Parsed `created_at` |
| `lastActivityAt` | `Date` | Parsed `last_activity_at` |
| `ageDays` | `number` | Whole days from `createdAt` to `DATA_AS_OF`, both floored to UTC date |
| `daysSinceActivity` | `number` | Whole days from `lastActivityAt` to `DATA_AS_OF`, both floored |
| `daysSinceOrder` | `number \| null` | From `stageTimestamps.order_placed` to `DATA_AS_OF`; `null` if never ordered |
| `delivery` | `EnrichedDelivery \| null` | Joined on `lead_id` |
| `branch` | `Branch` | Resolved reference |
| `rep` | `Rep` | Resolved reference |

**Validation rules**

- `status_history` MUST be non-empty and sorted ascending by timestamp. Sort defensively on
  ingest rather than trusting file order — every derived field depends on it.
- Every lead's first history entry is `new`. Assert on ingest; a violation means the extract
  changed shape and the funnel's 510 baseline is no longer meaningful.
- `assigned_to` and `branch_id` MUST resolve. An unresolvable reference is a hard parse error, not
  a silently dropped lead — dropping would corrupt every denominator.
- A lead with `status === 'delivered'` MUST have a matching delivery record. Verified: 160/160.
- A lead with `status === 'order_placed'` MUST NOT have one. Verified: 38/38.

### `EnrichedDelivery`

`RawDelivery` plus `orderDate: Date`, `deliveryDate: Date`, `deliveryMonth: string` (`YYYY-MM`),
`isDelayed: boolean` (`delay_reason !== null`), and `lead` back-reference.

Note `days_to_deliver` is supplied by the data and agrees with `deliveryDate − orderDate`;
prefer the supplied field and assert agreement on ingest rather than recomputing.

### `Branch`, `Rep`

`Branch`: raw fields plus `label` (`"Lakeside Toyota (Bangalore)"`) for consistent display.
`Rep`: raw fields plus resolved `branch`.

### `TargetsIndex`

Keyed `` `${branch_id}:${month}` `` → `RawTarget`. **A missing key means no target was set and MUST
be excluded from attainment denominators — never coerced to zero** (spec edge case: Missing
targets). 35 rows = 5 branches × 7 months, so this extract is complete; the rule protects against a
future one that isn't.

---

## 4. The dataset singleton

`lib/data/dataset.ts` exports `getDataset()`, memoised at module scope and wrapped in React
`cache()` for per-request identity. Carries the `server-only` import so any client-component import
fails the build (Constitution I).

**Indexes** built once:

| Index | Type | Purpose |
|---|---|---|
| `leadById` | `Map<string, EnrichedLead>` | Lead detail, CSV evidence resolution |
| `leadsByBranch` | `Map<string, EnrichedLead[]>` | Branch scoping — the hottest path |
| `leadsByRep` | `Map<string, EnrichedLead[]>` | Rep detail, rep outlier rule |
| `deliveryByLeadId` | `Map<string, EnrichedDelivery>` | The lead↔delivery join |
| `targetsByBranchMonth` | `Map<string, RawTarget>` | Attainment |
| `repById`, `branchById` | `Map<string, …>` | Reference resolution |

Arrays inside the singleton are treated as immutable. Analytics functions must copy before sorting
— an in-place sort would mutate shared state across requests and make output depend on request
order, breaking FR-010.

---

## 5. `Filters`

```ts
type TimePreset = 'last30' | 'last90' | 'month' | 'full' | 'custom';

interface Filters {
  preset: TimePreset;
  from: Date;          // always resolved — never null
  to: Date;            // always resolved — never null
  month: string | null;// 'YYYY-MM' when preset === 'month'
  branchId: string | null;
}
```

Parsing is **total**: `parseFilters(searchParams)` never throws. Unrecognised presets, malformed
dates, inverted ranges, and unknown branch ids all fall back to the default (`full`, no branch).
A bad URL must render the default view, not an error page (FR-035, SC-006).

`from`/`to` are always concrete even for `full`, so downstream code has no null branches.
Rolling presets resolve against `DATA_AS_OF`, not the system clock (FR-026, research R6).

---

## 6. `AnalyticsContext` — the single input

Every analytics and insight function takes this and nothing else. That is what makes the layer
testable by constructing one object.

```ts
interface AnalyticsContext {
  filters: Filters;

  // Window-scoped — respects both time range and branch filter
  leads: EnrichedLead[];           // filtered on created_at
  deliveries: EnrichedDelivery[];  // filtered on delivery_date
  priorLeads: EnrichedLead[];      // preceding window of equal length
  priorDeliveries: EnrichedDelivery[];
  hasPriorPeriod: boolean;         // false when the prior window falls outside coverage

  // Detection-scoped — ignores time range, respects branch filter (FR-009, FR-009a)
  detectionLeads: EnrichedLead[];

  // Always full-group, regardless of any filter — comparison baselines
  groupLeads: EnrichedLead[];
  groupDeliveries: EnrichedDelivery[];

  dataset: Dataset;                // indexes and reference data
  asOf: Date;                      // === DATA_AS_OF
}
```

**The three scopes are the most important thing in this document.** Getting them confused is the
likeliest correctness bug in the build:

- `leads` / `deliveries` — windowed metrics. Leads filter on `created_at`, deliveries on
  `delivery_date` (FR-030). Different date fields, deliberately.
- `detectionLeads` — insight rules only. Branch filter applied, time range **not** applied, so a
  narrow window never hides an active problem while a branch selection still scopes the feed.
- `groupLeads` — comparison baselines for rules 2, 5, 6 and 8. A branch's contact rate is
  meaningless without the group figure to judge it against, so these ignore the branch filter even
  when one is set. FR-009a requires the group figure to remain visible in a narrowed view.

`hasPriorPeriod` is false when the preceding window would extend before the data's first record;
consumers must suppress the delta rather than compare against a partial period (FR-002, spec edge
case: Prior period does not exist).

---

## 7. `Insight`

```ts
interface Insight {
  id: string;                  // `${ruleSlug}:${entityId}` — deterministic, URL-safe
  rule: InsightRuleSlug;
  severity: Severity;
  title: string;               // names the entity: "Lakeside Toyota is not contacting its leads"
  body: string;                // plain English, states the threshold breached
  impactRupees: number | null; // null where no money is at stake; sorts last, never as 0
  metric: { value: number; comparison: number | null; unit: 'pct' | 'days' | 'rupees' | 'count' };
  entity: { kind: 'branch' | 'rep' | 'channel' | 'group'; id: string; label: string };
  href: string;                // drill-through, carries current filters (FR-029)
  evidence: string[];          // lead ids — required, never empty (FR-008)
}
```

**Invariants**

- `evidence` non-empty. A rule that cannot name its records must not emit an insight (FR-008).
- `href` always populated. Same requirement.
- `body` states the threshold that fired, so no alert asks to be taken on trust (FR-011).
- `impactRupees: null` is distinct from `0` — "no money involved" must not sort as "zero rupees at
  stake" ahead of genuine values.
- `id` is stable across runs and is the handle the CSV endpoint resolves (research R10).

**Ordering** (FR-007, total): severity rank (`critical` 0, `warning` 1, `info` 2) → `impactRupees`
descending with `null` last → `id` ascending. The final tiebreak guarantees a total order
independent of rule execution sequence.

---

## 8. Entity relationships

```
Branch 1──* Rep 1──* Lead 1──0..1 Delivery
   │                    │
   │                    └──* StatusHistoryEntry  (ordered; the authority for stage progression)
   └──* Target  (one per branch-month; may be absent)
```

Every lead carries `branch_id` directly as well as via its rep. Verified consistent across all 510
records, but branch scoping uses `lead.branch_id` — a lead belongs to the branch that received it,
not to wherever its rep might later move.

---

## 9. Verified fixtures

These are the numbers `tests/fixtures.ts` pins (Constitution V). All computed directly from
`docs/dealership_data.json` during Phase 0.

| Fixture | Value |
|---|---|
| Funnel (ever-reached) | 510 → 391 → 300 → 235 → 198 → 160 |
| Lakeside (B3) contact rate | 46 / 79 = 58.2% |
| Peer contact rates | B1 82.5% · B2 78.9% · B4 81.6% · B5 78.0% |
| Lakeside delivered rate | 6 / 79 = 7.6% (group 31.4%) |
| Stuck orders — all | 38, ₹85,860,000 = ₹8.59 Cr |
| Stuck orders — alerting (≥27d) | 25 |
| Oldest stuck order | 195 days |
| Delivered revenue | ₹388,760,000 = ₹38.88 Cr |
| Target units total | 1,426 → attainment **11.2%** (not 13% — research R2) |
| Target revenue total | ₹313.01 Cr → revenue attainment 12.4% |
| Losses by stage (status_history-derived, see decision-log.md) | new 112 · contacted 75 · test_drive 55 · negotiation 32 (total 274) |
| Channel conversion | walk_in 45.7% · auto_expo 30.2% · referral 30.1% · website 28.0% · phone 27.8% · social_media 13.9% |
| Deliveries by month | Jul 16 · Aug 18 · Sep 24 · Oct 20 · Nov 30 · Dec 52 |
| Avg days to deliver | 18.3 (min 7, max 39); 72 of 160 delayed |
| `DATA_AS_OF` | 2025-12-31T19:10:00Z |
