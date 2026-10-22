"use client";

import { useClaim } from "@/lib/ClaimContext";
import { CompanyProfileCard } from "@/components/CompanyProfileCard";
import { IngestionSimulator } from "@/components/IngestionSimulator";

/** Steps 1 and 2: the expense that triggers a claim, and the company data the systems already hold. */
export function ConnectedDataView() {
  const { company } = useClaim();

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="text-title font-semibold">Connected data</h1>
      <p className="mt-1 max-w-[68ch] text-section text-muted">
        Eligibility is checked against what SSM, Orbyte HR and accounting report. Nothing here is typed in by hand.
      </p>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <IngestionSimulator />
        <CompanyProfileCard company={company} />
      </div>
    </div>
  );
}
