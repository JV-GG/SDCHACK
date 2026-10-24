"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { GrantEvaluation } from "@/types/claim";
import { coFunding, eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { formatMYRShort } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { ClaimsReviewModal } from "@/components/ClaimsReviewModal";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { GrantMatrixCard } from "@/components/GrantMatrixCard";
import { BackendError } from "@/components/BackendError";
import { GrantHubSkeleton } from "@/components/PageSkeletons";
import { stagger } from "@/lib/motion";
import { OpportunityRadar } from "@/components/OpportunityRadar";

type StepState = "done" | "current" | "waiting";

const BAR: Record<StepState, string> = {
  done: "bg-positive",
  current: "bg-accent/35",
  waiting: "bg-active",
};

/** The first unmet rule, as one plain sentence. */
function missingReason(grant: GrantEvaluation): string {
  const failed = grant.checks.find((c) => !c.passed);
  if (!failed) return "Some documents are missing.";
  return `${failed.ruleName}: needs ${failed.requirement}, you have ${failed.actual}.`;
}

function NotYetRow({ grant }: { grant: GrantEvaluation }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  return (
    <li className="rounded-xl border border-rule px-5 py-3.5">
      <p className="text-[15px] font-semibold">
        {grant.agency} {grant.grantName}
      </p>
      <p className="mt-1 text-body text-muted">{missingReason(grant)}</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="-ml-2 mt-1 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer"
      >
        {open ? "Hide the checks" : "How to qualify"}
      </button>
      {open && (
        <div id={bodyId} className="anim-expand border-t border-rule pt-3">
          <EligibilityChecklist checks={grant.checks} />
        </div>
      )}
    </li>
  );
}

/** Home: one answer (how much this invoice can claim), one main action, and the other grants below it. */
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
    openInvoiceModal,
    pendingReviewGrantId,
    clearPendingReview,
    lastApplicationTarget,
  } = useClaim();
  const [manualReviewGrant, setReviewGrant] = useState<string | null>(null);
  // A year-round application that passed its invoice checks opens straight into Step 4 review.
  const fromApplication = manualReviewGrant === null && claim?.status === "EVALUATED" && pendingReviewGrantId !== null;
  const reviewGrant = manualReviewGrant ?? (fromApplication ? pendingReviewGrantId : null);
  const [packetGrant, setPacketGrant] = useState<string | null>(null);
  const [showNotYet, setShowNotYet] = useState(false);
  const notYetId = useId();

  if (!claim) {
    if (error) return <BackendError message={error} onRetry={() => void retry()} />;
    return <GrantHubSkeleton />;
  }

  const eligible = eligibleGrants(claim);
  const ineligible = claim.evaluations.filter((e) => !e.isEligible);
  const status = claim.status;
  const busy = pipeline.running || loading;

  // Grants already submitted for this organisation are not offered again.
  const submittedIds = new Set(submittedGrants.map((s) => s.grantId));
  const activeEligible = status === "SUBMITTED" ? [] : eligible.filter((g) => !submittedIds.has(g.grantId));
  const lead = activeEligible[0] ?? eligible[0];
  const allSent = status === "SUBMITTED" || (eligible.length > 0 && activeEligible.length === 0);
  const activeTotal = activeEligible.reduce((sum, g) => sum + coFunding(claim, g).claimable, 0);
  const agencies = Array.from(new Set(activeEligible.map((g) => g.agency)));

  const openGrant = (grantId: string) => (status === "EVALUATED" ? setReviewGrant(grantId) : setPacketGrant(grantId));

  // The headline, the sentence under it, and the one main action, for each state of the claim.
  let headline: ReactNode;
  let summary: string;
  let primary: ReactNode;
  const primaryClass =
    "inline-flex min-h-12 items-center rounded-[10px] bg-accent px-5.5 text-section font-semibold text-surface hover:opacity-90 cursor-pointer disabled:opacity-60";

  if (pipeline.running) {
    headline = "Checking your invoice…";
    summary = "We're comparing it with your company details and all 7 grants.";
    primary = null;
  } else if (allSent) {
    headline = "Your claim has been sent";
    summary = "Follow its progress in My claims. Upload a new invoice to check it for more grants.";
    primary = (
      <Link href="/submitted" className={primaryClass}>
        Go to My claims
      </Link>
    );
  } else if (!lead) {
    headline = "No grant fits this invoice";
    summary = `We checked it against ${claim.evaluations.length} grants. See why below, or try a different invoice.`;
    primary = null;
  } else if (status === "EVALUATED") {
    headline = (
      <>
        You can claim <span className="text-positive num">{formatMYRShort(activeTotal)}</span>
      </>
    );
    summary = `${activeEligible.length === 1 ? "One grant matches" : `${activeEligible.length} grants match`} this invoice. Check the draft and approve it. Nothing is sent until you do.`;
    primary = (
      <button type="button" onClick={() => setReviewGrant(lead.grantId)} disabled={busy} className={primaryClass}>
        Review and approve
      </button>
    );
  } else {
    headline = (
      <>
        Approved: <span className="text-positive num">{formatMYRShort(activeTotal)}</span> ready to send
      </>
    );
    summary = `Open the application to export it and send it to ${agencies.join(" and ")}.`;
    primary = (
      <button type="button" onClick={() => setPacketGrant(lead.grantId)} className={primaryClass}>
        Open application
      </button>
    );
  }

  const steps: { label: string; state: StepState }[] = [
    {
      label: "1. Invoice received",
      state: pipeline.running && pipeline.step === 0 ? "current" : "done",
    },
    {
      label: `2. Checked ${claim.evaluations.length} grants`,
      state: pipeline.running ? (pipeline.step === 0 ? "waiting" : "current") : "done",
    },
    pipeline.running || !lead
      ? { label: "3. Your approval", state: "waiting" }
      : status === "EVALUATED" && !allSent
        ? { label: "3. Your approval — now", state: "current" }
        : { label: "3. Approved", state: "done" },
  ];

  return (
    <div className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-10">
        <section aria-labelledby="hero-title" className="anim-reveal flex flex-col gap-5" style={stagger(0)}>
          <p className="text-body text-muted">
            {company.companyName} · Invoice {claim.invoice.invoiceNumber} (
            <span className="num">{formatMYRShort(claim.invoice.totalAmountMYR)}</span>)
          </p>
          <h1 id="hero-title" className="text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
            {headline}
          </h1>
          <p className="max-w-[56ch] text-[18px] leading-relaxed text-muted">{summary}</p>
          <div className="flex flex-wrap items-center gap-3">
            {primary}
            <button
              type="button"
              onClick={() => openInvoiceModal()}
              disabled={busy}
              className="inline-flex min-h-12 items-center rounded-[10px] border border-control bg-surface px-5 text-section font-medium hover:bg-active cursor-pointer disabled:opacity-60"
            >
              Upload another invoice
            </button>
            <button
              type="button"
              onClick={() => void reEvaluate()}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={14} className={pipeline.running ? "animate-spin" : ""} aria-hidden="true" />
              Check again
            </button>
          </div>

          <ol aria-label="Progress" className="mt-2 grid grid-cols-3 gap-2">
            {steps.map((s) => (
              <li key={s.label} className="flex flex-col gap-2">
                <span aria-hidden="true" className={`h-1.5 rounded-full ${BAR[s.state]}`} />
                <p
                  className={`text-body font-semibold ${s.state === "current" ? "text-accent" : ""} ${s.state === "waiting" ? "text-muted" : ""}`}
                >
                  {s.label}
                  <span className="sr-only">
                    {s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : " (not started)"}
                  </span>
                </p>
              </li>
            ))}
          </ol>
        </section>

        {notice && (
          <p
            role="status"
            className="rounded-[10px] border border-[#fde68a] bg-pill-warning-bg px-4 py-3 text-body text-warning"
          >
            {notice}
          </p>
        )}

        <div className={`grid items-start gap-10 ${activeEligible.length > 0 ? "xl:grid-cols-2" : ""}`}>
          {activeEligible.length > 0 && (
            <section aria-labelledby="ready-title" className="anim-reveal flex flex-col gap-3.5" style={stagger(1)}>
              <h2 id="ready-title" className="text-[20px] font-semibold leading-7">
                Ready to claim
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
                {activeEligible.map((g) => (
                  <GrantMatrixCard
                    key={`${claim.claimId}-${g.grantId}`}
                    grant={g}
                    claim={claim}
                    onAction={() => openGrant(g.grantId)}
                    actionLabel={status === "EVALUATED" ? "Review" : "Open application"}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="anim-reveal" style={stagger(2)}>
            <OpportunityRadar />
          </div>
        </div>

        {ineligible.length > 0 && (
          <section aria-labelledby="notyet-title" className="anim-reveal flex flex-col gap-3.5" style={stagger(3)}>
            <button
              type="button"
              aria-expanded={showNotYet}
              aria-controls={notYetId}
              onClick={() => setShowNotYet((v) => !v)}
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-raised px-5 text-left cursor-pointer hover:bg-active"
            >
              <span id="notyet-title" className="text-section font-semibold">
                Not a match yet ({ineligible.length})
              </span>
              <span className="flex items-center gap-1 text-body font-medium text-accent">
                {showNotYet ? "Hide" : "Show why"}
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={`transition-transform ${showNotYet ? "rotate-180" : ""}`}
                />
              </span>
            </button>
            {showNotYet && (
              <ul id={notYetId} className="anim-expand grid items-start gap-2.5 lg:grid-cols-2">
                {ineligible.map((g) => (
                  <NotYetRow key={`${claim.claimId}-${g.grantId}`} grant={g} />
                ))}
              </ul>
            )}
          </section>
        )}
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
        backLabel={lastApplicationTarget?.documentKind === "RECEIPT" ? "Back to receipt" : "Back to quotation"}
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
