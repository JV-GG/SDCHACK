"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ClaimsReadinessPackage, GrantEvaluation } from "@/types/claim";
import { coFunding } from "@/lib/ClaimContext";
import { formatMYRShort } from "@/lib/format";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";

interface Props {
  grant: GrantEvaluation;
  claim: ClaimsReadinessPackage;
  /** The card's one action: review and approve, or open the packet once approved. */
  onAction?: () => void;
  actionLabel?: string;
}

/** A grant this invoice can claim: who pays, how much, and the rule checks behind a toggle. */
export function GrantMatrixCard({ grant, claim, onAction, actionLabel = "Review" }: Props) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const money = coFunding(claim, grant);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <p className="text-small text-muted">{grant.agency}</p>
      <h3 className="-mt-2 text-section font-semibold">{grant.grantName}</h3>
      <p className="text-[28px] font-semibold leading-tight num">{formatMYRShort(money.claimable)}</p>
      <p className="flex items-center gap-2 text-body text-positive">
        <Check size={16} strokeWidth={2.2} aria-hidden="true" />
        You meet every rule
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
          {open ? "Hide the checks" : `See the ${grant.checks.length} checks`}
        </button>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="min-h-11 rounded-[10px] border border-control bg-surface px-4 text-body font-medium hover:bg-active cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>

      {open && (
        <div id={bodyId} className="anim-expand flex flex-col gap-4 border-t border-rule pt-4">
          <EligibilityChecklist checks={grant.checks} />
          {grant.requiredDocuments && grant.requiredDocuments.length > 0 && (
            <div>
              <p className="mb-2 text-small font-semibold">Documents you will send</p>
              <ul className="flex flex-col gap-1.5 text-small text-muted">
                {grant.requiredDocuments.map((doc) => (
                  <li key={doc} className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-accent" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
