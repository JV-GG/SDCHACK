"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
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
  const { claim, pipeline, notice, error, retry } = useClaim();
  const [reviewGrant, setReviewGrant] = useState<string | null>(null);
  const [packetGrant, setPacketGrant] = useState<string | null>(null);

  if (!claim) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-body text-rose-600 font-medium mb-3">Backend Error: {error}</p>
          <button
            onClick={() => void retry()}
            className="rounded-[var(--radius-control)] bg-ink px-4 py-2 text-body font-medium text-surface cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <LoaderCircle size={28} className="animate-spin text-accent mb-3" />
        <h2 className="text-section font-semibold">Connecting to Live Engine...</h2>
        <p className="text-body text-muted mt-1">Evaluating grant rules and DeepSeek AI narrative via FastAPI</p>
      </div>
    );
  }

  const eligible = eligibleGrants(claim);
  const lead = eligible[0];
  const status = claim.status;

  let finding: string;
  if (!lead) {
    finding = `No grant matches invoice ${claim.invoice.invoiceNumber}. Open a grant below to see which rules were not met.`;
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
      ? { label: "Review and sign off", run: () => setReviewGrant(lead?.grantId ?? null) }
      : {
          label: status === "APPROVED" ? "Open application packet" : "View application packet",
          run: () => setPacketGrant(lead?.grantId ?? null),
        };

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
            className="h-9 flex-none rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90 disabled:opacity-60 cursor-pointer"
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
              {eligible.length} of {claim.evaluations.length} grants match. Rules are checked deterministically by Python rules engine.
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
                  onReview={() => setReviewGrant(g.grantId)}
                  reviewLabel={status === "EVALUATED" ? "Review and sign off" : "View sign-off"}
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
        initialGrantId={reviewGrant ?? lead?.grantId ?? ""}
        onApproved={() => {
          setPacketGrant(reviewGrant ?? lead?.grantId ?? null);
          setReviewGrant(null);
        }}
      />
      <ApplicationPacketModal
        open={packetGrant !== null}
        onClose={() => setPacketGrant(null)}
        initialGrantId={packetGrant ?? lead?.grantId ?? ""}
      />
    </div>
  );
}
