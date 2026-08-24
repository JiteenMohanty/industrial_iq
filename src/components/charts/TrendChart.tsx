"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { COLOR } from "@/lib/theme";
import { formatCount } from "@/lib/format";

export interface TrendChartPoint {
  month: string;
  deliveredUnits: number;
  leadsCreated: number;
}

function monthLabel(monthKey: string): string {
  const parts = monthKey.split("-").map(Number);
  const year = parts[0] ?? 2025;
  const month = parts[1] ?? 1;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-surface p-2 text-xs shadow-lg">
      <div className="font-medium text-ink-primary">{label ? monthLabel(label) : ""}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="tabular-nums text-ink-secondary">
          {entry.name}: {formatCount(entry.value)}
        </div>
      ))}
    </div>
  );
}

/** Accepts a small pre-computed series — never a lead collection (Constitution I). */
export function TrendChart({ data }: { data: TrendChartPoint[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Delivered units and leads created by month">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLOR.grid.light} vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            stroke={COLOR.ink.mutedLight}
            tickLine={false}
            axisLine={{ stroke: COLOR.grid.light }}
            fontSize={12}
          />
          <YAxis
            stroke={COLOR.ink.mutedLight}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={32}
          />
          <Tooltip content={<TrendTooltip />} />
          <Line
            type="monotone"
            dataKey="deliveredUnits"
            name="Delivered"
            stroke={COLOR.accent}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR.accent }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="leadsCreated"
            name="Leads created"
            stroke={COLOR.ink.mutedLight}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3, fill: COLOR.ink.mutedLight }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
