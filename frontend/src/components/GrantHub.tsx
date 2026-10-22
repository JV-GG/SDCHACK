"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  FilePlus2,
  Globe,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { ClaimsReviewModal } from "@/components/ClaimsReviewModal";
import { CompanySnapshot } from "@/components/CompanyProfileCard";
import { DashboardStats } from "@/components/DashboardStats";
import { GrantMatrixCard } from "@/components/GrantMatrixCard";
import { JourneyStrip } from "@/components/JourneyStrip";

/** The Grant Hub screen. Displays all 7 Malaysian grants with eligible grants at the top and lacking documents at the lower list. */
export function GrantHub() {
  const {
    claim,
    company,
    triggerEvents,
    pipeline,
    notice,
    error,
    retry,
    reEvaluate,
    loading,
    submittedGrants,
    openAuthModal,
    openInvoiceModal,
    runGrantCrawlTrigger,
  } = useClaim();
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
        <h2 className="text-section font-semibold">Connecting to Live Engine & Neon DB...</h2>
        <p className="text-body text-muted mt-1">
          Evaluating 7 Malaysian statutory grant schemes deterministically & loading cached DeepSeek narratives
        </p>
      </div>
    );
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

  const latestTrigger = triggerEvents[0] ?? null;

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-small text-muted mb-1">
            <span className="inline-flex items-center gap-1 rounded-sm bg-raised px-2 py-0.5 font-medium text-ink border border-line">
              <Database size={12} className="text-positive" />
              <span>Neon Postgres Connected</span>
            </span>
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
            onClick={() => openAuthModal("switch")}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer"
            title="Switch SME organization, Sign Up, or Edit SSM details"
          >
            <Building2 size={14} className="text-accent" />
            <span>SME Account / SSM</span>
          </button>
          <button
            type="button"
            onClick={() => openInvoiceModal()}
            disabled={pipeline.running || loading}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
            title="Trigger Point: Submit a new expenditure invoice"
          >
            <FilePlus2 size={14} className="text-accent" />
            <span>New Invoice Trigger</span>
          </button>
          <button
            type="button"
            onClick={() => void runGrantCrawlTrigger()}
            disabled={pipeline.running || loading}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
            title="Trigger Point: Crawl & sync official Malaysian grant portals (MDEC, SME Corp, MATRADE, HRD Corp, MIDA, MITI, Cradle)"
          >
            <Globe size={14} className={loading ? "animate-spin text-accent" : "text-accent"} />
            <span>Sync Official Grants</span>
          </button>
          <button
            type="button"
            onClick={() => void reEvaluate()}
            disabled={pipeline.running || loading}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
            title="Re-run live pipeline"
          >
            <RefreshCw size={14} className={pipeline.running ? "animate-spin" : ""} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {/* Event Trigger Telemetry Strip */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-raised/60 px-3.5 py-2 text-small">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2 rounded-full bg-positive flex-none" />
          <span className="font-semibold text-ink">Active Trigger Engine:</span>
          <span className="truncate text-muted">
            {latestTrigger
              ? `${latestTrigger.title} — ${latestTrigger.description}`
              : `Monitoring 7 statutory schemes (MDEC, SME Corp, MATRADE, HRD Corp, MIDA, MITI, Cradle Fund) for ${company.companyName}.`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => openAuthModal("edit")}
          className="text-accent font-medium hover:underline flex-none text-left sm:text-right cursor-pointer"
        >
          Edit SSM Equity / Headcount →
        </button>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-[var(--radius-control)] border border-[#fde68a] bg-pill-warning-bg px-3 py-2 text-small text-warning"
        >
          {notice}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        <DashboardStats claim={claim} />
        <JourneyStrip claim={claim} pipeline={pipeline} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
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
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                    className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90 flex-none"
                  >
                    <span>View submitted grants</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
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
                <button
                  type="button"
                  onClick={() => openAuthModal("edit")}
                  className="text-small font-medium text-accent hover:underline cursor-pointer"
                >
                  Edit SSM
                </button>
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
