"use client";

import Link from "next/link";
import { useState } from "react";
import { eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { ClaimsReviewModal } from "@/components/ClaimsReviewModal";
import { CompanySnapshot } from "@/components/CompanyProfileCard";
import { DashboardStats } from "@/components/DashboardStats";
import { GrantMatrixCard } from "@/components/GrantMatrixCard";
import { JourneyStrip } from "@/components/JourneyStrip";

/** The Grant Hub screen. Its one question: what can we claim for this invoice, and is it ready to sign? */
export function GrantHub() {
  const { claim, pipeline, notice } = useClaim();
  const [reviewGrant, setReviewGrant] = useState<string | null>(null);
  const [packetGrant, setPacketGrant] = useState<string | null>(null);

  const eligible = eligibleGrants(claim);
  const lead = eligible[0];
  const status = claim.status;
  const tips = claim.evaluations.flatMap((e) => e.checks).filter((c) => !c.passed && c.gapAdvice).length;
  const openReview = (id = lead?.grantId) => id && setReviewGrant(id);
  const openPacket = (id = lead?.grantId) => id && setPacketGrant(id);

  let finding: string;
  if (!lead) {
    finding = `No grant matches invoice ${claim.invoice.invoiceNumber}${
      tips > 0 ? `. The engine found ${tips} ways to qualify; they are listed under each grant.` : "."
    }`;
  } else if (eligible.length > 1 && status === "EVALUATED") {
    finding = `Invoice ${claim.invoice.invoiceNumber} qualifies for ${formatMYR(claim.totalClaimableAmountMYR)} across ${eligible
      .map((e) => e.agency)
      .join(" and ")}. Review the drafts and sign off.`;
  } else if (status === "EVALUATED") {
    finding = `Invoice ${claim.invoice.invoiceNumber} qualifies for ${formatMYR(
      claim.totalClaimableAmountMYR,
    )} under ${lead.grantName.replace(/ \(.*\)$/, "")}. Review the draft and sign off.`;
  } else if (status === "APPROVED") {
    finding = `Signed off. Export the application packet to submit to ${lead.agency}.`;
  } else {
    finding = `The packet for ${lead.grantName} was exported for submission to ${lead.agency}.`;
  }

  const primary =
    status === "EVALUATED"
      ? { label: "Review and sign off", run: () => openReview() }
      : { label: status === "APPROVED" ? "Open application packet" : "View application packet", run: () => openPacket() };

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-title font-semibold">Grant Hub</h1>
          <p className="mt-1 max-w-[68ch] text-section text-muted">{finding}</p>
        </div>
        {lead && (
          <button
            type="button"
            onClick={primary.run}
            disabled={pipeline.running}
            className="h-9 flex-none rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90 disabled:opacity-60"
          >
            {primary.label}
          </button>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-[var(--radius-control)] border border-[#fde68a] bg-pill-warning-bg px-3 py-2 text-small text-warning">
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <DashboardStats claim={claim} />
        <JourneyStrip claim={claim} pipeline={pipeline} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="grants-title">
            <h2 id="grants-title" className="text-section font-semibold">
              Grants found for this invoice
            </h2>
            <p className="mb-3 mt-0.5 text-body text-muted">
              {eligible.length} of {claim.evaluations.length} grants match. Rules are checked by the engine, not the model.
            </p>
            {claim.stackingSummary && eligible.length > 1 && (
              <p className="mb-3 rounded-[var(--radius-control)] bg-accent-soft px-3 py-2 text-body">
                {claim.stackingSummary.stackingStrategy}{" "}
                <span className="num text-muted">
                  {claim.stackingSummary.effectiveSubsidyPercentage.toFixed(1)}% of the invoice is co-funded.
                </span>
              </p>
            )}
            <div className="flex flex-col gap-4">
              {[...claim.evaluations]
                .sort((a, b) => Number(b.isEligible) - Number(a.isEligible))
                .map((g) => (
                <GrantMatrixCard
                  key={`${claim.claimId}-${g.grantId}`}
                  grant={g}
                  claim={claim}
                  onReview={() => (status === "EVALUATED" ? openReview(g.grantId) : openPacket(g.grantId))}
                  reviewLabel={status === "EVALUATED" ? "Review and sign off" : "Open packet"}
                />
              ))}
            </div>
          </section>

          <aside className="flex flex-col gap-6" aria-label="Company and activity">
            <section aria-labelledby="company-title">
              <h2 id="company-title" className="mb-2 text-section font-semibold">
                Company on file
              </h2>
              <CompanySnapshot company={claim.company} />
              <Link href="/data" className="mt-2 inline-block text-body font-medium text-accent hover:underline">
                See connected data
              </Link>
            </section>
            <section aria-labelledby="activity-title">
              <h2 id="activity-title" className="mb-3 text-section font-semibold">
                Recent activity
              </h2>
              <AuditTrailTimeline events={claim.auditTrail.slice(-4)} />
              <Link
                href="/audit"
                className="mt-4 inline-flex h-[30px] items-center rounded-[var(--radius-control)] border border-control px-3 text-body font-medium hover:bg-active"
              >
                View full audit trail
              </Link>
            </section>
          </aside>
        </div>
      </div>

      <ClaimsReviewModal
        open={reviewGrant !== null}
        onClose={() => setReviewGrant(null)}
        initialGrantId={reviewGrant ?? undefined}
        onApproved={() => setPacketGrant(reviewGrant)}
      />
      <ApplicationPacketModal
        open={packetGrant !== null}
        onClose={() => setPacketGrant(null)}
        initialGrantId={packetGrant ?? undefined}
      />
    </div>
  );
}
