"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { chartColors } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeProvider";
import { formatCurrency, formatCount } from "@/lib/format";

export interface TrendPoint {
  label: string;
  revenueRupees: number;
  units: number;
  medianCycleDays: number | null;
  targetUnits: number;
  leadsCreated: number;
}

export type TrendMetric = "revenue" | "units" | "cycle" | "leads";

/**
 * Monthly trend, one measure at a time.
 *
 * The metric is a control rather than extra series on a second axis. Revenue (crore), units
 * (count) and cycle time (days) have nothing in common numerically, and putting any two of them on
 * one plot with two y-scales lets the reader "see" a relationship that the scales invented — the
 * single most common way a dashboard chart lies. Switching is a URL change, so a particular view
 * stays shareable.
 *
 * Units carries its monthly target as a reference line: same measure, same axis, so the comparison
 * is legitimate. The targets are known to be unreliable and the caller labels them as such.
 */
export function TrendChart({
  data,
  metric,
  showTarget = false,
}: {
  data: TrendPoint[];
  metric: TrendMetric;
  showTarget?: boolean;
}) {
  const { theme } = useTheme();
  const c = chartColors(theme === "dark");

  const spec = {
    revenue: {
      key: "revenueRupees" as const,
      name: "Delivered revenue",
      kind: "bar" as const,
      color: c.series[0] as string,
      fmt: (v: number) => formatCurrency(v),
      axisFmt: (v: number) => `₹${(v / 10_000_000).toFixed(1)}Cr`,
    },
    units: {
      key: "units" as const,
      name: "Units delivered",
      kind: "bar" as const,
      color: c.series[0] as string,
      fmt: (v: number) => formatCount(v),
      axisFmt: (v: number) => formatCount(v),
    },
    cycle: {
      key: "medianCycleDays" as const,
      name: "Median sales cycle",
      kind: "line" as const,
      color: c.series[1] as string,
      fmt: (v: number) => `${v} days`,
      axisFmt: (v: number) => `${v}d`,
    },
    leads: {
      key: "leadsCreated" as const,
      name: "Leads received",
      kind: "bar" as const,
      color: c.series[2] as string,
      fmt: (v: number) => formatCount(v),
      axisFmt: (v: number) => formatCount(v),
    },
  }[metric];

  const maxTarget = Math.max(...data.map((d) => d.targetUnits), 0);

  return (
    <div
      style={{ width: "100%", height: 260 }}
      role="img"
      aria-label={`${spec.name} by month. ${data
        .map((d) => `${d.label}: ${d[spec.key] === null ? "no data" : spec.fmt(d[spec.key] as number)}`)
        .join("; ")}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: c.muted, fontSize: 11 }}
            axisLine={{ stroke: c.baseline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: c.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={spec.axisFmt}
          />
          <Tooltip
            cursor={{ fill: c.grid, fillOpacity: 0.35 }}
            contentStyle={{
              background: c.surface,
              border: `1px solid ${c.grid}`,
              borderRadius: 8,
              fontSize: 12,
              color: c.ink,
            }}
            labelStyle={{ color: c.ink, fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number | string) => [
              value === null ? "No data" : spec.fmt(Number(value)),
              spec.name,
            ]}
          />
          {showTarget && metric === "units" && maxTarget > 0 && (
            <Line
              type="monotone"
              dataKey="targetUnits"
              stroke={c.muted}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              name="Monthly target"
              isAnimationActive={false}
            />
          )}
          {spec.kind === "bar" ? (
            <Bar
              dataKey={spec.key}
              fill={spec.color}
              radius={[4, 4, 0, 0]}
              name={spec.name}
              isAnimationActive={false}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={spec.key}
              stroke={spec.color}
              strokeWidth={2}
              dot={{ r: 3, fill: spec.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              name={spec.name}
              connectNulls
              isAnimationActive={false}
            />
          )}
          <ReferenceLine y={0} stroke={c.baseline} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
