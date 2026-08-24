# DealerPulse

A performance dashboard for a five-branch Toyota dealership group: where the business is losing
deals, which branch is failing and why, what's stuck in delivery, and how each branch and rep
compares. Built with Next.js 15 (App Router, Server Components), TypeScript, Tailwind CSS, and
Recharts.

See [`DECISIONS.md`](./DECISIONS.md) for the narrative behind what was built and why. See
[`docs/decisions/decision-log.md`](./docs/decisions/decision-log.md) for the full chronological
implementation log.

## Prerequisites

- Node.js 20 LTS or later (developed and verified against Node 24)
- npm

## Setup

```bash
npm install
```

## Run

```bash
npm run dev          # http://localhost:3000, with hot reload
```

```bash
npm run build         # production build
npm run start          # serve the production build
```

## Test

```bash
npm run test          # vitest run — analytics + insight suite
npm run test:watch    # watch mode
npm run lint           # eslint
```

## Project structure

```
src/
  app/                 # Next.js App Router routes (Server Components)
  components/          # UI, chart, filter, and lead components
  lib/
    analytics/         # pure functions: AnalyticsContext in, view-shaped data out
    data/               # dataset parsing/enrichment (the only module touching the raw JSON)
    filters/            # URL <-> Filters parsing, the single source of view state
    insights/           # the nine detection rules and the ranking engine
    format.ts, time.ts  # display formatting and time semantics
  data/
    dealership_data.json  # the dataset (never modified)
docs/decisions/         # decision-log.md (chronological) and architecture-decisions.md (ADRs)
specs/001-dealership-performance-dashboard/  # spec, plan, data model, contracts, tasks
```

## Deploying to Vercel

The application lives at the repository root — import the repo directly with no Root Directory
override. See ADR-0010 in `docs/decisions/architecture-decisions.md`.

No environment variables are required; the dataset ships in the repository at
`src/data/dealership_data.json`.
