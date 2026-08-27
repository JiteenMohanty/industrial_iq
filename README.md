# DealerPulse

A decision-support dashboard for a five-branch Toyota dealership group. It answers, in this order:
what is our position, where is the business being lost, why, and which specific records do I work
today.

The product is built around one structural finding in the data: the funnel is strictly sequential
and **the test drive is an absolute gate** — of 391 contacted leads, the 91 that never took a test
drive produced zero deliveries. Two gates before that point, *did we call them* and *did we get them
into a car*, decide ₹52.16 Cr of pipeline before any closing skill applies.

Built with Next.js 15 (App Router, Server Components), TypeScript strict, Tailwind CSS 4, Recharts,
and Vitest.

**Start here**: [`DECISIONS.md`](./DECISIONS.md) — what was built and why, the tradeoffs, the
patterns found in the data, the known limitations, and what would come next.

## Prerequisites

- Node.js 20 LTS or later (developed against Node 24)
- npm

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run start
```

## Test

```bash
npm run test
```

```bash
npm run lint
```

226 tests across 34 files. They cover the analytics and insight layers against figures verified
directly from the dataset, plus a design-token contrast suite that asserts every text/background
pair clears its WCAG 2.1 AA floor in both themes.

## What's where

```
src/
  app/                    routes, all Server Components
    page.tsx              Overview — position, the gates, Action Center, trend, branch scorecard
    funnel/               stage funnel, branch overlay, stage durations, loss analysis
    models/               customer-interest heatmap, model economics
    sources/              lead-source scorecard, revenue per lead
    branches/             branch benchmark and per-branch detail
    reps/                 rep benchmark, volume-vs-efficiency quadrant, per-rep detail
    deliveries/           stuck orders, delay reasons, promise reliability
    leads/                the evidence explorer every alert links into
    api/call-list/        per-alert CSV download (the only HTTP endpoint)
  lib/
    data/                 parsing, enrichment, indexing — the only module touching the raw JSON
    analytics/            pure functions: AnalyticsContext in, view-shaped data out
    insights/             eleven detection rules, thresholds, ranking and headline selection
    filters/              URL <-> Filters, the single source of view state
    theme.ts, format.ts, time.ts
  data/
    dealership_data.json  the dataset, never modified
docs/decisions/           chronological decision log and formal ADRs
specs/
  001-.../                first submission's spec (retained as history)
  002-gate-first-dashboard/  the spec, plan and tasks this build was executed against
tests/                    analytics, insights, filters, export, design
```

## Architecture in one paragraph

Everything is computed on the server. `lib/data/dataset.ts` is the only module that imports the
dataset and carries a `server-only` guard, so an accidental client import fails the build; the
620 KB file never reaches the browser. The URL is the only view state — time range, branch, heatmap
dimension, trend metric, lead cohort, sort — so every view is reproducible and shareable by address,
and there is no client filter store anywhere. Most charts are server-rendered HTML/CSS or inline
SVG with native tooltips, so seven of nine routes ship no chart JavaScript at all (~106 kB first
load); Recharts is used only where a crosshair or scatter tooltip genuinely earns its weight.

## Deploying to Vercel

Import the repository directly — the application lives at the git root and needs no Root Directory
override. No environment variables are required; the dataset ships in the repository.
