# Implementation Plan: Dealership Performance Dashboard (DealerPulse)

**Branch**: `001-dealership-performance-dashboard` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dealership-performance-dashboard/spec.md`

## Summary

A server-rendered analytics product over a fixed 620 KB dealership extract (5 branches, 30 reps,
510 leads, 35 targets, 160 deliveries; June–December 2025). Every figure is computed on the server
by pure functions; the browser receives only small view-shaped objects and never the dataset.

The technical approach is a single Next.js App Router application with no database, no auth, and
no API surface beyond one CSV route handler. The dataset is parsed, enriched, and indexed once at
module scope and reused across requests. Filter state lives entirely in `searchParams`, so React
Server Components recompute from the URL and every view is a shareable link. Insights come from
nine pure rule functions with fixed absolute thresholds, ranked by severity then rupee impact —
no LLM, no network call, no nondeterminism.

Three layers, sharply separated: **data** (parse/enrich/index), **analytics** (pure aggregations
over an `AnalyticsContext`), **insights** (pure rules over the same context). Everything below the
`app/` directory is testable without a DOM, which is what makes Principle V achievable.

## Technical Context

**Language/Version**: TypeScript 5.6+ in `strict` mode, targeting Node.js 20 LTS

**Primary Dependencies**: Next.js 15 (App Router, React Server Components), React 19,
Tailwind CSS 4, Recharts 2 (client-only chart rendering), Vitest 2 (analytics/insight tests)

**Storage**: None. A single static JSON file at `src/data/dealership_data.json`, read and parsed
once at module scope, enriched, indexed, and memoised. No database, no ORM, no cache server, no
persistence of any kind — mandated by the spec's read-only scope boundary (FR-038).

**Testing**: Vitest over `src/lib/**` only. Pure functions, no DOM, no component tests. The suite
asserts the verified dataset fixtures (see Fixture Corrections below) as both regression
protection and proof of correctness, per Constitution Principle V.

**Target Platform**: Vercel (Node.js runtime, not Edge — the module-scope dataset needs a warm
Node process). Modern desktop and tablet browsers at 1440px, 1024px, 768px.

**Project Type**: Web application — a single server-rendered Next.js app. Not a frontend/backend
split; there is no backend to split off, because the "backend" is a JSON file read in-process.

**Performance Goals**: The dataset parses and indexes once per server process (~620 KB, one-time).
Per-request analytics is a handful of passes over 510 leads — microseconds, not a design
constraint. The binding performance requirement is a **negative** one: zero bytes of
`dealership_data.json` may appear in any client chunk. That is verified by inspecting
`.next/static`, not by a latency budget.

**Constraints**:
- No dataset in the client bundle (Constitution I) — the hard gate.
- No LLM or network call anywhere in the analytics or insight path (Constitution II).
- `DATA_AS_OF` computed from the data, never hardcoded (Constitution VII).
- Deterministic output: identical data + filters → byte-identical insights, always (FR-010).
- WCAG 2.1 Level AA (FR-037).

**Scale/Scope**: 510 leads · 30 reps · 5 branches · 35 branch-months of targets · 160 deliveries ·
7 routes · 9 insight rules · 1 CSV route handler. Single-tenant, single shared view, no accounts.

## Fixture Corrections (blocking — read before implementing)

Every figure in the source `plan.md` §2 was re-verified directly against
`docs/dealership_data.json` during this planning pass. Most hold exactly. **Two do not**, and both
are pinned as test fixtures in the Constitution and the spec, so they must be corrected before any
test is written against them.

| Figure | `plan.md` / spec / constitution says | Actual | Verdict |
|---|---|---|---|
| Group funnel | 510 → 391 → 300 → 235 → 198 → 160 | identical | ✅ correct |
| Lakeside contact rate | 58% | 58.2% (46 of 79) | ✅ correct |
| Stuck orders | 38 orders, ₹8.59 Cr | 38, ₹85,860,000 = ₹8.59 Cr | ✅ correct |
| Delivered revenue | ₹38.9 Cr | ₹38.88 Cr | ✅ correct |
| Avg order→delivery | 18.3 days, max 39 | 18.3, max 39 | ✅ correct |
| Channel conversion | walk_in 46 · referral/expo 30 · web/phone 28 · social 14 | 45.7 · 30.1/30.2 · 28.0/27.8 · 13.9 | ✅ correct |
| **Group target attainment** | **≈13%** | **11.2% by units** (160/1426); 12.4% by revenue | ❌ **wrong** |
| **Losses at `new`** | **118 of 288** | **112 of 274** (status_history-derived) | ❌ **wrong** |
| Oldest stuck order | 195 days | 195 days from `DATA_AS_OF` | ✅ correct (see decision-log.md — the planning-time "194" recheck was itself wrong, a PowerShell timezone artifact) |

**Resolution**: the spec's SC-003 has been corrected to **11.2% by units**, and the implementation
MUST assert 11.2%, not 13%. Neither unit nor revenue attainment rounds to 13%, so this is an
arithmetic error in the source plan rather than a definitional difference.

**Losses-at-`new` required a second correction during implementation, not just planning.** The
first-pass fix during `/speckit-plan` (118 → 120) was itself computed by trusting the raw `status`
field to select "lost" leads, without verifying `status_history` actually contained a `lost`
transition. 14 leads carry `status: "lost"` with no `lost` entry in their history at all (and
`lost_reason: null` on every one — corroborating they were never really lost). Constitution III
requires `status_history` to win. The properly-derived figures are **274 total losses**, **112 at
`new`**. Full investigation in `docs/decisions/decision-log.md`.

**Constitution amendment required**: Principle V pins "Group target attainment ≈ 13%" as a
mandatory fixture. That line is factually wrong and must be amended to 11.2% via
`/speckit-constitution` before the test suite is written, otherwise Principle V and the data
disagree. Recorded as ADR-0009 and in the decision log.

**Also clarified**: "38 stuck orders" and "the stuck-order alert" are two different sets. All 38
`order_placed` leads with no delivery are stuck and make up the ₹8.59 Cr headline (FR-019). Only
**25 of them** are ≥27 days old and therefore fire insight rule 3 (FR-011). Both numbers are
correct; the implementation must not conflate them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Pre-Phase-0 | Post-Phase-1 |
|---|---|---|---|
| I. Server-side analytics, zero dataset on client | No client component imports `dataset.ts`; all analytics run in RSC or route handlers; verified against `.next/static` | ✅ Pass — design puts every `lib/` module behind server-only entry points | ✅ Pass — see Client Boundary below |
| II. Deterministic insights, no LLM | Rules are `(ctx) => Insight[]`; no network, no AI dependency | ✅ Pass | ✅ Pass — rule contract is pure, ranking is total-ordered |
| III. Honest numbers | Targets shown as-is with caveat; `status_history` authoritative | ✅ Pass | ✅ Pass — plus two source-figure errors caught and corrected |
| IV. Actionable and drillable | Every insight carries `href` + `evidence` | ✅ Pass | ✅ Pass — `href` and `evidence` are required fields, not optional |
| V. Tested against real fixtures | Vitest over `lib/`, asserting verified numbers | ⚠️ Conditional — one pinned fixture (13%) is wrong | ✅ Pass once ADR-0009 amendment lands |
| VI. URL is the only filter state | No client filter store or context | ✅ Pass | ✅ Pass — `Filters` parsed from `searchParams` only |
| VII. Single source of truth for time/format | `time.ts` and `format.ts` own all date math and currency | ✅ Pass | ✅ Pass — no other module may call `Date.now()` or format currency |

**Technology constraints**: locked stack honoured exactly (Next.js 15 · TS strict · Tailwind ·
Recharts · Vitest · no DB/ORM/auth/API layer · Vercel). One addition — a CSV route handler — is
covered by ADR-0006 and is not a general API layer.

**Decision records**: `docs/decisions/architecture-decisions.md` (ADR-0001…0009) and
`docs/decisions/decision-log.md` are both created by this planning pass, satisfying the
Decision Records section. Both were empty before this run, so there were no prior decisions to
contradict.

**Gate result**: **PASS**, conditional on the ADR-0009 constitution amendment before Phase 5
(tests). No unjustified violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-dealership-performance-dashboard/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── url-state.md         # searchParams ⇄ Filters contract
│   ├── analytics-api.md     # analytics module signatures
│   ├── insight-rules.md     # rule contract + all 9 rules
│   └── call-list-csv.md     # GET /api/call-list route handler
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks — NOT by this command
```

### Source Code (repository root)

Application root is `C:\Projects\Assignment\Assignment` — the Spec Kit root and this session's
working directory. See ADR-0001 for why, and for the Vercel root-directory consequence.

```text
DECISIONS.md                        reviewer-facing deliverable (assignment requirement)
README.md
docs/
  decisions/
    decision-log.md                 append-only dev journal (Constitution)
    architecture-decisions.md       ADR-0001 … ADR-0009 (Constitution)
src/
  data/
    dealership_data.json            copy of ../docs/dealership_data.json; original untouched
  app/
    layout.tsx                      shell: nav, freshness banner, filter bar
    page.tsx                        Overview — KPI tiles, Action Center, trend, branch table
    loading.tsx                     skeleton (one per route)
    funnel/page.tsx                 Conversion funnel + branch overlay
    deliveries/page.tsx             Stuck orders + delivery ops
    branches/page.tsx               Branch comparison
    branches/[branchId]/page.tsx    Branch detail + rep table
    reps/[repId]/page.tsx           Rep detail
    api/call-list/route.ts          CSV download (the only HTTP endpoint)
  lib/
    time.ts                         DATA_AS_OF · REAL_NOW · age helpers — sole source of time
    format.ts                       ₹ lakh/crore · dates · deltas · pct — sole source of display
    data/
      types.ts                      raw + enriched domain types
      dataset.ts                    parse → enrich → index, module-memoised, React cache()
    filters/
      types.ts                      Filters, TimePreset
      parse.ts                      searchParams → Filters (total, never throws)
      apply.ts                      Filters → filtered lead/delivery sets
    analytics/
      context.ts                    AnalyticsContext builder — the single input to everything
      kpis.ts · funnel.ts · targets.ts · pipeline.ts
      reps.ts · trends.ts · channels.ts · deliveries.ts
    insights/
      types.ts                      Insight, Severity, InsightId
      rules/                        nine files, one rule each
      engine.ts                     run all rules → rank → InsightId assignment
    export/
      csv.ts                        evidence set → CSV text (pure)
  components/
    ui/                             Card · StatTile · Badge · DataTable · EmptyState · Skeleton · Sheet
    charts/                         FunnelChart · TrendChart · ComparisonBar · StageMix
    filters/                        TimeRangeFilter · BranchFilter
    insights/                       InsightCard · InsightFeed
    leads/                          LeadTable · LeadDetailSheet
tests/
  analytics/                        one spec per analytics module
  insights/                         one spec per rule + engine ranking
  fixtures.ts                       the verified numbers, in one place
```

**Structure Decision**: Single Next.js application, no frontend/backend split. The three-layer
separation that matters here is *within* `src/lib/` — data → analytics → insights — because that
is the boundary tests run against and the boundary Principle I defends. Directories mirror the
source `plan.md` §4 tree exactly, with two additions justified by the spec: `src/lib/export/` and
`src/app/api/call-list/` for the CSV call list (ADR-0006), and `tests/` for the Vitest suite.

### Client Boundary (Constitution I enforcement)

Exactly three categories of module may carry `"use client"`:

1. `components/charts/*` — Recharts requires a browser. Each accepts a small pre-computed series
   array, never a lead collection.
2. `components/filters/*` — control interaction, then push to the URL.
3. `components/leads/LeadDetailSheet` and `components/ui/Sheet` — open/close state.

Every one of these receives view-shaped props. No client component may import from
`lib/data/`, `lib/analytics/`, or `lib/insights/`. `lib/data/dataset.ts` carries the
`server-only` package import so a violation fails the build rather than shipping silently.

## Module & Data-Flow Design

```
searchParams ──► filters/parse ──► Filters
                                     │
src/data/*.json ─► data/dataset ─────┼──► analytics/context ─► AnalyticsContext
   (module scope, once)              │                             │
                                     │            ┌────────────────┴────────────────┐
                                     │            ▼                                 ▼
                                     │      analytics/*  (pure)            insights/engine (pure)
                                     │            │                                 │
                                     │            ▼                                 ▼
                                     └──────►  view models ──────────────────►  RSC pages
                                                                                   │
                                                                          small props only
                                                                                   ▼
                                                                            client components
```

**Single input rule**: every analytics and insight function takes `AnalyticsContext` and returns a
plain serialisable object. No module reaches for the dataset directly; no module calls `Date.now()`
except `time.ts`. This is what makes the whole layer testable by constructing one context.

**Two-scope rule**: `AnalyticsContext` carries *both* the filtered lead set (for windowed metrics)
and the full lead set (for insight detection), because FR-009 requires alerts to ignore the time
range while FR-009a requires them to respect the branch filter. Getting this wrong is the single
most likely correctness bug in the build; the context makes the distinction explicit rather than
leaving it to each call site.

## Complexity Tracking

No constitutional violations requiring justification. Table intentionally empty.

## Phase Outputs

- **Phase 0** → [research.md](./research.md) — resolved unknowns, verified figures, rejected options
- **Phase 1** → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)
- **Phase 2** → `tasks.md`, created by `/speckit-tasks` (not this command)
