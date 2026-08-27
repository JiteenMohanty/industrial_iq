"use client";

import { useRouter } from "next/navigation";
import type { LeadDetail } from "@/lib/analytics/leads";
import { Sheet } from "@/components/ui/Sheet";
import { Pill } from "@/components/ui/Badge";
import { formatCurrency, formatDate, formatDays } from "@/lib/format";

function stageLabel(value: string): string {
  return value.replace("_", " ");
}

/**
 * FR-025, the deepest drill-down level: a lead's complete `status_history` as a chronological
 * timeline, including each entry's note — the strongest storytelling moment in the product (a
 * reader can see, in the customer's own recorded events, exactly where and why a deal stalled).
 * A vertical rail with one marker per entry rather than a table: `status_history` is inherently a
 * sequence of events over time, and a timeline reads as "what happened, in order" the way a table
 * of rows does not — see decision-log.md.
 *
 * URL-driven, not local state (Constitution VI): `lead` is resolved server-side from `?lead=<id>`
 * by the calling page, so `open` is derived from whether a lead was found, and `closeHref` is the
 * same page with `lead` stripped — closing the sheet is a navigation, not a client state mutation,
 * which is what keeps "any lead anywhere" shareable via a plain URL.
 */
export function LeadDetailSheet({
  lead,
  closeHref,
}: {
  lead: LeadDetail | null;
  closeHref: string;
}) {
  const router = useRouter();
  const close = () => router.push(closeHref);

  return (
    <Sheet open={lead !== null} onClose={close} title={lead ? lead.customerName : "Lead detail"}>
      {lead && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-ink-secondary">Branch</div>
              <div className="font-medium text-ink-primary">{lead.branchLabel}</div>
            </div>
            <div>
              <div className="text-ink-secondary">Sales rep</div>
              <div className="font-medium text-ink-primary">{lead.repName}</div>
            </div>
            <div>
              <div className="text-ink-secondary">Model interested</div>
              <div className="font-medium text-ink-primary">{lead.modelInterested}</div>
            </div>
            <div>
              <div className="text-ink-secondary">Deal value</div>
              <div className="font-medium text-ink-primary">
                {formatCurrency(lead.dealValueRupees)}
              </div>
            </div>
            <div>
              <div className="text-ink-secondary">Source</div>
              <div className="font-medium text-ink-primary">{stageLabel(lead.source)}</div>
            </div>
            <div>
              <div className="text-ink-secondary">Age</div>
              <div className="font-medium text-ink-primary">{formatDays(lead.ageDays)}</div>
            </div>
          </section>

          <section className="flex items-center gap-2">
            <Pill>{lead.isOpen ? "Open" : stageLabel(lead.status)}</Pill>
            <span className="text-sm text-ink-secondary">
              Current stage: {stageLabel(lead.currentStage)}
            </span>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-primary">Stage history</h3>
            <ol className="space-y-4 border-l-2 border-grid pl-4">
              {lead.statusHistory.map((entry) => (
                <li key={`${entry.status}-${entry.timestamp}`} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent"
                  />
                  <div className="text-sm font-medium text-ink-primary">
                    {stageLabel(entry.status)}
                  </div>
                  <div className="text-xs text-ink-secondary">
                    {formatDate(new Date(entry.timestamp))}
                  </div>
                  {entry.note && <p className="mt-1 text-sm text-ink-secondary">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Sheet>
  );
}
