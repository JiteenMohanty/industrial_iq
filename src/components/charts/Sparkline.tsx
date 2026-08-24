"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import { getChartColors } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeProvider";

/** Shared compact trend line — used in every table row that needs an at-a-glance recent trend. */
export function Sparkline({ points }: { points: number[] }) {
  const { theme } = useTheme();
  const c = getChartColors(theme === "dark");
  const data = points.map((value, i) => ({ i, value }));
  return (
    <div className="h-8 w-24" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={c.accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
