"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, FileText, LoaderCircle, RotateCcw, Zap } from "lucide-react";
import { eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatMYR } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { ClaimsReviewModal } from "@/components/ClaimsReviewModal";
import { CompanySnapshot } from "@/components/CompanyProfileCard";
import { DashboardStats } from "@/components/DashboardStats";
import { GrantMatrixCard } from "@/components/GrantMatrixCard";
import { JourneyStrip } from "@/components/JourneyStrip";
import { StatusPill } from "@/components/StatusPill";

const STAGES = [
  "Expense trigger detected in accounting",
  "Pulling SSM BizProfile & Orbyte HR verification data",
  "Executing deterministic grant rules & drafting DeepSeek AI justification",
];

/** The Grant Hub screen. Starts clean/empty so the user can test step-by-step. */
export function GrantHub() {
  const {
    claim,
    pipeline,
    notice,
    error,
    retry,
    reset,
    scenarios,
    scenario,
    selectScenario,
    currentScenario,
    ingest,
  } = useClaim();

  const [reviewGrant, setReviewGrant] = useState<string | null>(null);
  const [packetGrant, setPacketGrant] = useState<string | null>(null);

  // 1. Backend connection error state
  if (error && !claim) {
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

  // 2. Active pipeline evaluation in progress
  if (pipeline.running) {
    return (
      <div className="px-4 py-8 md:px-6 max-w-3xl mx-auto">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <LoaderCircle size={24} className="animate-spin text-accent" />
            <div>
              <h2 className="text-section font-semibold">Autonomous Copilot Running...</h2>
              <p className="text-small text-muted">
                Evaluating live against FastAPI rules engine & DeepSeek LLM
              </p>
            </div>
          </div>

          <ol className="mt-6 flex flex-col gap-3" aria-label="Pipeline progress">
            {STAGES.map((label, i) => {
              const done = i < pipeline.step;
              const active = i === pipeline.step;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 p-3 rounded-[var(--radius-control)] border ${
                    active
                      ? "border-accent bg-accent-soft/30 text-ink font-medium"
                      : done
                        ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                        : "border-line text-muted"
                  }`}
                >
                  {active ? (
                    <LoaderCircle size={18} className="animate-spin text-accent flex-none" />
                  ) : done ? (
                    <CircleCheck size={18} className="text-positive flex-none" />
                  ) : (
                    <span className="size-2 rounded-full bg-control flex-none ml-1.5" />
                  )}
                  <span className="text-body">{label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    );
  }

  // 3. Clean Empty State: User tests from scratch step-by-step
  if (!claim) {
    const invoice = currentScenario.invoice;
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="max-w-4xl">
          <h1 className="text-title font-semibold">Grant Hub</h1>
          <p className="mt-1 text-section text-muted max-w-[70ch]">
            No claim is active yet. Choose an expense event below to simulate an invoice trigger,
            then test the autonomous copilot step by step.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Step 1: Select Scenario */}
          <section
            aria-labelledby="empty-trigger-title"
            className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
          >
            <div className="flex items-center justify-between">
              <h2 id="empty-trigger-title" className="text-section font-semibold flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-ink text-surface text-small font-medium">
                  1
                </span>
                <span>Select an Invoice Trigger</span>
              </h2>
              <span className="text-small text-muted">Step 1 of 5</span>
            </div>

            <div role="radiogroup" aria-label="Available scenarios" className="mt-4 grid gap-2.5">
              {scenarios.map((s, index) => {
                const selected = scenario === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectScenario(s.id)}
                    className={`rounded-[var(--radius-control)] border p-3 text-left transition-colors cursor-pointer ${
                      selected
                        ? "border-ink bg-surface shadow-xs"
                        : "border-line bg-raised hover:border-control"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-body text-ink">
                        {s.title.split(":")[0] || `Scenario ${index + 1}`}
                      </p>
                      {selected && <span className="size-2 rounded-full bg-accent" />}
                    </div>
                    <p className="text-small font-medium text-ink mt-0.5">
                      {s.title.split(":")[1]?.trim() || s.title}
                    </p>
                    <p className="text-small text-muted mt-1">{s.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 2: Review Invoice & Ingest */}
          <section
            aria-labelledby="empty-preview-title"
            className="rounded-[var(--radius-card)] border border-line bg-surface p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 id="empty-preview-title" className="text-section font-semibold flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-surface text-small font-medium">
                    2
                  </span>
                  <span>Invoice Details</span>
                </h2>
                {invoice.vendorIsMdecTsp ? (
                  <StatusPill tone="positive">MDEC TSP Accredited</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Unregistered Vendor</StatusPill>
                )}
              </div>

              <div className="mt-4 rounded-[var(--radius-control)] bg-raised p-3 text-body">
                <p className="font-medium text-ink">{invoice.vendorName}</p>
                <p className="text-small text-muted num mt-0.5">
                  <span className="font-mono">{invoice.invoiceNumber}</span> · Dated {formatDate(invoice.invoiceDate)}
                </p>
                <div className="mt-3 pt-3 border-t border-rule flex justify-between text-small">
                  <span className="text-muted">Total Expense</span>
                  <span className="font-semibold text-ink num">{formatMYR(invoice.totalAmountMYR)}</span>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-small font-medium text-muted mb-2">Line Items ({invoice.items.length})</p>
                <ul className="divide-y divide-rule text-small">
                  {invoice.items.map((item) => (
                    <li key={item.id} className="py-2 flex justify-between gap-2">
                      <span className="text-ink truncate">{item.description}</span>
                      <span className="num font-medium text-muted flex-none">
                        {formatMYR(item.totalPriceMYR)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line">
              <button
                type="button"
                onClick={() => void ingest()}
                className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-ink py-2.5 px-4 text-body font-medium text-surface hover:opacity-90 cursor-pointer shadow-sm transition-opacity"
              >
                <Zap size={16} />
                <span>Ingest & Evaluate Live ({invoice.invoiceNumber})</span>
              </button>
              <p className="text-center text-small text-muted mt-2">
                Calls FastAPI backend · Evaluates deterministic rules · Generates AI narrative
              </p>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // 4. Evaluated Dashboard: Populated only AFTER the user triggers ingestion
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
        <div className="flex items-center gap-2 flex-none">
          <button
            type="button"
            onClick={reset}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer"
            title="Clear active claim to test from empty again"
          >
            <RotateCcw size={14} />
            <span>Test New / Reset</span>
          </button>
          {lead && (
            <button
              type="button"
              onClick={primary.run}
              disabled={pipeline.running}
              className="h-9 rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {primary.label}
            </button>
          )}
        </div>
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
              <Link
                href="/data"
                className="mt-2 inline-block text-body font-medium text-accent hover:underline"
              >
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
