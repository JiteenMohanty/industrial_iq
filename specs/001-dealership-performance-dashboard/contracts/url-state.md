# Contract: URL State (`searchParams` ⇄ `Filters`)

The URL is the **only** filter state in the product (Constitution VI, FR-028). There is no client
filter store, no context provider, no `localStorage`. Every view is therefore a shareable link.

## Query parameters

| Param | Values | Default | Notes |
|---|---|---|---|
| `preset` | `last30` · `last90` · `month` · `full` · `custom` | `full` | Unrecognised → `full` |
| `month` | `YYYY-MM`, `2025-06`…`2025-12` | — | Read only when `preset=month`; out-of-range → `full` |
| `from` | `YYYY-MM-DD` | — | Read only when `preset=custom` |
| `to` | `YYYY-MM-DD` | — | Read only when `preset=custom` |
| `branch` | `B1`…`B5` | none | Unknown id → no branch filter |
| `insights` | `all` | absent | Present = feed expanded past top 5 (FR-007a) |

Parameters are omitted from the URL when at their default, so the cold-open URL is a bare path.

## Resolution

```
parseFilters(searchParams: URLSearchParams): Filters
```

**Total function — never throws.** Every malformed input degrades to the default rather than
erroring (FR-035, SC-006). Specifically:

| Input | Result |
|---|---|
| `preset=nonsense` | `full` |
| `preset=month&month=2024-01` | `full` (outside coverage) |
| `preset=custom` with missing/unparseable `from`/`to` | `full` |
| `preset=custom&from=2025-09-01&to=2025-07-01` (inverted) | Swapped, then applied |
| `branch=B9` / `branch=<script>` | Ignored; no branch filter |
| Custom range wholly outside coverage | Accepted as given; views render empty states |

Rolling presets resolve against `DATA_AS_OF`, **not** the system clock (FR-026, research R6):

- `last30` → `[DATA_AS_OF − 30d, DATA_AS_OF]` = `[2025-12-01, 2025-12-31]`
- `last90` → `[DATA_AS_OF − 90d, DATA_AS_OF]` = `[2025-10-02, 2025-12-31]`
- `full` → `[MIN_DATE, DATA_AS_OF]` = `[2025-06-01, 2025-12-31]`

`from`/`to` on the returned `Filters` are always concrete `Date`s, including for `full`, so no
downstream code branches on null.

## Serialisation

```
buildHref(path: string, filters: Filters, overrides?: Partial<Filters>): string
```

The **only** sanctioned way to construct an internal link. Every drill-through — insight `href`,
branch row, rep row, chart click, breadcrumb — goes through it, which is what satisfies FR-029
(filter state preserved on drill-through) without each call site remembering to do it.

Round-trip guarantee: `parseFilters(buildHref(p, f)) ≡ f` for all valid `f`. Worth a property test.

## Boundary rule

`searchParams` is read **only** in `app/**/page.tsx` and `app/api/**/route.ts`, then immediately
converted to `Filters`. No module under `lib/` ever sees a raw `searchParams` — they take `Filters`
or `AnalyticsContext`. This keeps the analytics layer independent of Next.js and testable without
constructing a request.
