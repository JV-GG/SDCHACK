"use client";

import { useClaim } from "@/lib/ClaimContext";
import { stagger } from "@/lib/motion";
import { AccountCard } from "@/components/AccountCard";
import { BackendError } from "@/components/BackendError";
import { ConnectedDataSkeleton } from "@/components/PageSkeletons";
import { DocumentsOnFile } from "@/components/DocumentsOnFile";
import { ProfileEditor } from "@/components/ProfileEditor";

/** My company: the details every grant check uses (editable one section at a time), the invoices, the account. */
export function ConnectedDataView() {
  const { claim, company, error, retry } = useClaim();

  if (!claim) {
    if (error) return <BackendError message={error} onRetry={() => void retry()} />;
    return <ConnectedDataSkeleton />;
  }

  return (
    <div className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-7">
        <div className="anim-reveal" style={stagger(0)}>
          <h1 className="text-lead font-semibold tracking-[-0.01em]">{company.companyName}</h1>
          <p className="mt-2 text-section text-muted">
            We use these details to check which grants fit you. Spot a mistake? Edit it.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <div className="anim-reveal min-w-0 flex-[999_1_460px]" style={stagger(1)}>
            <ProfileEditor />
          </div>
          <div className="anim-reveal flex min-w-0 flex-[1_1_300px] flex-col gap-6" style={stagger(2)}>
            <DocumentsOnFile />
            <AccountCard />
          </div>
        </div>
      </div>
    </div>
  );
}
