import { Card } from "./Card";

export interface StatTileProps {
  label: string;
  value: string;
  deltaText?: string | null;
  caveat?: string;
}

export function StatTile({ label, value, deltaText, caveat }: StatTileProps) {
  return (
    <Card hoverable className="relative overflow-hidden">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent to-accent-hover"
      />
      <div className="text-sm text-ink-secondary">{label}</div>
      <div className="tabular-nums mt-1 text-2xl font-semibold text-ink-primary">{value}</div>
      {deltaText !== undefined && deltaText !== null && (
        <div className="tabular-nums mt-1 text-sm text-ink-secondary">{deltaText}</div>
      )}
      {caveat && <div className="mt-2 text-xs text-ink-muted">{caveat}</div>}
    </Card>
  );
}
