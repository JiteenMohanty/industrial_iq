import { FUNNEL_STAGES } from "@/lib/data/types";
import type { FunnelResult } from "@/lib/analytics/funnel";
import { formatCount, formatPercent } from "@/lib/format";

const STAGE_LABEL: Record<string, string> = {
  new: "New lead",
  contacted: "Contacted",
  test_drive: "Test drive",
  negotiation: "Negotiation",
  order_placed: "Order placed",
  delivered: "Delivered",
};

/**
 * Stage funnel with an optional single-branch overlay.
 *
 * Two encodings, deliberately: bar width carries the absolute population (how many leads are still
 * alive at this stage), and the step-conversion figure beside it carries the rate. A funnel drawn
 * on width alone hides the thing managers actually compare — a branch can look fine on width
 * simply because it received more leads.
 *
 * The overlay is a second, inset bar rather than a second chart, so divergence is read as a length
 * difference at the same baseline instead of by flicking between two panels. Both series are
 * direct-labelled, so identity never rests on colour (WCAG 2.1 AA), and the whole thing is
 * server-rendered HTML — no chart library, no client JS, no hydration cost.
 */
export function FunnelChart({
  group,
  overlay,
  overlayLabel,
}: {
  group: FunnelResult;
  overlay?: FunnelResult | undefined;
  overlayLabel?: string | undefined;
}) {
  const groupTop = group.stages[0]?.count ?? 1;
  const overlayTop = overlay?.stages[0]?.count ?? 1;

  return (
    <div
      className="space-y-3"
      role="img"
      aria-label={
        `Conversion funnel. Group: ` +
        group.stages
          .map((s) => `${STAGE_LABEL[s.stage] ?? s.stage} ${s.count}`)
          .join(", ") +
        (overlay && overlayLabel
          ? `. ${overlayLabel}: ` +
            overlay.stages.map((s) => `${STAGE_LABEL[s.stage] ?? s.stage} ${s.count}`).join(", ")
          : "") +
        "."
      }
    >
      {overlay && overlayLabel && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm bg-series-1" />
            <span className="text-ink-secondary">All branches</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-4 rounded-sm bg-series-2" />
            <span className="text-ink-secondary">{overlayLabel}</span>
          </span>
          <span className="text-ink-muted">
            Bars are scaled within each series, so shapes compare directly despite different lead
            volumes.
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {FUNNEL_STAGES.map((stage, i) => {
          const g = group.stages.find((s) => s.stage === stage);
          const o = overlay?.stages.find((s) => s.stage === stage);
          if (!g) return null;

          const gShare = (g.count / groupTop) * 100;
          const oShare = o ? (o.count / overlayTop) * 100 : null;
          const gStep = i === 0 ? null : g.stepConversionPct;
          const oStep = i === 0 ? null : (o?.stepConversionPct ?? null);
          const behind =
            gStep !== null && oStep !== null ? oStep - gStep : null;

          return (
            <div key={stage}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink-primary">
                  {STAGE_LABEL[stage] ?? stage}
                </span>
                <span className="flex items-baseline gap-3 text-xs tabular-nums">
                  {gStep !== null && (
                    <span className="text-ink-secondary">
                      {formatPercent(gStep)} <span className="text-ink-muted">step</span>
                    </span>
                  )}
                  <span className="font-semibold text-ink-primary">{formatCount(g.count)}</span>
                </span>
              </div>

              <div className="mt-1 h-5 w-full overflow-hidden rounded bg-raised">
                <div className="h-full rounded bg-series-1" style={{ width: `${gShare}%` }} />
              </div>

              {overlay && oShare !== null && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-3 flex-1 overflow-hidden rounded bg-raised">
                    <div className="h-full rounded bg-series-2" style={{ width: `${oShare}%` }} />
                  </div>
                  <span className="w-32 shrink-0 text-right text-[11px] tabular-nums text-ink-secondary">
                    {formatCount(o?.count ?? 0)}
                    {oStep !== null && ` · ${formatPercent(oStep, 0)}`}
                    {behind !== null && Math.abs(behind) >= 5 && (
                      <span className={behind < 0 ? "text-critical-ink" : "text-good-ink"}>
                        {" "}
                        ({behind > 0 ? "+" : "−"}
                        {Math.abs(Math.round(behind))}pp)
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
