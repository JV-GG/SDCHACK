"use client";

import { useClaim } from "@/lib/ClaimContext";
import { AccountCard } from "@/components/AccountCard";
import { DocumentsOnFile } from "@/components/DocumentsOnFile";
import { ProfileEditor } from "@/components/ProfileEditor";

/** The data the rules engine checks: the organisation profile (editable), the documents on file, the account. */
export function ConnectedDataView() {
  const { claim, error, retry } = useClaim();

  if (!claim && error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="mb-3 text-body font-medium text-negative">Backend Error: {error}</p>
        <button
          onClick={() => void retry()}
          className="rounded-(--radius-control) bg-ink px-4 py-2 text-body font-medium text-surface cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="text-title font-semibold">Connected data</h1>
      <p className="mt-1 max-w-[72ch] text-section text-muted">
        The facts every eligibility check uses. Edit a section to correct it; you will see which programmes the change
        unlocks before you save. Values are self-declared until SSM, HR and accounting integrations are connected.
      </p>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ProfileEditor />
        <div className="flex flex-col gap-6">
          <DocumentsOnFile />
          <AccountCard />
        </div>
      </div>
    </div>
  );
}
