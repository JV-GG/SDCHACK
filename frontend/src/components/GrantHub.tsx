"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, FilePlus2, RefreshCw } from "lucide-react";
import { eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { ClaimsReviewModal } from "@/components/ClaimsReviewModal";
import { CompanySnapshot } from "@/components/CompanyProfileCard";
import { DashboardStats } from "@/components/DashboardStats";
import { GrantMatrixCard } from "@/components/GrantMatrixCard";
import { JourneyStrip } from "@/components/JourneyStrip";
import { BackendError } from "@/components/BackendError";
import { GrantHubSkeleton } from "@/components/PageSkeletons";
import { stagger } from "@/lib/motion";
import { OpportunityRadar } from "@/components/OpportunityRadar";

/** The Grant Hub screen. Displays all 7 Malaysian grants with eligible grants at the top and lacking documents at the lower list. */
export function GrantHub() {
  const {
    claim,
    company,
    pipeline,
    notice,
    error,
    retry,
    reEvaluate,
    loading,
    submittedGrants,
    openAuthModal,
    openInvoiceModal,
    pendingReviewGrantId,
    clearPendingReview,
    lastApplicationTarget,
  } = useClaim();
  const [manualReviewGrant, setReviewGrant] = useState<string | null>(null);
  // A year-round application that passed its invoice checks opens straight into Step 4 review.
  const fromApplication =
    manualReviewGrant === null && claim?.status === "EVALUATED" && pendingReviewGrantId !== null;
  const reviewGrant = manualReviewGrant ?? (fromApplication ? pendingReviewGrantId : null);
  const [packetGrant, setPacketGrant] = useState<string | null>(null);

  if (!claim) {
    if (error) return <BackendError message={error} onRetry={() => void retry()} />;
    return <GrantHubSkeleton />;
  }

  const eligible = eligibleGrants(claim);
  const ineligible = claim.evaluations.filter((e) => !e.isEligible);
  const status = claim.status;

  // Filter out any grants that have already been submitted for this organization
  const submittedIds = new Set(submittedGrants.map((s) => s.grantId));
  const activeEligible =
    status === "SUBMITTED" ? [] : eligible.filter((g) => !submittedIds.has(g.grantId));
  const lead = activeEligible[0] ?? eligible[0];

  let finding: string;
  if (status === "SUBMITTED" || (eligible.length > 0 && activeEligible.length === 0)) {
    finding =
      "All eligible grants for this invoice have been submitted. View submission dossiers and audit records in Submitted grants.";
  } else if (!lead) {
    finding = `No grant matches invoice ${claim.invoice.invoiceNumber}. Open a grant below to see which rules or documents are needed.`;
  } else if (status === "EVALUATED") {
    finding = `Invoice ${claim.invoice.invoiceNumber} qualifies for ${formatMYR(
      claim.totalClaimableAmountMYR,
    )} across ${activeEligible.length} agency scheme${activeEligible.length === 1 ? "" : "s"} (lead: ${lead.grantName.replace(/ \(.*\)$/, "")}). Review the draft and sign off.`;
  } else {
    finding = `Signed off. Select any eligible grant below to view and export its official application packet.`;
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <div
        className="anim-reveal flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
        style={stagger(0)}
      >
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-small text-muted mb-1">
            <span>·</span>
            <span className="num">SSM {company.registrationNumber}</span>
            <span>·</span>
            <span>{claim.evaluations.length} Official Malaysian Grants Monitored</span>
          </div>
          <h1 className="text-title font-semibold">Grant Hub</h1>
          <p className="mt-1 max-w-[68ch] text-section text-muted">{finding}</p>
        </div>

        {/* Event-Driven Trigger & Organization Controls */}
        <div className="flex flex-wrap items-center gap-2 flex-none">
          <button
            type="button"
            onClick={() => openInvoiceModal()}
            disabled={pipeline.running || loading}
            className="h-9 flex items-center gap-1.5 rounded-(--radius-control) border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
            title="Trigger Point: Submit a new expenditure invoice"
          >
            <FilePlus2 size={14} className="text-accent" />
            <span>New Invoice Trigger</span>
          </button>
          <button
            type="button"
            onClick={() => void reEvaluate()}
            disabled={pipeline.running || loading}
            className="h-9 flex items-center gap-1.5 rounded-(--radius-control) border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
            title="Re-run live pipeline"
          >
            <RefreshCw size={14} className={pipeline.running ? "animate-spin" : ""} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-(--radius-control) border border-[#fde68a] bg-pill-warning-bg px-3 py-2 text-small text-warning"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <div className="anim-reveal" style={stagger(1)}>
          <DashboardStats claim={claim} />
        </div>
        <div className="anim-reveal" style={stagger(2)}>
          <JourneyStrip claim={claim} pipeline={pipeline} />
        </div>

        <div className="anim-reveal grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" style={stagger(3)}>
          <section aria-labelledby="grants-title" className="flex flex-col gap-6">
            {/* Top Tier: Grants the SME can claim */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <h2 id="grants-title" className="text-section font-semibold">
                  Grants you can claim ({activeEligible.length})
                </h2>
                {activeEligible.length > 0 ? (
                  <span className="text-small text-positive font-medium">
                    100% Deterministic Rule Match
                  </span>
                ) : (
                  <span className="text-small text-positive font-medium">
                    All Eligible Grants Submitted
                  </span>
                )}
              </div>
              {activeEligible.length > 0 ? (
                <>
                  <p className="mb-3 text-body text-muted">
                    Meets all statutory compliance rules, technology solution whitelist checks, and documentation requirements.
                  </p>
                  <div className="flex flex-col gap-4">
                    {activeEligible.map((g) => (
                      <GrantMatrixCard
                        key={`${claim.claimId}-${g.grantId}`}
                        grant={g}
                        claim={claim}
                        onReview={() => {
                          if (status === "EVALUATED") {
                            setReviewGrant(g.grantId);
                          } else {
                            setPacketGrant(g.grantId);
                          }
                        }}
                        reviewLabel={
                          status === "EVALUATED" ? "Review and sign off" : "View packet & dossier"
                        }
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-(--radius-card) border border-line bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex-none rounded-full bg-emerald-500/10 p-2 text-positive">
                      <CheckCircle2 size={22} strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-section font-semibold">
                        All eligible grants have been submitted
                      </h3>
                      <p className="mt-1 text-body text-muted max-w-[55ch]">
                        You have claimed and submitted your eligible grant application. The official submission packet and cryptographic dossier are securely archived in Neon Postgres & Submitted grants.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/submitted"
                    className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) bg-ink px-4 text-body font-medium text-surface hover:opacity-90 flex-none"
                  >
                    <span>View submitted grants</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Year-round tier: programmes the SME can apply for on profile alone, no invoice needed */}
            <div className="pt-4 border-t border-rule">
              <OpportunityRadar />
            </div>

            {/* Lower Tier: Grants lacking documents or information */}
            {ineligible.length > 0 && (
              <div className="pt-4 border-t border-rule">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-section font-semibold text-muted">
                    Grants lacking documents or criteria ({ineligible.length})
                  </h3>
                  <span className="text-small text-muted font-medium">
                    Deterministic Gap Analysis & Required Docs
                  </span>
                </div>
                <p className="mb-3 text-body text-muted">
                  These official Malaysian government grants do not currently match your SSM profile or invoice scope. Expand any grant below to inspect the exact unmet statutory criteria, required documents, and how to qualify.
                </p>
                <div className="flex flex-col gap-4">
                  {ineligible.map((g) => (
                    <GrantMatrixCard
                      key={`${claim.claimId}-${g.grantId}`}
                      grant={g}
                      claim={claim}
                      onReview={() => {
                        if (status === "EVALUATED") {
                          setReviewGrant(g.grantId);
                        } else {
                          setPacketGrant(g.grantId);
                        }
                      }}
                      reviewLabel={
                        status === "EVALUATED" ? "Review and sign off" : "View packet & dossier"
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-6" aria-label="Company and activity">
            <section aria-labelledby="company-title">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="company-title" className="text-section font-semibold">
                  Company on file
                </h2>
                <Link href="/data" className="text-small font-medium text-accent hover:underline">
                  Edit profile
                </Link>
              </div>
              <CompanySnapshot company={claim.company} />
              <div className="mt-2 flex items-center justify-between">
                <Link
                  href="/data"
                  className="text-body font-medium text-accent hover:underline"
                >
                  See connected data & invoices
                </Link>
                <button
                  type="button"
                  onClick={() => openAuthModal("switch")}
                  className="text-small font-medium text-muted hover:text-ink cursor-pointer"
                >
                  Switch SME
                </button>
              </div>
            </section>
            <section aria-labelledby="activity-title">
              <h2 id="activity-title" className="mb-3 text-section font-semibold">
                Recent activity
              </h2>
              <AuditTrailTimeline events={claim.auditTrail.slice(-4)} />
              <Link
                href="/audit"
                className="mt-4 inline-flex h-7.5 items-center rounded-(--radius-control) border border-control px-3 text-body font-medium hover:bg-active"
              >
                View full audit trail
              </Link>
            </section>
          </aside>
        </div>
      </div>

      <ClaimsReviewModal
        open={reviewGrant !== null}
        onClose={() => {
          setReviewGrant(null);
          clearPendingReview();
        }}
        onBack={
          fromApplication && lastApplicationTarget
            ? () => {
                // Return to the quotation/receipt step for the same programme; entered fields are kept.
                clearPendingReview();
                openInvoiceModal(lastApplicationTarget);
              }
            : undefined
        }
        backLabel={
          lastApplicationTarget?.documentKind === "RECEIPT" ? "Back to receipt" : "Back to quotation"
        }
        initialGrantId={reviewGrant ?? lead?.grantId ?? ""}
        onApproved={() => {
          setPacketGrant(reviewGrant ?? lead?.grantId ?? null);
          setReviewGrant(null);
          clearPendingReview();
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
