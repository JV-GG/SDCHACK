"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ClaimsReadinessPackage, GrantEvaluation } from "@/types/claim";
import { coFunding } from "@/lib/ClaimContext";
import { GRANT_PROGRAMME } from "@/lib/constants";
import { formatMYR } from "@/lib/format";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { StatusPill } from "@/components/StatusPill";

const AGENCY_LABEL: Record<GrantEvaluation["agency"], string> = {
  MDEC: "MDEC with BSN",
  "SME Corp": "SME Corp",
  MATRADE: "MATRADE",
};

interface Props {
  grant: GrantEvaluation;
  claim: ClaimsReadinessPackage;
  /** Opens the review modal. Only offered for an eligible grant that is still awaiting sign-off or already signed. */
  onReview?: () => void;
  reviewLabel?: string;
}

export function GrantMatrixCard({ grant, claim, onReview, reviewLabel = "Review and sign off" }: Props) {
  const [open, setOpen] = useState(grant.isEligible);
  const bodyId = useId();
  const passed = grant.checks.filter((c) => c.passed).length;
  const failed = grant.checks.filter((c) => !c.passed);
  const programme = GRANT_PROGRAMME[grant.grantId];
  const cap = grant.maxCoFundingMYR > 0 ? grant.maxCoFundingMYR : programme.capMYR;
  const money = grant.isEligible ? coFunding(claim, grant) : null;

  return (
    <article className="rounded-(--radius-card) border border-line bg-surface">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex h-5 items-center rounded-sm bg-raised px-1.5 text-small font-medium text-muted">
            {AGENCY_LABEL[grant.agency]}
          </p>
          <h3 className="mt-2 text-section font-semibold">{grant.grantName}</h3>
          <p className="mt-0.5 text-body text-muted num">
            {grant.matchingPercentage}% matching, up to {formatMYR(cap)} {programme.capNote}
          </p>
        </div>
        <div className="flex flex-none flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
          {grant.isEligible ? (
            <StatusPill tone="positive">Eligible</StatusPill>
          ) : (
            <StatusPill tone="neutral">Criteria not met</StatusPill>
          )}
          {money ? (
            <p className="text-title font-normal num sm:text-right">
              {formatMYR(money.claimable)}
              <span className="block text-small text-muted">claimable</span>
            </p>
          ) : (
            <p className="text-title font-normal text-muted sm:text-right" aria-label="Not claimable">
              —
            </p>
          )}
        </div>
      </div>

      {money && (
        <div className="px-5 pb-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-active"
            role="img"
            aria-label={`${formatMYR(money.claimable)} claimable of a ${formatMYR(claim.invoice.totalAmountMYR)} invoice`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(money.claimable / claim.invoice.totalAmountMYR) * 100}%`,
                background: "var(--accent)",
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-small text-muted num">
            <span>
              {grant.matchingPercentage}% of invoice = {formatMYR(money.matched)}
              {money.capped ? `, held to the ${formatMYR(grant.maxCoFundingMYR)} cap` : ""}
            </span>
            <span>{formatMYR(claim.invoice.totalAmountMYR)} invoice</span>
          </div>
        </div>
      )}

      {!grant.isEligible && failed.length > 0 && (
        <p className="px-5 pb-4 text-body">
          <span className="text-muted">Not met: </span>
          {failed.map((c) => c.ruleName).join(", ")}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-rule px-5 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 flex h-8 items-center gap-1.5 rounded-md px-2 text-body font-medium hover:bg-active"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="num">
            {passed} of {grant.checks.length} rules passed
          </span>
        </button>
        {grant.isEligible && onReview && (
          <button
            type="button"
            onClick={onReview}
            className="h-8 rounded-(--radius-control) bg-ink px-3 text-body font-medium text-surface hover:opacity-90"
          >
            {reviewLabel}
          </button>
        )}
      </div>

      {open && (
        <div id={bodyId} className="border-t border-rule bg-raised/60 p-5">
          <EligibilityChecklist checks={grant.checks} />
        </div>
      )}
    </article>
  );
}
