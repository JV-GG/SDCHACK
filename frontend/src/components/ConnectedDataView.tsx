"use client";

import { useClaim } from "@/lib/ClaimContext";
import { stagger } from "@/lib/motion";
import { AccountCard } from "@/components/AccountCard";
import { BackendError } from "@/components/BackendError";
import { ConnectedDataSkeleton } from "@/components/PageSkeletons";
import { DocumentsOnFile } from "@/components/DocumentsOnFile";
import { ProfileEditor } from "@/components/ProfileEditor";

/** The data the rules engine checks: the organisation profile (editable), the documents on file, the account. */
export function ConnectedDataView() {
  const { claim, error, retry } = useClaim();

  if (!claim) {
    if (error) return <BackendError message={error} onRetry={() => void retry()} />;
    return <ConnectedDataSkeleton />;
  }

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="anim-reveal text-title font-semibold" style={stagger(0)}>
        Connected data
      </h1>
      <p className="anim-reveal mt-1 max-w-[72ch] text-section text-muted" style={stagger(0)}>
        The facts every eligibility check uses. Edit a section to correct it; you will see which programmes the change
        unlocks before you save. Values are self-declared until SSM, HR and accounting integrations are connected.
      </p>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="anim-reveal" style={stagger(1)}>
          <ProfileEditor />
        </div>
        <div className="anim-reveal flex flex-col gap-6" style={stagger(2)}>
          <DocumentsOnFile />
          <AccountCard />
        </div>
      </div>
    </div>
  );
}
