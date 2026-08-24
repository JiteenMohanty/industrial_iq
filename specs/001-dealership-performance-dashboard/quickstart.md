# Quickstart & Validation Guide

**Feature**: Dealership Performance Dashboard (DealerPulse)

How to run the product and prove it works. Validation scenarios only — implementation belongs in
`tasks.md`.

## Prerequisites

- Node.js 20 LTS or later
- The dataset at `src/data/dealership_data.json` (the original, pre-scaffold copy — since
  deliberately removed from the repository per the user's own decision, see ADR-0010 — is never
  modified while it exists)

## Setup

```bash
# from C:\Projects\Assignment  (the application root and the git root — see ADR-0010)
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run build        # production build — must be clean, zero type errors
npm run test         # vitest run — analytics + insight suite
npm run lint
```

## Gate 1 — Test suite green

```bash
npx vitest run
```

Asserts the verified fixtures in [data-model.md §9](./data-model.md). The suite must pin at
minimum:

- Funnel 510 → 391 → 300 → 235 → 198 → 160
- Lakeside contact rate 58.2% (46/79); peers 78.0–82.5%
- 38 stuck orders, ₹8.59 Cr; 25 of them ≥27 days
- Group attainment **11.2%** by units — **not 13%** (see research R2)
- Losses by stage (status_history-derived): new 112 · contacted 75 · test_drive 55 · negotiation 32
- social_media 13.9% conversion at 14.1% volume share

If any assertion fails, the analytics are wrong — do not adjust the fixture to match the code.
Constitution V requires a decision-log entry explaining any fixture change *before* it is made.

## Gate 2 — Dataset absent from the client bundle

The hard constitutional gate (Principle I).

```bash
npm run build
grep -rl "Lakeside Toyota" .next/static/ || echo "PASS — dataset not in client bundle"
grep -rl "customer_name" .next/static/  || echo "PASS — no raw lead shape in client bundle"
```

Either match means a client component is importing dataset code. Trace the import chain — the
`server-only` guard on `lib/data/dataset.ts` should have failed the build first, so a match here
also means the guard is missing.

Also confirm no single client chunk approaches 620 KB.

## Gate 3 — Route walkthrough (`npm run dev`)

| # | Scenario | Expected |
|---|---|---|
| 1 | Open `/` cold, no query params | Top 5 alerts visible without scrolling; count of further alerts shown; **a Lakeside (B3) alert ranks first** |
| 2 | Read the top alert | Names Lakeside, states 33 never-contacted, shows ₹ impact and the 70% threshold it breached |
| 3 | Click it | Lands on `/branches/B3`, filters preserved |
| 4 | Request its call list | CSV downloads as `dealerpulse-never-contacted-B3-2025-12-31.csv`; opens in Excel; names render; `Deal Value (INR)` sorts numerically |
| 5 | Switch to `?preset=month&month=2025-09` | Every figure recomputes; URL updates; **alerts unchanged** (FR-009) |
| 6 | Add `&branch=B1` | Alert feed narrows to Downtown Toyota; comparative alerts still show the group figure (FR-009a) |
| 7 | Select a branch with no alerts | "No detected problems" message, not an empty region (FR-009b) |
| 8 | `?preset=custom&from=2025-01-01&to=2025-02-01` | Empty states everywhere; no crash, no `NaN`, no `₹0` presented as fact |
| 9 | `?preset=garbage&branch=B99` | Silently renders the default full-range view (url-state contract) |
| 10 | `/branches/B9` | Clear not-found state |
| 11 | Copy any filtered URL into a private window | Identical view, identical figures (SC-007) |
| 12 | `/funnel`, toggle branch overlay to B3 | B3 shape against group; divergence visible without arithmetic |
| 13 | `/deliveries` | ₹8.59 Cr headline over **38** orders; watchlist sorted by age × value; delay reasons broken down |
| 14 | Open any lead | Full `status_history` timeline in chronological order |
| 15 | Freshness banner | "Data as of 31 Dec 2025" plus months behind live, on every route |

## Gate 4 — Storytelling acceptance (SC-001)

Show `/` to someone who has never seen the data. **Within 30 seconds, unprompted, they should be
able to say which branch is failing and why.** If they cannot, the Action Center is not doing its
job — this is 20% of the assignment score and it is not fixable by adding charts.

## Gate 5 — Responsive (SC-009)

1440px · 1024px · 768px. No horizontal page scroll at any width. Nav collapses under `lg`, KPI grid
4→2, charts reflow, tables become card lists on narrow widths.

## Gate 6 — Accessibility (FR-037, SC-009a)

WCAG 2.1 Level AA:

- Contrast ≥4.5:1 body text, ≥3:1 large text and control boundaries
- Full keyboard traversal of every interactive element, sensible order, visible focus
- Accessible name on every control and every chart
- No information by colour alone — severity and chart series carry a label, shape, or annotation

Run an automated audit (axe/Lighthouse) plus a manual keyboard pass; automated tools miss focus
order and colour-alone encoding.

## Gate 7 — Deploy

Import the repository into Vercel directly — the application lives at the git root, so no Root
Directory override is needed (ADR-0010; supersedes the earlier nested-layout requirement in
ADR-0001/research R8).

After deploy, re-run Gates 3 and 5 against the live URL and confirm it renders identically to the
local production build.

## Definition of done

All seven gates pass · `DECISIONS.md` and `README.md` written ·
`docs/decisions/decision-log.md` current for every phase (Constitution).
