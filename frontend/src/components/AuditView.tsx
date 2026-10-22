"use client";

import { useClaim } from "@/lib/ClaimContext";
import { formatMYR, STATUS_LABEL } from "@/lib/format";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";

/** Every action on the claim, plus who took them. */
export function AuditView() {
  const { claim } = useClaim();

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
          className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
        >
          <AuditTrailTimeline events={claim.auditTrail} comfortable />
        </section>
        <aside className="flex flex-col gap-6" aria-label="Claim and actors">
          <section aria-labelledby="audit-claim">
            <h2 id="audit-claim" className="mb-2 text-section font-semibold">
              Claim
            </h2>
            <dl className="rounded-[var(--radius-card)] bg-raised px-4 py-1 text-body">
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
            <ul className="rounded-[var(--radius-card)] bg-raised px-4 py-1 text-body">
              {[...actors].map(([name, n]) => (
                <li key={name} className="flex items-baseline justify-between gap-4 py-2">
                  <span className="min-w-0 break-words">{name}</span>
                  <span className="flex-none num text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
