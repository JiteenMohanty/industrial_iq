import type { ReactNode } from "react";

/**
 * Empty state. Always says *why* it is empty and what would change it — an empty region with no
 * explanation reads as a loading failure, which is exactly the confusion FR-009b and FR-035 exist
 * to prevent.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-border-strong bg-surface px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink-primary">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
