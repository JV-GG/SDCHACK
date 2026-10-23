"use client";

import { useId, useState } from "react";
import { CalendarClock, ChevronDown, ExternalLink, FilePlus2, LoaderCircle, Radar } from "lucide-react";
import type { ProfileGrantMatch } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatDateTime, formatMYR } from "@/lib/format";
import { AGENCY_LABEL } from "@/components/GrantMatrixCard";
import { EligibilityChecklist } from "@/components/EligibilityChecklist";
import { StatusPill } from "@/components/StatusPill";

/** One pill for where the scheme's application window stands today. */
function WindowPill({ match }: { match: ProfileGrantMatch }) {
  switch (match.windowStatus) {
    case "CLOSING_SOON":
      return (
        <StatusPill tone="warning">
          Closes in {match.daysUntilClose} day{match.daysUntilClose === 1 ? "" : "s"}
        </StatusPill>
      );
    case "UPCOMING":
      return <StatusPill tone="neutral">Opens {match.opensAt ? formatDate(match.opensAt) : "soon"}</StatusPill>;
    case "CLOSED":
      return <StatusPill tone="neutral">Window closed</StatusPill>;
    default:
      return (
        <StatusPill tone="positive">
          {match.applicationMode === "ROLLING"
            ? "Open year-round"
            : `Open until ${match.closesAt ? formatDate(match.closesAt) : "further notice"}`}
        </StatusPill>
      );
  }
}

function OpportunityRow({ match, submitted }: { match: ProfileGrantMatch; submitted: boolean }) {
  const { openInvoiceModal, loading } = useClaim();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const passed = match.profileChecks.filter((c) => c.passed).length;
  const accepting = match.windowStatus === "OPEN" || match.windowStatus === "CLOSING_SOON";
  const canApply = match.isProfileEligible && !submitted && accepting;
  const applyLabel = match.requiresPreApproval ? "Apply with quotation" : "Attach receipt & claim";

  return (
    <li className="border-t border-rule first:border-t-0">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex h-5 items-center rounded-sm bg-raised px-1.5 text-small font-medium text-muted">
            {AGENCY_LABEL[match.agency] ?? match.agency}
          </p>
          <h3 className="mt-1.5 text-body font-semibold">{match.grantName}</h3>
          <p className="mt-0.5 text-body text-muted num">
            {match.matchingPercentage}% matching, up to {formatMYR(match.maxCoFundingMYR)}
            {match.eligibleCategories.length > 0 && (
              <> · for {match.eligibleCategories.map((c) => CATEGORY_LABEL[c] ?? c).join(", ")}</>
            )}
          </p>
          {match.isProfileEligible && <p className="mt-2 max-w-[72ch] text-body">{match.nextStep}</p>}
          {match.isProfileEligible && match.requiresPreApproval && match.windowStatus !== "CLOSED" && (
            <p className="mt-1 text-small text-warning">Apply and get approval before you buy. Spending first can void the claim.</p>
          )}
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <WindowPill match={match} />
          {submitted && <StatusPill tone="neutral">Already submitted</StatusPill>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 flex h-8 items-center gap-1.5 rounded-md px-2 text-body font-medium hover:bg-active cursor-pointer"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
          <span className="num">
            {passed} of {match.profileChecks.length} profile rules passed
          </span>
        </button>
        <div className="flex items-center gap-4">
          {match.sourceUrl && (
            <a
              href={match.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline"
            >
              Agency guidelines
              <ExternalLink size={12} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          {canApply && (
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
              className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-control) bg-ink px-3 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-60"
            >
              <FilePlus2 size={14} aria-hidden="true" />
              {applyLabel}
            </button>
          )}
          {match.isProfileEligible && !submitted && match.windowStatus === "UPCOMING" && (
            <button
              type="button"
              disabled
              title="Applications are not open yet. Prepare the documents below in the meantime."
              className="h-8 rounded-(--radius-control) border border-control px-3 text-body font-medium text-muted disabled:opacity-70"
            >
              Opens {match.opensAt ? formatDate(match.opensAt) : "soon"}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-rule bg-raised/60 p-5">
          <EligibilityChecklist checks={match.profileChecks} />
          {match.isProfileEligible && match.requiredDocuments.length > 0 && (
            <div className="rounded-(--radius-control) border border-line bg-surface p-3.5">
              <p className="mb-2 text-small font-semibold text-ink">Documents to prepare</p>
              <ul className="grid gap-1.5 text-small text-muted sm:grid-cols-2">
                {match.requiredDocuments.map((doc) => (
                  <li key={doc} className="flex items-center gap-2">
                    <span className="size-1.5 flex-none rounded-full bg-accent" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Year-round opportunity radar: the programmes this SME can apply for on its SSM and HR profile
 * alone, before any invoice exists, with each scheme's application window.
 */
export function OpportunityRadar() {
  const { opportunities, opportunitiesLoading, runOpportunityScan, submittedGrants, loading } = useClaim();
  const [showIneligible, setShowIneligible] = useState(false);
  const ineligibleId = useId();

  const submittedIds = new Set(submittedGrants.map((s) => s.grantId));
  const eligible = opportunities?.matches.filter((m) => m.isProfileEligible) ?? [];
  const ineligible = opportunities?.matches.filter((m) => !m.isProfileEligible) ?? [];

  return (
    <section aria-labelledby="opportunities-title">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="opportunities-title" className="text-section font-semibold">
          Programmes you can apply for{opportunities ? ` (${eligible.length})` : ""}
        </h2>
        <button
          type="button"
          onClick={() => void runOpportunityScan()}
          disabled={opportunitiesLoading || loading}
          className="flex h-8 items-center gap-1.5 rounded-(--radius-control) border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer disabled:opacity-60"
        >
          {opportunitiesLoading ? (
            <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Radar size={14} className="text-accent" aria-hidden="true" />
          )}
          <span>Scan profile now</span>
        </button>
      </div>
      <p className="mb-3 text-body text-muted">
        Checked year-round against your SSM and HR profile only, so you can plan and apply before you spend. Invoice rules
        such as vendor and spending scope are checked when you submit a quotation or invoice.
      </p>

      <div className="rounded-(--radius-card) border border-line bg-surface">
        {!opportunities ? (
          <div className="flex items-center gap-2 px-5 py-6 text-body text-muted">
            {opportunitiesLoading ? (
              <>
                <LoaderCircle size={16} className="animate-spin text-accent" aria-hidden="true" />
                <span>Scanning your profile against 7 programmes…</span>
              </>
            ) : (
              <span>Profile scan unavailable. Use Scan profile now to retry.</span>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3 text-small text-muted">
              <span className="num">
                {opportunities.openNowCount} accepting applications now · up to{" "}
                {formatMYR(opportunities.potentialCoFundingMYR)} in combined scheme ceilings
              </span>
              <span className="inline-flex items-center gap-1 num">
                <CalendarClock size={12} aria-hidden="true" />
                Scanned {formatDateTime(opportunities.scannedAt)}
              </span>
            </div>

            {eligible.length > 0 ? (
              <ul>
                {eligible.map((m) => (
                  <OpportunityRow key={m.grantId} match={m} submitted={submittedIds.has(m.grantId)} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-body text-muted">
                Your profile does not yet meet any programme&apos;s company-level criteria. See what is missing below.
              </p>
            )}

            {ineligible.length > 0 && (
              <div className="border-t border-rule">
                <button
                  type="button"
                  aria-expanded={showIneligible}
                  aria-controls={ineligibleId}
                  onClick={() => setShowIneligible((v) => !v)}
                  className="flex h-11 w-full items-center gap-1.5 px-5 text-body font-medium text-muted hover:bg-active cursor-pointer"
                >
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className={`transition-transform ${showIneligible ? "rotate-180" : ""}`}
                  />
                  <span className="num">
                    {ineligible.length} programme{ineligible.length === 1 ? "" : "s"} your profile does not meet yet
                  </span>
                </button>
                {showIneligible && (
                  <ul id={ineligibleId} className="border-t border-rule">
                    {ineligible.map((m) => (
                      <li key={m.grantId} className="border-t border-rule px-5 py-3 first:border-t-0">
                        <p className="text-body font-medium">
                          {m.grantName}
                          <span className="ml-2 text-small font-normal text-muted">
                            {AGENCY_LABEL[m.agency] ?? m.agency}
                          </span>
                        </p>
                        <p className="mt-0.5 text-body text-muted">{m.nextStep}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
