"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePlus2 } from "lucide-react";
import type { ClaimSummary } from "@/types/claim";
import { fetchOrgClaims } from "@/lib/api";
import { useClaim } from "@/lib/ClaimContext";
import { formatMYRShort } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { ListRowsSkeleton } from "@/components/PageSkeletons";
import { SkeletonRegion } from "@/components/Skeleton";

/** One plain outcome per invoice: what it was worth in grants, and whether that has been sent. */
function Outcome({ c }: { c: ClaimSummary }) {
  if (c.totalClaimableAmountMYR <= 0) return <StatusPill tone="neutral">No grant fits</StatusPill>;
  const amount = formatMYRShort(c.totalClaimableAmountMYR);
  if (c.status === "SUBMITTED") return <StatusPill tone="positive">{amount} sent</StatusPill>;
  if (c.status === "APPROVED") return <StatusPill tone="warning">{amount} approved, not sent</StatusPill>;
  return <StatusPill tone="positive">{amount} claimable</StatusPill>;
}

/** The invoices and quotations checked for this company, newest first, each with its grant outcome. */
export function DocumentsOnFile() {
  const { claim, currentOrg, openInvoiceModal } = useClaim();
  const [history, setHistory] = useState<ClaimSummary[] | null>(null);
  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    fetchOrgClaims(orgId)
      .then((list) => alive && setHistory(list))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [orgId, claim]);

  const recent = (history ?? []).slice(0, 6);

  return (
    <section aria-labelledby="invoices-title" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="invoices-title" className="text-[18px] font-semibold leading-7">
          My invoices
        </h2>
        <button
          type="button"
          onClick={() => openInvoiceModal()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-body font-medium text-accent hover:bg-active cursor-pointer"
        >
          <FilePlus2 size={14} aria-hidden="true" />
          Upload
        </button>
      </div>
      {!history ? (
        <SkeletonRegion label="Loading invoices…" className="rounded-xl border border-line p-4">
          <ListRowsSkeleton rows={3} />
        </SkeletonRegion>
      ) : recent.length === 0 ? (
        <p className="rounded-xl border border-line p-4 text-body text-muted">
          No invoices yet. Upload one to see which grants it can claim.
        </p>
      ) : (
        <ul className="rounded-xl border border-line">
          {recent.map((c) => (
            <li key={c.claimId} className="flex flex-col gap-1.5 border-t border-rule px-4 py-3.5 first:border-t-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate font-semibold num">{c.documentNumber}</p>
                <p className="flex-none num">{formatMYRShort(c.documentAmountMYR)}</p>
              </div>
              <p className="truncate text-small text-muted">{c.vendorName}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Outcome c={c} />
                <Link
                  href={`/audit?claim=${encodeURIComponent(c.claimId)}`}
                  className="text-small font-medium text-accent hover:underline"
                >
                  History<span className="sr-only"> for {c.documentNumber}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
