export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-grid p-8 text-center"
    >
      <p className="text-sm font-medium text-ink-primary">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-secondary">{description}</p>}
    </div>
  );
}
