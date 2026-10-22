"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { LLMNarrative } from "@/types/claim";
import { coFunding, eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { formatMYR } from "@/lib/format";
import { Dialog } from "@/components/Dialog";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { GrantTabs } from "@/components/GrantTabs";
import { NarrativeEditor } from "@/components/NarrativeEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The grant to show first. Every eligible grant on the claim is reviewed in the same sign-off. */
  initialGrantId: string | undefined;
  /** Called after the claim is approved, e.g. to open the application packet. */
  onApproved?: () => void;
}

/** Step 4: the owner checks the rules, edits the AI drafts and signs off the whole claim. */
export function ClaimsReviewModal({ open, onClose, initialGrantId, onApproved }: Props) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="review-title">
      {initialGrantId && <ReviewBody initialGrantId={initialGrantId} onClose={onClose} onApproved={onApproved} />}
    </Dialog>
  );
}

function ReviewBody({
  initialGrantId,
  onClose,
  onApproved,
}: {
  initialGrantId: string;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const { claim, approve } = useClaim();
  const grants = eligibleGrants(claim);
  const [selected, setSelected] = useState(initialGrantId);
  const [drafts, setDrafts] = useState<LLMNarrative[]>(claim.narratives);
  const [busy, setBusy] = useState(false);

  const grant = grants.find((g) => g.grantId === selected) ?? grants[0];
  if (!grant) return null;

  const original = claim.narratives.find((n) => n.grantId === grant.grantId);
  const draft = drafts.find((n) => n.grantId === grant.grantId);
  const signed = claim.status !== "EVALUATED";
  const money = coFunding(claim, grant);
  const edited = JSON.stringify(drafts) !== JSON.stringify(claim.narratives);
  const allPassed = grants.every((g) => g.checks.every((c) => c.passed));

  function updateDraft(next: LLMNarrative) {
    setDrafts((list) => list.map((n) => (n.grantId === next.grantId ? next : n)));
  }

  async function handleApprove() {
    setBusy(true);
    await approve(drafts, edited);
    setBusy(false);
    onClose();
    onApproved?.();
  }

  return (
    <>
      <div className="flex flex-none items-start justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <h2 id="review-title" className="text-title font-semibold">
            Review claim
          </h2>
          <p className="mt-0.5 text-body text-muted">
            {grants.length > 1 ? `${grants.length} grants on one sign-off` : grant.grantName},{" "}
            <span className="font-mono">{claim.claimId}</span>
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
      <GrantTabs grants={grants} selected={grant.grantId} onSelect={setSelected} label="Grants on this claim" />
      {grants.length < 2 && <div className="border-b border-line" />}

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
            <dl className="mt-2 divide-y divide-rule rounded-[var(--radius-card)] bg-raised px-4 text-body">
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Invoice {claim.invoice.invoiceNumber}</dt>
                <dd className="num">{formatMYR(claim.invoice.totalAmountMYR)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted">Matching rate on eligible items</dt>
                <dd className="num">{grant.matchingPercentage}%</dd>
              </div>
              <div className="flex justify-between gap-4 py-2 font-medium">
                <dt>Claimable under {grant.agency}</dt>
                <dd className="num">{formatMYR(money.claimable)}</dd>
              </div>
              {grants.length > 1 && (
                <div className="flex justify-between gap-4 py-2 font-medium">
                  <dt>Claimable on this claim</dt>
                  <dd className="num">{formatMYR(claim.totalClaimableAmountMYR)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-2 text-small text-muted">Amounts as computed by the rules engine, cap applied.</p>
          </section>

          <section aria-labelledby="review-docs">
            <h3 id="review-docs" className="text-section font-semibold">
              Documents for the packet
            </h3>
            {grant.requiredDocuments.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-body">
                {grant.requiredDocuments.map((doc) => (
                  <li key={doc}>{doc}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-body text-muted">The engine listed no extra documents for this grant.</p>
            )}
          </section>
        </div>

        <section aria-labelledby="review-narrative">
          <h3 id="review-narrative" className="mb-3 text-section font-semibold">
            Application narrative
          </h3>
          {draft && original ? (
            <NarrativeEditor
              key={grant.grantId}
              narrative={draft}
              original={original}
              onChange={updateDraft}
              readOnly={signed}
            />
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-control px-4 py-3 text-muted">
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
              ? `Approving signs off ${grants.length > 1 ? `all ${grants.length} grants` : "this grant"} and records any edits in the audit trail.`
              : "A rule is not met. Resolve it before approving."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[var(--radius-control)] px-3 text-body font-medium hover:bg-active"
          >
            {signed ? "Close" : "Cancel"}
          </button>
          {!signed && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy || !allPassed}
              className="h-9 rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Signing off…" : "Approve and sign off claim"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
