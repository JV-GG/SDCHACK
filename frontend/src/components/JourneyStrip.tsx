"use client";

import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { ClaimsReadinessPackage, GrantEvaluation } from "@/types/claim";
import { JOURNEY_STEPS, eligibleGrants, coFunding, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";

type StepState = "done" | "current" | "waiting";

interface StepView {
  title: (typeof JOURNEY_STEPS)[number];
  state: StepState;
  detail: string;
}

function buildGlobalSteps(
  claim: ClaimsReadinessPackage,
  pipeline: { running: boolean; step: number },
  submittedCount: number,
): StepView[] {
  const eligible = eligibleGrants(claim);
  const lead = eligible[0];
  const status = claim.status;
  const drafted = claim.narratives.length;

  const details = [
    `Invoice ${claim.invoice.invoiceNumber} (${formatMYR(claim.invoice.totalAmountMYR)}) detected`,
    "SSM profile, Orbyte HR, and accounting records pulled",
    lead
      ? `${eligible.length} of ${claim.evaluations.length} statutory grants matched, ${drafted} narratives drafted`
      : `${claim.evaluations.length} grants checked, none currently eligible`,
    status === "EVALUATED"
      ? lead
        ? `Waiting for owner to sign off ${formatMYR(claim.totalClaimableAmountMYR)} across ${eligible.length} grants`
        : "Nothing to sign off"
      : `Signed off by business owner (${submittedCount > 0 ? `${submittedCount} submitted` : "ready to export"})`,
    !lead
      ? "No dossier without eligible grants"
      : status === "SUBMITTED" || (submittedCount > 0 && submittedCount === eligible.length)
        ? `All ${eligible.length} application dossiers generated and archived`
        : status === "APPROVED"
          ? `${eligible.length} application dossiers ready to export`
          : "Packets and dossiers built after sign-off",
  ];

  if (pipeline.running) {
    const pending = [
      "Listening for the expense",
      "Pulling SSM, Orbyte HR and accounting",
      "Running deterministic rules & drafting narratives",
    ];
    return JOURNEY_STEPS.map((title, i) => ({
      title,
      state: i < pipeline.step ? "done" : i === pipeline.step ? "current" : "waiting",
      detail: i <= 2 ? (i < pipeline.step ? details[i] : pending[i]) : "Waiting",
    }));
  }

  const humanState: StepState = !lead ? "waiting" : status === "EVALUATED" ? "current" : "done";
  const outcomeState: StepState =
    !lead
      ? "waiting"
      : status === "SUBMITTED" || (submittedCount > 0 && submittedCount === eligible.length)
        ? "done"
        : status === "APPROVED"
          ? "current"
          : "waiting";

  const states: StepState[] = ["done", "done", "done", humanState, outcomeState];
  return JOURNEY_STEPS.map((title, i) => ({ title, state: states[i], detail: details[i] }));
}

function buildGrantSteps(
  claim: ClaimsReadinessPackage,
  grant: GrantEvaluation,
  pipeline: { running: boolean; step: number },
  isSubmitted: boolean,
): StepView[] {
  const money = coFunding(claim, grant);
  const narrative = claim.narratives.find((n) => n.grantId === grant.grantId);
  const passedChecks = grant.checks.filter((c) => c.passed).length;
  const totalChecks = grant.checks.length;
  const status = claim.status;

  const details = [
    `Invoice ${claim.invoice.invoiceNumber} (${formatMYR(claim.invoice.totalAmountMYR)}) matched`,
    `${totalChecks} statutory checks verified against SSM & Orbyte records`,
    grant.isEligible
      ? `100% Passed (${passedChecks}/${totalChecks} rules) • AI narrative ${narrative ? "drafted" : "ready"}`
      : `${totalChecks - passedChecks} eligibility criteria unmet • Cannot claim`,
    !grant.isEligible
      ? "Ineligible - no owner sign-off"
      : isSubmitted
        ? "Signed off and submitted"
        : status !== "EVALUATED"
          ? "Signed off by business owner"
          : `Waiting for owner to sign off ${formatMYR(money.claimable)}`,
    !grant.isEligible
      ? "No packet generated"
      : isSubmitted
        ? `Lodge record archived with cryptographic verification hash`
        : status === "APPROVED"
          ? `Application dossier ready to export & lodge`
          : "Application dossier is built upon sign-off",
  ];

  if (pipeline.running) {
    const pending = [
      "Detecting invoice expense",
      "Pulling SSM, Orbyte HR & accounting records",
      `Evaluating ${grant.agency} statutory rules & drafting narrative`,
    ];
    return JOURNEY_STEPS.map((title, i) => ({
      title,
      state: i < pipeline.step ? "done" : i === pipeline.step ? "current" : "waiting",
      detail: i <= 2 ? (i < pipeline.step ? details[i] : pending[i]) : "Waiting",
    }));
  }

  const humanState: StepState = !grant.isEligible
    ? "waiting"
    : isSubmitted || status !== "EVALUATED"
      ? "done"
      : "current";

  const outcomeState: StepState = !grant.isEligible
    ? "waiting"
    : isSubmitted
      ? "done"
      : status === "APPROVED"
        ? "current"
        : "waiting";

  const states: StepState[] = ["done", "done", "done", humanState, outcomeState];
  return JOURNEY_STEPS.map((title, i) => ({ title, state: states[i], detail: details[i] }));
}

const DOT: Record<StepState, string> = {
  done: "bg-accent",
  current: "border-2 border-accent bg-surface",
  waiting: "bg-control",
};

const STATE_WORD: Record<StepState, string> = {
  done: "Done",
  current: "In progress",
  waiting: "Waiting",
};

/**
 * The 5-step claim journey with support for viewing the aggregated multi-grant pipeline
 * or drilling down into an individual Malaysian grant's statutory claim trajectory.
 */
export function JourneyStrip({
  claim,
  pipeline,
}: {
  claim: ClaimsReadinessPackage;
  pipeline: { running: boolean; step: number };
}) {
  const { submittedGrants } = useClaim();
  const [selectedGrantId, setSelectedGrantId] = useState<string>("all");

  const eligible = useMemo(() => eligibleGrants(claim), [claim]);
  const activeGrant = useMemo(() => {
    if (selectedGrantId === "all") return null;
    return claim.evaluations.find((g) => g.grantId === selectedGrantId) ?? null;
  }, [claim, selectedGrantId]);

  const submittedForClaim = useMemo(() => {
    return submittedGrants.filter((s) => s.claimId === claim.claimId);
  }, [submittedGrants, claim.claimId]);

  const isCurrentGrantSubmitted = useMemo(() => {
    if (!activeGrant) return false;
    return (
      submittedForClaim.some((s) => s.grantId === activeGrant.grantId) ||
      claim.status === "SUBMITTED"
    );
  }, [activeGrant, submittedForClaim, claim.status]);

  const steps = useMemo(() => {
    if (activeGrant) {
      return buildGrantSteps(claim, activeGrant, pipeline, isCurrentGrantSubmitted);
    }
    return buildGlobalSteps(claim, pipeline, submittedForClaim.length);
  }, [claim, activeGrant, pipeline, isCurrentGrantSubmitted, submittedForClaim.length]);

  return (
    <section aria-label="Claim journey" className="rounded-(--radius-card) border border-line bg-surface p-4 sm:p-5 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rule">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-section font-semibold text-ink">Claim journey</h2>
            <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
              {activeGrant ? `${activeGrant.agency} Specific Journey` : "Multi-Grant Pipeline Overview"}
            </span>
          </div>
          <p className="mt-0.5 text-small text-muted">
            {activeGrant
              ? `${activeGrant.grantName} • Max Claimable: ${formatMYR(coFunding(claim, activeGrant).claimable)} (${activeGrant.matchingPercentage}% co-funding)`
              : `Tracking end-to-end execution for ${eligible.length} matched Malaysian statutory grants`}
          </p>
        </div>

        {/* Centralized Grant Selector Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
          <label htmlFor="journey-grant-dropdown" className="text-small text-muted font-medium whitespace-nowrap">
            View Journey:
          </label>
          <div className="relative w-full sm:w-auto min-w-0 max-w-full">
            <select
              id="journey-grant-dropdown"
              value={selectedGrantId}
              onChange={(e) => setSelectedGrantId(e.target.value)}
              className="h-8 w-full sm:w-auto sm:max-w-70 md:max-w-85 appearance-none rounded-(--radius-control) border border-control bg-surface pl-3 pr-8 text-small font-medium text-ink hover:bg-active focus:outline-none focus:ring-1 focus:ring-ink cursor-pointer transition-colors truncate"
            >
              <option value="all">All Grants ({eligible.length} Matched)</option>
              {claim.evaluations.map((g) => (
                <option key={g.grantId} value={g.grantId}>
                  {g.agency} — {g.grantName} {g.isEligible ? `(${formatMYR(coFunding(claim, g).claimable)})` : "(Ineligible)"}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>
      </div>

      <ol className="mt-4 grid gap-5 lg:grid-cols-5 lg:gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 lg:block">
            <div className="flex-none lg:mb-3 lg:h-3">
              <span aria-hidden="true" className={`relative z-10 block size-3 rounded-full ${DOT[s.state]}`} />
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute -bottom-5 left-1.25 top-3 w-0.5 lg:bottom-auto lg:left-3 lg:-right-4 lg:top-1.25 lg:h-0.5 lg:w-auto ${
                  s.state === "done" ? "bg-accent" : "bg-active"
                }`}
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {s.title}
                <span className="sr-only">: {STATE_WORD[s.state]}</span>
              </p>
              <p className="mt-0.5 text-small text-muted">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
