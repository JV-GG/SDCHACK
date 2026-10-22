"use client";

import { Building2, FilePlus2 } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { CompanyProfileCard } from "@/components/CompanyProfileCard";
import { IngestionSimulator } from "@/components/IngestionSimulator";

/** Steps 1 and 2: the expense that triggers a claim, and the company data the systems already hold. */
export function ConnectedDataView() {
  const { company, openAuthModal, openInvoiceModal } = useClaim();

  return (
    <div className="px-4 py-6 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-semibold">Connected data</h1>
          <p className="mt-1 max-w-[68ch] text-section text-muted">
            Eligibility is checked deterministically against what SSM, Orbyte HR, and Neon Postgres store. Trigger a new invoice or update SSM records below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-none">
          <button
            type="button"
            onClick={() => openInvoiceModal()}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] border border-control bg-surface px-3 text-body font-medium text-ink hover:bg-active cursor-pointer"
          >
            <FilePlus2 size={14} className="text-accent" />
            <span>Submit New Invoice Trigger</span>
          </button>
          <button
            type="button"
            onClick={() => openAuthModal("edit")}
            className="h-9 flex items-center gap-1.5 rounded-[var(--radius-control)] bg-ink px-3.5 text-body font-medium text-surface hover:opacity-90 cursor-pointer"
          >
            <Building2 size={14} />
            <span>Edit SSM & Organization Profile</span>
          </button>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <IngestionSimulator />
        <CompanyProfileCard company={company} />
      </div>
    </div>
  );
}
