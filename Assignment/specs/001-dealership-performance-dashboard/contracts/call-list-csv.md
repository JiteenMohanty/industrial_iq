# Contract: `GET /api/call-list`

The product's only HTTP endpoint. Implements FR-039, FR-040, FR-040a, FR-041.

> **Deviation note**: source `plan.md` §4.3 argues URL-as-state means "no export feature needed".
> This endpoint is a deliberate, narrow deviation driven by spec FR-039 — per-alert only, fixed
> columns, no configuration. Recorded as ADR-0006.

## Request

```
GET /api/call-list?insight=<insightId>&preset=<…>&branch=<…>&from=<…>&to=<…>
```

| Param | Required | Notes |
|---|---|---|
| `insight` | yes | An `Insight.id`, e.g. `never-contacted:B3` |
| filter params | no | Same contract as [url-state.md](./url-state.md); must match the view the reader was on so the evidence set matches what they saw |

## Response

**200** — `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="..."`

Filename: `dealerpulse-<slug>-<entityId>-<DATA_AS_OF date>.csv`
→ `dealerpulse-never-contacted-B3-2025-12-31.csv`

Identifies the alert and the data's coverage date without opening the file (FR-040).

**404** — insight id not found in the current ranked set. Plain-text body. An id can legitimately
vanish when filters change; this is expected, not an error condition to log.

**400** — `insight` missing.

## Columns

Fixed. Not configurable (spec Out of Scope). Header row uses plain language, not field names
(FR-040a).

| Header | Source | Notes |
|---|---|---|
| `Lead ID` | `lead.id` | Findable in the dealership's own system |
| `Customer` | `lead.customer_name` | |
| `Phone` | `lead.phone` | Quoted — leading digits must not be read as a number |
| `Branch` | `lead.branch.name` | |
| `Sales Rep` | `lead.rep.name` | |
| `Model` | `lead.model_interested` | |
| `Deal Value (INR)` | `lead.deal_value` | Plain integer — no `₹`, no grouping separators |
| `Current Stage` | `lead.currentStage` | |
| `Days Since Activity` | `lead.daysSinceActivity` | Integer |
| `Qualifying Figure` | rule-dependent | The number that put this row on the list (FR-039) |

`Qualifying Figure` per rule: `never-contacted` → days since creation · `stuck-orders` → days since
order placed · `cold-leads` → days since activity · `rep-outlier` → rep's conversion rate ·
others → days since activity.

## Formatting (FR-040a — opens correctly in Excel)

- **UTF-8 BOM** prefix, so Indian customer names render correctly in Excel.
- **CRLF** line endings (RFC 4180).
- Fields containing `,`, `"`, CR or LF are double-quoted; embedded `"` doubled.
- Rupee values as bare integers so spreadsheets parse them as numbers. Lakh/crore formatting is a
  screen concern — a formatted string in a column meant for sorting is worse than useless.
- Phone numbers quoted to preserve leading digits.

## Implementation shape

```ts
// lib/export/csv.ts — pure, unit-testable, no request object
toCsv(rows: CallListRow[]): string
buildCallListRows(insight: Insight, ctx: AnalyticsContext): CallListRow[]
```

The route handler parses filters, builds the context, runs the engine, finds the insight by `id`,
maps `evidence` lead ids through `dataset.leadById`, and serialises. All of it server-side — the
browser receives finished CSV text and never a lead record (Constitution I, research R9).

## Invariants

- **Read-only** (FR-041) — no state written, no figure/alert/ranking altered. Safe to call
  repeatedly.
- **Deterministic** (FR-040) — same insight + same filters → byte-identical file.
- **Never empty** — `Insight.evidence` is non-empty by invariant, so a 200 always carries ≥1 row.
- **Scoped** — only that insight's evidence set. No bulk export path exists (spec Out of Scope).
