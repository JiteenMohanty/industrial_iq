# Implementation Plan: Gate-First Dealership Intelligence (v2)

**Spec**: [`spec.md`](./spec.md) · **Constitution**: v2.0.0 · **Status**: Implemented

## Constitution Check

| Principle | How this plan satisfies it |
|---|---|
| I. Server-side analytics, no dataset on the client | Extended, not weakened. v2 moves *more* work server-side: four chart components that were client-rendered are now server-rendered HTML/CSS, and only two routes ship chart JS at all. |
| II. Deterministic engine, no LLM | Unchanged. Two rules added, both fixed-threshold. |
| III. Honest numbers | Extended. Three new "cannot be computed" statements ship in-product: no inventory-based ADS, no cost-per-lead ROI, no monetary impact on promise reliability. |
| IV. Every insight reaches its own evidence | **This is the principle v2 exists to satisfy.** New `/leads` explorer; every rule gained `evidenceHref` and `action`. |
| V. Fixtures from the shipped code path | New fixtures derived by running the shipped functions, after two were caught wrong when derived otherwise. |
| VI. URL is the only filter state | Extended to every new control: heatmap dimension and metric, trend metric, lead cohort, sort key and direction, branch overlay. No new client state anywhere. |
| VII. Single source of time and formatting | Unchanged. `cycleDays` and `closeSlipDays` both go through `daysBetween`. |
| VIII. Verified by measurement | New. Overflow measured per route; contrast asserted by test; route output parsed for bad tokens. |

## Architecture

The v1 data layer was correct and is **kept**: `dataset.ts` parsing, enrichment, indexing,
memoisation, and the `server-only` guard all survive unchanged in substance. Rebuilding it would
have been churn, and the audit found no defect in it. Judgement here was to replace what was wrong,
not what was merely old.

### Layers

```
data ──────────► analytics ──────────► insights ──────────► routes
dataset.ts       gates, kpis, funnel   11 rules            9 pages + 1 API
types.ts         models, sources       engine (rank        page-context.ts
                 pipeline, deliveries  + headline select)  (one resolve per route)
                 reps, trends, leads
                 benchmark
```

### What was added

| Module | Why |
|---|---|
| `analytics/gates.ts` | The core diagnostic. Takes an explicit lead pool so one function serves the group view and a branch view without scope confusion. |
| `analytics/models.ts` | Model economics, the interest matrix, ASP trend, and the matrix reading used for the storytelling line. |
| `analytics/sources.ts` | Replaces `channels.ts`. Adds gate rates and conversion-among-contacted, which is what separates neglect from quality. |
| `analytics/benchmark.ts` | Ranking, traffic-light status, and null-safe `rate`/`mean`/`median`. Centralised so the same judgement is not re-decided per table. |
| `analytics/leads.ts` (extended) | `queryLeads` — cohort + entity filters + total-ordered sort, reading `detectionLeads` so it matches the alert scope. |
| `filters/page-context.ts` | `resolvePage()` — the four lines every route repeated. Prevents a page building its context from different filters than it renders links with. |

### Data-model additions

`EnrichedLead` gains `wasContacted`, `tookTestDrive`, `cycleDays`, `expectedCloseAt`,
`closeSlipDays`. `Dataset` gains `models`, `sources`, `leadsByModel`, `leadsBySource`. All derived
once at parse time.

### Presentation decisions

**Server-rendered charts by default.** `GateFunnel`, `FunnelChart`, `RankedBar`,
`DistributionBars`, `Sparkline` and `InterestHeatmap` are HTML/CSS or inline SVG with native
`title` tooltips — real hover behaviour, zero JS. Recharts is used only where a crosshair over a
time series or a scatter tooltip genuinely earns its weight: `TrendChart` and `RepScatter`. Result:
seven of nine routes dropped from ~210 kB to ~106 kB first load.

**The heatmap is driven by CSS variables, not a JS theme flag.** Resolving the ramp from
`useTheme()` made cell colour depend on client state that changes after hydration, which put
light-ramp and dark-ramp cells on screen simultaneously. Paired `--color-seq-N` /
`--color-seq-ink-N` variables re-theme atomically and let the component be a Server Component. The
variables live in a plain `:root` block, not `@theme`, because Tailwind v4 tree-shakes theme
variables no utility references — and these are consumed only from an inline `style`.

**One axis, always.** The trend chart switches measure via a URL-driven control rather than
plotting revenue and cycle time on two scales. Two measures of different scale get two views.

**Colour.** The dataviz reference palette, re-validated for this product's surfaces (three-slot
all-pairs: worst CVD ΔE 9.2, worst normal-vision ΔE 24.0). Sequential single-hue ramp for the
heatmap; categorical hues never cycled; status colours never reused as a series and never carried
without a glyph and a word.

## Phases

1. **Discovery** — brief re-read, three-pass EDA, reference-dashboard study, v1 audit, Spec Kit review.
2. **Data & analytics** — type/enrichment extensions, six new or rewritten analytics modules.
3. **Insights** — two new rules, `evidenceHref`/`action` on all eleven, round-robin headline selection.
4. **Design system** — tokens, primitives, charts.
5. **Routes** — nine pages rebuilt or created.
6. **Validation** — build, 226 tests, route smoke test, measured overflow, contrast suite.
7. **Documentation** — constitution amendment, this spec set, `DECISIONS.md`, `README.md`.

## Risks and how they were handled

| Risk | Handling |
|---|---|
| Rebuilding correct code for its own sake | The data layer was audited and kept. Only what the audit faulted was replaced. |
| The gate framing being an artefact of synthetic data | Stated in-product and in `DECISIONS.md` that stage durations are bounded and thresholds would need review against production data. The finding itself (0 of 91) is a fact about this extract regardless. |
| A wider product meaning thinner verification | The opposite was enforced: v2 has 226 tests against v1's 149, plus a contrast suite and a route smoke test that parses rendered output. |
| Scope sprawl across nine routes | Every route answers one question named in its own subtitle. Forecasting, what-if and AI narrative stayed out. |
