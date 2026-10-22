"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GrantEvaluation, LLMNarrative } from "@/types/claim";
import { coFunding, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";
import { Dialog } from "@/components/Dialog";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { NarrativeEditor } from "@/components/NarrativeEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  grant: GrantEvaluation | undefined;
  /** Called after the claim is approved, e.g. to open the application packet. */
  onApproved?: () => void;
}

/** Step 4: the owner checks the rules, edits the AI draft and signs off. */
export function ClaimsReviewModal({ open, onClose, grant, onApproved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="review-title">
      {grant && <ReviewBody grant={grant} onClose={onClose} onApproved={onApproved} />}
    </Dialog>
  );
}

function ReviewBody({
  grant,
  onClose,
  onApproved,
}: {
  grant: GrantEvaluation;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const { claim, approve } = useClaim();
  const original = claim?.narratives.find((n) => n.grantId === grant.grantId);
  const [draft, setDraft] = useState<LLMNarrative | undefined>(original);
  const [busy, setBusy] = useState(false);

  if (!claim) return null;

  const signed = claim.status !== "EVALUATED";
  const money = coFunding(claim, grant);
  const edited = !!draft && !!original && JSON.stringify(draft) !== JSON.stringify(original);
  const allPassed = grant.checks.every((c) => c.passed);

  async function handleApprove() {
    if (!claim) return;
    setBusy(true);
    const narratives = claim.narratives.map((n) => (draft && n.grantId === draft.grantId ? draft : n));
    await approve(narratives, edited);
    setBusy(false);
    onClose();
    onApproved?.();
  }

  return (
    <>
      <div className="flex flex-none items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 id="review-title" className="text-title font-semibold">
            Review claim
          </h2>
          <p className="mt-0.5 text-body text-muted">
            {grant.grantName}, <span className="font-mono">{claim.claimId}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close review"
          className="grid size-8 flex-none place-items-center rounded-md hover:bg-active"
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto px-6 py-5 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="review-checks">
            <h3 id="review-checks" className="text-section font-semibold">
              Eligibility checks
            </h3>
            <p className="mb-3 mt-0.5 text-small text-muted">
              Decided by the rules engine from SSM, Orbyte HR and accounting data. Not written by the model.
            </p>
            <EligibilityChecklist checks={grant.checks} />
          </section>

          <section aria-labelledby="review-money">
            <h3 id="review-money" className="text-section font-semibold">
              Co-funding
            </h3>
            <dl className="mt-2 divide-y divide-rule rounded-(--radius-card) bg-raised px-4 text-body">
              <div className="flex justify-between py-2">
                <dt className="text-muted">Invoice {claim.invoice.invoiceNumber}</dt>
                <dd className="num">{formatMYR(claim.invoice.totalAmountMYR)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">{grant.matchingPercentage}% matching</dt>
                <dd className="num">{formatMYR(money.matched)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Grant cap</dt>
                <dd className="num">{formatMYR(grant.maxCoFundingMYR)}</dd>
              </div>
              <div className="flex justify-between py-2 font-medium">
                <dt>Claimable</dt>
                <dd className="num">{formatMYR(money.claimable)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="review-docs">
            <h3 id="review-docs" className="text-section font-semibold">
              Documents for the packet
            </h3>
            <ul className="mt-2 list-disc pl-5 text-body">
              {grant.requiredDocuments.map((doc) => (
                <li key={doc}>{doc}</li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="review-narrative">
          <h3 id="review-narrative" className="mb-3 text-section font-semibold">
            Application narrative
          </h3>
          {draft && original ? (
            <NarrativeEditor narrative={draft} original={original} onChange={setDraft} readOnly={signed} />
          ) : (
            <p className="rounded-(--radius-card) border border-dashed border-control px-4 py-3 text-muted">
              No narrative was drafted for this grant.
            </p>
          )}
        </section>
      </div>

      <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-line bg-raised px-6 py-4">
        <p className="max-w-md text-small text-muted">
          {signed
            ? "This claim is signed off. The sign-off is in the audit trail."
            : allPassed
              ? "Approving records your sign-off, and any edits you made, in the audit trail."
              : "A rule is not met. Resolve it before approving."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-(--radius-control) px-3 text-body font-medium hover:bg-active"
          >
            {signed ? "Close" : "Cancel"}
          </button>
          {!signed && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy || !allPassed}
              className="h-9 rounded-(--radius-control) bg-ink px-4 text-body font-medium text-surface hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Signing off…" : "Approve and sign off claim"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
