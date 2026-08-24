"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { COLOR } from "@/lib/theme";
import type { FunnelStagePoint } from "@/lib/analytics/funnel";

function stageLabel(stage: string): string {
  return stage.replace("_", " ");
}

interface ChartRow {
  stage: string;
  groupPct: number;
  branchPct?: number;
}

/**
 * Two lines indexed to "% of top" rather than raw counts — the group (510 leads) and a branch
 * (as few as 79) are different absolute scales, and the dataviz skill's rule is explicit: two
 * measures of different scale share one axis only when indexed to a common base. A percentage
 * axis is that common base, and it's what makes divergence ("this branch collapses here") visible
 * as two lines splitting apart rather than requiring the reader to do arithmetic on two bar
 * charts of different heights.
 */
export function FunnelChart({
  group,
  branch,
  branchLabel,
}: {
  group: FunnelStagePoint[];
  branch?: FunnelStagePoint[];
  branchLabel?: string;
}) {
  const data: ChartRow[] = group.map((g, i) => ({
    stage: stageLabel(g.stage),
    groupPct: g.pctOfTop,
    branchPct: branch?.[i]?.pctOfTop,
  }));

  return (
    <div className="h-72 w-full" role="img" aria-label="Conversion funnel, percentage of leads reaching each stage">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLOR.grid.light} vertical={false} />
          <XAxis dataKey="stage" stroke={COLOR.ink.mutedLight} tickLine={false} fontSize={12} />
          <YAxis
            stroke={COLOR.ink.mutedLight}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={36}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="groupPct"
            name="Group"
            stroke={COLOR.ink.mutedLight}
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3, fill: COLOR.ink.mutedLight }}
          />
          {branch && (
            <Line
              type="monotone"
              dataKey="branchPct"
              name={branchLabel ?? "Branch"}
              stroke={COLOR.accent}
              strokeWidth={2}
              dot={{ r: 3, fill: COLOR.accent }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
