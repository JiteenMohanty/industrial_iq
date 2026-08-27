import type { HeatmapMatrix } from "@/lib/analytics/models";
import { rampIndex, RAMP_STEPS } from "@/lib/theme";
import { formatCount, formatCurrency } from "@/lib/format";

/**
 * Customer-interest heatmap: model demand against branch, acquisition source, or month.
 *
 * Form choice: the job is a two-dimensional magnitude field where the reader needs to spot both
 * hot rows and cold cells. A grid of colour-encoded cells is the only form that shows all 35–49
 * values at once and makes an outlier cell findable without scanning a legend; the alternative —
 * seven grouped bar charts — spends far more space and hides exactly the row/column comparison
 * that matters.
 *
 * Colour is a **single-hue sequential ramp** (dataviz skill: sequential = one hue, light→dark;
 * never a rainbow), with its own selected steps for dark mode rather than an inverted copy. The
 * number is printed in every cell, so colour is redundant reinforcement and never the sole
 * encoding — which is also what keeps this readable in greyscale and under forced-colors.
 *
 * Both the fill and its ink come from paired CSS variables (`--color-seq-N` / `--color-seq-ink-N`)
 * rather than from a JS theme flag. That is deliberate: resolving the ramp in JS made the cells
 * depend on client state that changes after hydration, which put light-ramp and dark-ramp cells on
 * screen simultaneously. Variables re-theme atomically and keep this a Server Component, so no
 * chart JS ships for this route at all.
 *
 * Rate metrics are suppressed below a minimum sample rather than shown: a single-lead cell reading
 * "100% conversion" is noise, and a heatmap that renders it invites exactly the wrong conclusion.
 */
export function InterestHeatmap({ matrix }: { matrix: HeatmapMatrix }) {
  const cellFor = (rowKey: string, colKey: string) =>
    matrix.cells.find((c) => c.rowKey === rowKey && c.colKey === colKey);

  const display = (value: number | null): string => {
    if (value === null) return "–";
    return matrix.metric === "volume" ? formatCount(value) : `${Math.round(value)}%`;
  };

  return (
    <div className="space-y-3">
      <div className="scroll-x">
        <table
          className="w-full border-separate text-sm"
          style={{ borderSpacing: 2, minWidth: 520 }}
        >
          <caption className="sr-only">
            {matrix.metricLabel} by model and {matrix.colLabel.toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-40 px-1 pb-1 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                  {matrix.rowLabel}
                </span>
              </th>
              {matrix.cols.map((col) => (
                <th key={col.key} scope="col" className="px-1 pb-1 text-center align-bottom">
                  <span className="block text-[11px] font-semibold capitalize text-ink-secondary">
                    {col.label}
                  </span>
                  <span className="block text-[10px] tabular-nums text-ink-muted">
                    {formatCount(col.total)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="px-1 text-left align-middle">
                  <span className="block truncate text-xs font-medium text-ink-primary">
                    {row.label}
                  </span>
                  <span className="block text-[10px] tabular-nums text-ink-muted">
                    {formatCount(row.total)} leads
                  </span>
                </th>
                {matrix.cols.map((col) => {
                  const cell = cellFor(row.key, col.key);
                  const intensity = cell?.intensity ?? null;
                  const idx = rampIndex(intensity);
                  const tooltip = cell
                    ? `${row.label} · ${col.label}\n` +
                      `${formatCount(cell.leads)} leads\n` +
                      `${formatCount(cell.delivered)} delivered\n` +
                      `${formatCurrency(cell.revenueRupees)} revenue` +
                      (cell.value === null && cell.leads > 0
                        ? `\nToo few leads for a reliable rate (min ${matrix.minSampleForRate})`
                        : "")
                    : "No leads";
                  return (
                    <td
                      key={col.key}
                      title={tooltip}
                      className="h-11 rounded text-center align-middle transition-transform duration-100 hover:scale-[1.06]"
                      style={{
                        backgroundColor: `var(--color-seq-${idx})`,
                        // Secondary ink, not muted, for the "no data" dash: muted measures 3.26:1
                        // against the lightest ramp step, under the 4.5:1 floor. A placeholder is
                        // still text.
                        color:
                          intensity === null
                            ? "var(--color-ink-secondary)"
                            : `var(--color-seq-ink-${idx})`,
                      }}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {display(cell?.value ?? null)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          {matrix.metricLabel}: low
          <span className="flex" aria-hidden="true">
            {RAMP_STEPS.map((i) => (
              <span
                key={i}
                className="h-3 w-4 first:rounded-l last:rounded-r"
                style={{ backgroundColor: `var(--color-seq-${i})` }}
              />
            ))}
          </span>
          high
        </span>
        <span>
          Cells show {matrix.metric === "volume" ? "lead count" : matrix.metricLabel.toLowerCase()};
          hover for the full breakdown.
        </span>
        {matrix.metric !== "volume" && (
          <span>“–” = fewer than {matrix.minSampleForRate} leads, too few for a rate.</span>
        )}
      </div>
    </div>
  );
}
