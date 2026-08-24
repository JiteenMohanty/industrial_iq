"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getChartColors } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeProvider";
import { formatCount } from "@/lib/format";
import type { DelayReasonBucket } from "@/lib/analytics/deliveries";

/**
 * Horizontal bar for the 7-category delay-reason breakdown: ranked categorical comparison with
 * long text labels reads far better horizontal than as a rotated-label vertical chart. Single
 * accent hue throughout — this is one series (count by reason), not several series needing
 * distinct categorical hues.
 */
export function DelayReasonChart({ data }: { data: DelayReasonBucket[] }) {
  const { theme } = useTheme();
  const c = getChartColors(theme === "dark");
  const sorted = [...data].sort((a, b) => a.count - b.count); // ascending so largest renders at top
  const height = Math.max(160, sorted.length * 36);

  return (
    <div style={{ height }} role="img" aria-label="Delivery delay reasons, ranked by frequency">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={c.grid} horizontal={false} />
          <XAxis type="number" stroke={c.mutedInk} tickLine={false} fontSize={12} />
          <YAxis
            type="category"
            dataKey="reason"
            stroke={c.mutedInk}
            tickLine={false}
            axisLine={false}
            width={160}
            fontSize={12}
          />
          <Tooltip
            formatter={(value: number) => formatCount(value)}
            contentStyle={{ fontSize: 12, borderColor: "var(--color-border)" }}
          />
          <Bar dataKey="count" fill={c.accent} radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DISTRIBUTION_BUCKET_SIZE = 5;

export function DeliveryDaysDistribution({ days }: { days: number[] }) {
  const { theme } = useTheme();
  const c = getChartColors(theme === "dark");

  if (days.length === 0) {
    return null;
  }
  const min = Math.min(...days);
  const max = Math.max(...days);
  const bucketStart = Math.floor(min / DISTRIBUTION_BUCKET_SIZE) * DISTRIBUTION_BUCKET_SIZE;
  const bucketEnd = Math.ceil((max + 1) / DISTRIBUTION_BUCKET_SIZE) * DISTRIBUTION_BUCKET_SIZE;

  const buckets: { label: string; count: number }[] = [];
  for (let start = bucketStart; start < bucketEnd; start += DISTRIBUTION_BUCKET_SIZE) {
    const end = start + DISTRIBUTION_BUCKET_SIZE - 1;
    buckets.push({ label: `${start}-${end}d`, count: 0 });
  }
  for (const d of days) {
    const idx = Math.floor((d - bucketStart) / DISTRIBUTION_BUCKET_SIZE);
    const bucket = buckets[idx];
    if (bucket) bucket.count += 1;
  }

  return (
    <div className="h-48 w-full" role="img" aria-label="Distribution of days from order to delivery">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="label"
            stroke={c.mutedInk}
            tickLine={false}
            axisLine={{ stroke: c.grid }}
            fontSize={11}
          />
          <YAxis stroke={c.mutedInk} tickLine={false} axisLine={false} fontSize={12} width={28} />
          <Tooltip
            formatter={(value: number) => formatCount(value)}
            contentStyle={{ fontSize: 12, borderColor: "var(--color-border)" }}
          />
          <Bar dataKey="count" fill={c.accent} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
