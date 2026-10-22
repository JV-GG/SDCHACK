"use client";

import { LoaderCircle } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { formatMYR, STATUS_LABEL } from "@/lib/format";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";

/** Every action on the claim, plus who took them. */
export function AuditView() {
  const { claim, error, retry } = useClaim();

  if (!claim) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-body text-rose-600 font-medium mb-3">Backend Error: {error}</p>
          <button
            onClick={() => void retry()}
            className="rounded-(--radius-control) bg-ink px-4 py-2 text-body font-medium text-surface"
          >
            Retry Connection
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <LoaderCircle size={28} className="animate-spin text-accent mb-3" />
        <p className="text-body text-muted">Loading audit trail...</p>
      </div>
    );
  }

  // Count events per actor from the trail itself, so the list always agrees with the timeline.
  const actors = new Map<string, number>();
  for (const e of claim.auditTrail) actors.set(e.performedBy, (actors.get(e.performedBy) ?? 0) + 1);

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="text-title font-semibold">Audit trail</h1>
      <p className="mt-1 max-w-[68ch] text-section text-muted">
        Every action on claim <span className="font-mono">{claim.claimId}</span>, oldest first. Times are Malaysia time (UTC+8).
      </p>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-label="Events"
          className="rounded-(--radius-card) border border-line bg-surface p-5"
        >
          <AuditTrailTimeline events={claim.auditTrail} comfortable />
        </section>
        <aside className="flex flex-col gap-6" aria-label="Claim and actors">
          <section aria-labelledby="audit-claim">
            <h2 id="audit-claim" className="mb-2 text-section font-semibold">
              Claim
            </h2>
            <dl className="rounded-(--radius-card) bg-raised px-4 py-1 text-body">
              {[
                ["Invoice", claim.invoice.invoiceNumber],
                ["Status", STATUS_LABEL[claim.status]],
                ["Claimable", formatMYR(claim.totalClaimableAmountMYR)],
                ["Events", String(claim.auditTrail.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right num">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="audit-actors">
            <h2 id="audit-actors" className="mb-2 text-section font-semibold">
              Who acted
            </h2>
            <ul className="rounded-(--radius-card) bg-raised px-4 py-1 text-body">
              {Array.from(actors.entries()).map(([who, count]) => (
                <li key={who} className="flex items-baseline justify-between gap-4 py-2">
                  <span>{who}</span>
                  <span className="text-muted num">
                    {count} {count === 1 ? "action" : "actions"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
