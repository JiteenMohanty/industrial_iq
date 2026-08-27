/**
 * Inline trend glyph for a table cell — direction of travel, not readable values.
 *
 * Deliberately unlabelled and axis-free: at this size a reader can honestly perceive shape and
 * nothing more, so the component encodes only shape and the accessible label carries the actual
 * series for anyone who needs the numbers. Server-rendered SVG, no client JS.
 */
export function Sparkline({
  points,
  label,
  width = 76,
  height = 22,
}: {
  points: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) {
    return <span className="text-[11px] text-ink-muted">—</span>;
  }

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / span) * height;
    return [x, y] as const;
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const rising = (points[points.length - 1] ?? 0) >= (points[0] ?? 0);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${points.join(", ")}`}
      className="overflow-visible"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        className={rising ? "text-good" : "text-critical"}
      />
      {last && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2}
          className={rising ? "text-good" : "text-critical"}
          fill="currentColor"
        />
      )}
    </svg>
  );
}
