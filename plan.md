# DealerPulse — Implementation Plan

> Working document for the build. Tracks scope, architecture, and phase progress.
> Source brief: [`docs/ASSIGNMENT.md`](docs/ASSIGNMENT.md) · Dataset: [`docs/dealership_data.json`](docs/dealership_data.json)

---

## 1. Context

Forward Deployed Engineer take-home: build a real web product — not a demo — that lets a dealership group's CEO and branch managers understand performance and **act** on it.

**Dataset**: 5 branches, 30 reps, 510 leads with full `status_history`, 35 monthly targets, 160 deliveries. June–December 2025.

**Deliverables**: Vercel-deployed live link + `DECISIONS.md` in the project root.

**Scoring**: Product Thinking 30% · Design & UX 25% · Technical Quality 25% · Insight & Storytelling 20%.

Greenfield build — the repo contains only the assignment and the dataset.

---

## 2. What the data actually says

Verified by direct analysis. These findings drive every product decision below.

| Finding | Numbers |
|---|---|
| **Lakeside Toyota (Bangalore) is collapsing** | Only 58% of its leads are ever contacted vs 78–82% everywhere else; 33 of 79 leads (42%) never contacted at all. Funnel decays to 8% delivered vs 32–41% at peers. 6 units delivered in 7 months. |
| **It's coverage, not speed** | Avg new→contacted is 1.9–2.0 days at *every* branch, Lakeside included. The leads aren't worked slowly — they're never worked. |
| **Lakeside also burns the most money** | Highest lost value in the group, ₹17.3 Cr, despite having the fewest leads. |
| **₹8.59 Cr of orders never delivered** | 38 leads sit at `order_placed` with no delivery — 22% of the ₹38.9 Cr actually delivered in 7 months. Worst: Eastside (12), Central (9), Highway (7). Oldest is 195 days stale. |
| **Targets are fiction** | Group attainment ≈13% (160 delivered vs 1,426 target units). Every branch lands between 2% and 15%. |
| **Channel quality varies 3x** | walk_in 46% · referral/auto_expo 30% · website/phone 28% · **social_media 14%**. |
| **Funnel shape (group)** | 510 new → 391 contacted (77%) → 300 test drive → 235 negotiation → 198 order → 160 delivered. Biggest single leak is new→contacted: 119 leads never touched. |
| **Loss concentration** | 118 of 288 losses happen at `new` — never contacted — avg 2.6 days after creation. |
| **Ops** | Avg 18.3 days order→delivery, max 39. Top delay reasons: customer date change (18), logistics (11), factory allocation (11). |
| **Momentum is real** | Deliveries climbing 16 → 18 → 24 → 20 → 30 → 52 per month, Jul–Dec. |

**The story the dashboard must tell:** *the group is growing, but one branch is failing at first contact, and ₹8.59 Cr is stuck in undelivered orders.*

---

## 3. Locked decisions

1. **Stack** — Next.js 15 (App Router) + TypeScript + Tailwind + Recharts.
2. **No AI/LLM features.** Insights come from a deterministic rule engine: reproducible, no API key, no latency, no hallucination, works for any reviewer.
3. **Differentiators to build** — Action Center, Conversion Funnel + branch overlay, Stuck-order/Delivery board. Rep *coaching* diagnostic deprioritised; basic rep drill-down still built (hard requirement).
4. **Targets** — show real attainment against official targets with an explicit data-quality callout that targets appear set ~7x actual capacity. Steer the eye to trend and branch-relative comparison. No invented baseline, no forecast against fantasy numbers.
5. **Reference date** — real wall-clock date drives a visible data-freshness banner; all aging/pacing math computes against the dataset's own last date (`2025-12-31`) so alerts still rank meaningfully.

---

## 4. Architecture

**Core principle: all dataset processing happens on the server.** Pages are React Server Components that read filter state from `searchParams`, run the analytics layer, and pass small computed objects to client components for charts and interaction. The 620 KB JSON never reaches the browser.

```
DECISIONS.md                      ← required deliverable
README.md
plan.md
src/
  data/dealership_data.json       ← copy of docs/ original (docs/ stays untouched)
  app/
    layout.tsx                    shell: nav, freshness banner, filter bar
    page.tsx                      Overview
    funnel/page.tsx               Conversion funnel + branch overlay
    deliveries/page.tsx           Stuck orders + delivery ops
    branches/page.tsx             Branch comparison
    branches/[branchId]/page.tsx  Branch detail + rep table
    reps/[repId]/page.tsx         Rep detail
    loading.tsx (per route)       skeletons
  lib/
    time.ts                       DATA_AS_OF, REAL_NOW, age helpers ← single source of truth
    format.ts                     ₹ lakh/crore, dates, deltas, pct
    data/types.ts                 Lead, Branch, Rep, Target, Delivery, Stage
    data/dataset.ts               parse + enrich + index once, module-memoised
    filters/                      searchParams ⇄ typed Filters, applyFilters()
    analytics/                    kpis · funnel · targets · pipeline · reps · trends
    insights/                     types · rules · engine
  components/
    ui/                           Card, StatTile, Badge, DataTable, EmptyState, Skeleton, Sheet
    charts/                       FunnelChart, TrendChart, ComparisonBar, StageMix
    filters/                      TimeRangeFilter, BranchFilter
    insights/                     InsightCard, InsightFeed
    leads/                        LeadTable, LeadDetailSheet (status_history timeline)
```

### 4.1 Data layer — `src/lib/data/dataset.ts`

Parse the raw JSON once at module scope; build an enriched, indexed structure reused by every request.

- **Enriched lead**: `stageTimestamps` (stage → first timestamp, derived from `status_history`), `currentStage`, `reachedStages: Set`, `lostFromStage`, `createdAt`/`lastActivityAt` as `Date`, `ageDays`, `daysSinceActivity`, `isOpen`, `delivery` (joined from `deliveries`).
- **Indexes**: `byId`, `byBranch`, `byRep`, `deliveryByLeadId`, `targetsByBranchMonth`, `repById`, `branchById`.
- Wrap the per-request entry point in React `cache()`.

> `status_history` is the source of truth for stage transitions — never infer from `status` alone.

### 4.2 Time semantics — `src/lib/time.ts`

- `DATA_AS_OF` — max timestamp in the dataset (`2025-12-31`), **computed, not hardcoded**.
- `REAL_NOW` — actual current date, used **only** for the freshness banner: "Data as of 31 Dec 2025 · N months behind live".
- Every aging/pacing helper takes `DATA_AS_OF` as its reference. One constant to flip if the dataset is refreshed.

### 4.3 Filters — URL as state

Filter state lives in `searchParams` (`?from=&to=&branch=&preset=`), so server components recompute on change and **every view is a shareable link** — sharing for free, no export feature needed.

Presets: Last 30 days · Last 90 days · each month Jun–Dec 2025 · Full range · Custom.

Per-metric time semantics (to be documented in `DECISIONS.md`):
- Lead counts filter on `created_at`
- Revenue/units filter on `delivery_date`
- Alerts always evaluate current open state, regardless of the selected range

### 4.4 Insight engine — `src/lib/insights/`

Each rule is a pure `(ctx: AnalyticsContext) => Insight[]`. An `Insight` carries `severity` (critical/warning/info), `title`, plain-English `body`, `impactRupees`, `metric`, `entity` (branch/rep/lead), `href` for drill-through, and `evidence` (the lead IDs behind it). The engine runs all rules and ranks by severity, then ₹ impact.

Rules:

1. **Never-contacted leads** — open leads that never reached `contacted`. Fires hard on Lakeside.
2. **Branch contact-rate outlier** — contact rate significantly below group median.
3. **Stuck orders** — `order_placed` beyond ~1.5x the 18.3-day group average, with ₹ locked up.
4. **Cold open leads** — no activity in 7 / 14 / 30-day buckets.
5. **Branch funnel collapse** — a stage conversion far below group median.
6. **Rep outlier** — meaningful lead volume, conversion far below branch peers.
7. **Lost-reason concentration** — one reason spiking at a single branch.
8. **Channel quality** — low-converting source consuming meaningful lead volume (social_media).
9. **Delivery delay concentration** — one delay reason dominating at a branch.

> Every insight is click-through. An alert that can't be drilled into isn't actionable.

### 4.5 Pages

| Route | Contents |
|---|---|
| `/` **Overview** | Freshness banner · 4–5 KPI tiles (delivered units & revenue, conversion rate, open pipeline value, attainment w/ caveat — each with prior-period delta) · **Action Center** feed as the visual anchor · delivery/lead trend chart · compact branch comparison table with sparklines · top/bottom reps |
| `/funnel` | Group funnel with per-stage drop-off % · branch overlay toggle · stage-duration strip · side cards for lost reasons and source quality |
| `/deliveries` | ₹8.59 Cr stuck-order watchlist sorted by age × value · delay-reason breakdown · days-to-deliver distribution · branch delivery performance |
| `/branches` → `/branches/[id]` | Comparison grid → per-branch KPIs, its funnel vs group, its alerts, its rep table |
| `/reps/[id]` | KPIs, funnel, assigned leads with aging |
| Lead detail sheet | Full `status_history` timeline — the drill-down floor and a strong storytelling moment |

### 4.6 Design & UX

Single accent + neutral scale · semantic severity colours · one type scale · generous whitespace · tabular numerals on all figures.

Indian currency formatting (₹ lakh/crore) throughout — **₹8.59 Cr, not ₹85,900,000**. Deltas always carry direction and comparison basis.

Real `loading.tsx` skeletons per route; a genuine `EmptyState` for filtered-to-zero.

Desktop-first, tablet-verified: nav collapses under `lg`, KPI grid 4→2, charts reflow, tables become card lists on narrow widths.

> Before writing any chart code, load the `dataviz` skill and follow its palette/form guidance.

### 4.7 Testing

Vitest over the analytics and insight layers (pure functions, no DOM). Assert the real numbers from §2 as fixtures — Lakeside 58% contact rate, 38 stuck orders at ₹8.59 Cr, funnel 510→391→300→235→198→160, group attainment ≈13%. These double as regression tests and as proof the analytics are correct.

---

## 5. Execution phases

- [ ] **1. Scaffold** — Next.js 15 + TS + Tailwind + Recharts + Vitest; copy dataset to `src/data/`; strict tsconfig; path aliases
- [ ] **2. Data & analytics** — types, `dataset.ts` enrichment/indexing, `time.ts`, `format.ts`, filters, all `analytics/*` modules, with tests
- [ ] **3. Insight engine** — rule types, nine rules, ranking engine, tests
- [ ] **4. Design system & shell** — `ui/*` primitives, layout, nav, freshness banner, filter bar
- [ ] **5. Overview page** — KPI tiles, Action Center, trend chart, branch table
- [ ] **6. Funnel page**
- [ ] **7. Deliveries page**
- [ ] **8. Drill-downs** — branches, branch detail, rep detail, lead sheet
- [ ] **9. Polish** — responsive pass, loading/empty states, a11y (labels, contrast, keyboard), payload-size check
- [ ] **10. Docs & deploy** — `DECISIONS.md`, `README.md`, Vercel deploy

---

## 6. Verification

- `npm run build` — clean, zero type errors; confirm the JSON is **not** in any client chunk (inspect `.next/static`)
- `npx vitest run` — analytics/insight suite green, asserting the §2 fixture numbers
- `npm run dev`, then walk every route:
  - Overview → click an Action Center item → lands on the right branch/rep/lead with filters preserved
  - Change time range → all views recompute, URL updates
  - Select a range with no data → empty states, not crashes
- **Acceptance test for storytelling (20%)**: the Lakeside story is discoverable in under 30 seconds from a cold open
- Responsive check at 1440px, 1024px, and 768px (tablet portrait) — no horizontal page scroll
- Deploy to Vercel, verify the live link renders identically to the production build

---

## 7. Open items

- Vercel deploy needs account access — either authorise the deploy, or take a repo that imports cleanly into Vercel.
