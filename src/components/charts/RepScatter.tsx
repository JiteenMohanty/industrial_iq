"use client";

import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { chartColors } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeProvider";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface RepScatterPoint {
  repId: string;
  name: string;
  branchName: string;
  /** x — leads assigned. */
  leads: number;
  /** y — conversion rate, 0-100. */
  conversionPct: number;
  /** bubble size — revenue delivered. */
  revenueRupees: number;
  testDriveRatePct: number | null;
}

/**
 * Rep benchmark as a volume-versus-efficiency field.
 *
 * The point of this form is that a ranked table cannot show it: sorting by revenue puts the reps
 * with the most leads on top, sorting by conversion puts the reps with the fewest on top, and
 * neither ordering reveals that those are two different populations. Plotting both axes at once
 * separates "carries a big book" from "converts what they touch", and the two reference lines —
 * the group's own median on each axis, not an invented benchmark — cut the field into four
 * readings a sales manager already thinks in.
 *
 * Only three encodings are used (x, y, and area for revenue), all against one categorical hue:
 * these are 25 instances of one thing, not 25 series, so per-point colour would imply a
 * distinction that does not exist.
 */
export function RepScatter({
  points,
  medianLeads,
  medianConversionPct,
}: {
  points: RepScatterPoint[];
  medianLeads: number;
  medianConversionPct: number;
}) {
  const { theme } = useTheme();
  const c = chartColors(theme === "dark");

  return (
    <div className="space-y-2">
      <div
        style={{ width: "100%", height: 320 }}
        role="img"
        aria-label={
          `Sales reps plotted by leads assigned against conversion rate. ` +
          `Group medians: ${medianLeads} leads, ${formatPercent(medianConversionPct)} conversion. ` +
          points
            .map(
              (p) =>
                `${p.name}, ${p.branchName}: ${p.leads} leads, ${formatPercent(p.conversionPct)} conversion, ${formatCurrency(p.revenueRupees)}`,
            )
            .join("; ")
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="leads"
              name="Leads assigned"
              tick={{ fill: c.muted, fontSize: 11 }}
              axisLine={{ stroke: c.baseline }}
              tickLine={false}
              label={{
                value: "Leads assigned →",
                position: "insideBottom",
                offset: -16,
                fill: c.muted,
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="conversionPct"
              name="Conversion"
              unit="%"
              tick={{ fill: c.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              label={{
                value: "Conversion →",
                angle: -90,
                position: "insideLeft",
                fill: c.muted,
                fontSize: 11,
                style: { textAnchor: "middle" },
              }}
            />
            <ZAxis type="number" dataKey="revenueRupees" range={[60, 460]} name="Revenue" />
            <ReferenceLine
              x={medianLeads}
              stroke={c.muted}
              strokeDasharray="4 4"
              label={{ value: "median load", fill: c.muted, fontSize: 10, position: "top" }}
            />
            <ReferenceLine
              y={medianConversionPct}
              stroke={c.muted}
              strokeDasharray="4 4"
              label={{ value: "median conversion", fill: c.muted, fontSize: 10, position: "right" }}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: c.baseline }}
              contentStyle={{
                background: c.surface,
                border: `1px solid ${c.grid}`,
                borderRadius: 8,
                fontSize: 12,
                color: c.ink,
              }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0]?.payload as RepScatterPoint | undefined;
                if (!p) return null;
                return (
                  <div
                    style={{
                      background: c.surface,
                      border: `1px solid ${c.grid}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: c.ink,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ color: c.inkSecondary }}>{p.branchName}</div>
                    <div style={{ marginTop: 4 }}>
                      {p.leads} leads · {formatPercent(p.conversionPct)} conversion
                    </div>
                    <div>{formatCurrency(p.revenueRupees)} delivered</div>
                    {p.testDriveRatePct !== null && (
                      <div style={{ color: c.inkSecondary }}>
                        {formatPercent(p.testDriveRatePct)} of contacts test-driven
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Scatter
              data={points}
              fill={c.series[0] as string}
              fillOpacity={0.7}
              stroke={c.surface}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-muted">
        Bubble area is revenue delivered. Dashed lines are the group&apos;s own medians, not an
        external benchmark. Top-left converts well on a light book; bottom-right carries volume
        without converting it.
      </p>
    </div>
  );
}
