import { Suspense } from "react";
import { AuditView } from "@/components/AuditView";

// AuditView reads ?claim= with useSearchParams, so it renders on the client inside a Suspense boundary.
export default function AuditPage() {
  return (
    <Suspense fallback={<div className="px-4 py-6 md:px-6 text-body text-muted">Loading audit trail…</div>}>
      <AuditView />
    </Suspense>
  );
}
