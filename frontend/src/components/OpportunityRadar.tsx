"use client";

import { useId, useState } from "react";
import { ChevronDown, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import type { ProfileGrantMatch } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { formatDate, formatMYRShort } from "@/lib/format";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { Skeleton, SkeletonRegion } from "@/components/Skeleton";

/** Where the application window stands today, in a few words, with the colour that matches its urgency. */
function windowLine(match: ProfileGrantMatch): { text: string; className: string } {
  switch (match.windowStatus) {
    case "CLOSING_SOON":
      return {
        text: `Closes in ${match.daysUntilClose} day${match.daysUntilClose === 1 ? "" : "s"}`,
        className: "text-warning",
      };
    case "UPCOMING":
      return { text: `Opens ${match.opensAt ? formatDate(match.opensAt) : "soon"}`, className: "text-muted" };
    case "CLOSED":
      return { text: "Closed for now", className: "text-muted" };
    default:
      return {
        text:
          match.applicationMode === "ROLLING"
            ? "Open all year"
            : `Open until ${match.closesAt ? formatDate(match.closesAt) : "further notice"}`,
        className: "text-positive",
      };
  }
}

function OpportunityRow({ match, submitted }: { match: ProfileGrantMatch; submitted: boolean }) {
  const { openInvoiceModal, loading } = useClaim();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const accepting = match.windowStatus === "OPEN" || match.windowStatus === "CLOSING_SOON";
  const canApply = !submitted && accepting;
  const when = windowLine(match);

  return (
    <li className="border-t border-rule first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-section font-semibold">
            {match.agency} {match.grantName}
          </p>
          <p className={`mt-0.5 text-body num ${when.className}`}>
            {when.text} · up to {formatMYRShort(match.maxCoFundingMYR)}
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer"
          >
            <ChevronDown
              size={16}
              strokeWidth={1.5}
              aria-hidden="true"
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
            Details
          </button>
          {submitted ? (
            <span className="text-body text-muted">Already sent</span>
          ) : canApply ? (
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                openInvoiceModal({
                  grantId: match.grantId,
                  grantName: match.grantName,
                  agency: match.agency,
                  documentKind: match.requiresPreApproval ? "QUOTATION" : "RECEIPT",
                  categories: match.eligibleCategories,
                })
              }
              className="min-h-11 rounded-[10px] border border-control bg-surface px-4 text-body font-medium hover:bg-active cursor-pointer disabled:opacity-60"
            >
              Apply
            </button>
          ) : null}
        </div>
      </div>

      {open && (
        <div id={bodyId} className="anim-expand flex flex-col gap-4 border-t border-rule bg-raised/60 p-5">
          <p className="max-w-[72ch] text-body">{match.nextStep}</p>
          {match.requiresPreApproval && match.windowStatus !== "CLOSED" && (
            <p className="text-body text-warning">Get approval before you buy. Spending first can cancel the claim.</p>
          )}
          <EligibilityChecklist checks={match.profileChecks} />
          {match.requiredDocuments.length > 0 && (
            <div>
              <p className="mb-2 text-small font-semibold">Documents to prepare</p>
              <ul className="grid gap-1.5 text-small text-muted sm:grid-cols-2">
                {match.requiredDocuments.map((doc) => (
                  <li key={doc} className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-accent" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {match.sourceUrl && (
            <a
              href={match.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-start text-body font-medium text-accent hover:underline"
            >
              Agency guidelines
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Programmes this SME can apply for on its company profile alone, before any invoice exists. Only the
 * programmes it qualifies for are listed; each shows its application window and one Apply action.
 */
export function OpportunityRadar() {
  const { opportunities, opportunitiesLoading, runOpportunityScan, submittedGrants, loading } = useClaim();

  const submittedIds = new Set(submittedGrants.map((s) => s.grantId));
  const eligible = opportunities?.matches.filter((m) => m.isProfileEligible) ?? [];

  return (
    <section aria-labelledby="opportunities-title" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="opportunities-title" className="text-[20px] font-semibold leading-7">
            You can also apply for
          </h2>
          <p className="mt-1 text-[15px] text-muted">No invoice needed yet. Get approval first, then buy.</p>
        </div>
        <button
          type="button"
          onClick={() => void runOpportunityScan()}
          disabled={opportunitiesLoading || loading}
          className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer disabled:opacity-60"
        >
          {opportunitiesLoading ? (
            <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={14} aria-hidden="true" />
          )}
          Check again
        </button>
      </div>

      <div className="rounded-xl border border-line bg-surface">
        {!opportunities ? (
          opportunitiesLoading ? (
            <SkeletonRegion label="Checking your company against 7 programmes…">
              {[0, 1].map((i) => (
                <div key={i} aria-hidden="true" className="flex items-center justify-between gap-3 border-t border-rule px-5 py-4 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-6 w-3/5 max-w-96" />
                    <Skeleton className="mt-1 h-5 w-2/5 max-w-60" />
                  </div>
                  <Skeleton className="h-11 w-20" />
                </div>
              ))}
            </SkeletonRegion>
          ) : (
            <p className="px-5 py-6 text-body text-muted">Couldn&apos;t check right now. Press Check again to retry.</p>
          )
        ) : eligible.length > 0 ? (
          <ul>
            {eligible.map((m) => (
              <OpportunityRow key={m.grantId} match={m} submitted={submittedIds.has(m.grantId)} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-body text-muted">
            None right now. Check My company: correcting a detail there can open more programmes.
          </p>
        )}
      </div>
    </section>
  );
}
