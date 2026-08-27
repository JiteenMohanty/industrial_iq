/**
 * Loading placeholders. Shapes mirror the real content's geometry so the page does not jump when
 * figures arrive — a skeleton that is the wrong size is worse than none.
 */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-raised ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2.5 h-7 w-28" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function CardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 w-full" style={{ height }} />
    </div>
  );
}

/** Standard page skeleton: a KPI row over two content blocks. Used by every route's loading.tsx. */
export function PageSkeleton({ tiles = 6 }: { tiles?: number }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: tiles }).map((_, i) => (
          <StatTileSkeleton key={i} />
        ))}
      </div>
      <CardSkeleton height={200} />
      <CardSkeleton height={280} />
    </div>
  );
}
