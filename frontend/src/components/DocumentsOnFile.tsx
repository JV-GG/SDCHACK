"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FilePlus2, LoaderCircle, RefreshCw } from "lucide-react";
import type { ClaimSummary } from "@/types/claim";
import { fetchOrgClaims } from "@/lib/api";
import { useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatDateTime, formatMYR, STATUS_LABEL } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { ListRowsSkeleton } from "@/components/PageSkeletons";
import { SkeletonRegion } from "@/components/Skeleton";

const STATUS_TONE: Record<string, "positive" | "warning" | "neutral"> = {
  SUBMITTED: "positive",
  APPROVED: "warning",
  EVALUATED: "neutral",
};

/**
 * The document the claim is built on, and the organisation's recent claims. Replaces the old ingestion
 * simulator: documents arrive as presets, uploads or typed entries, and each check creates a saved claim.
 */
export function DocumentsOnFile() {
  const { invoice, claim, currentOrg, reEvaluate, pipeline, loading, openInvoiceModal } = useClaim();
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

  const doc = claim?.invoice ?? invoice;
  const recent = (history ?? []).slice(0, 6);
  const busy = pipeline.running || loading;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="doc-title" className="rounded-(--radius-card) border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="doc-title" className="text-section font-semibold">
              Document on file
            </h2>
            <p className="mt-0.5 text-body text-muted">
              The invoice or quotation the current claim was checked against.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openInvoiceModal()}
            className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-control) bg-ink px-3 text-body font-medium text-surface hover:opacity-90 cursor-pointer"
          >
            <FilePlus2 size={14} aria-hidden="true" />
            Upload new document
          </button>
        </div>

        <div className="mt-4 rounded-(--radius-control) bg-raised p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="text-body font-semibold">{doc.vendorName}</p>
              <p className="text-small text-muted num">
                <span className="font-mono">{doc.invoiceNumber}</span> · Dated {formatDate(doc.invoiceDate)}
              </p>
              <p className="mt-1 text-small text-muted">
                {doc.vendorIsMdecTsp ? "Vendor declared as MDEC-accredited TSP" : "Vendor not declared as an MDEC TSP"}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-small text-muted">Total</span>
              <span className="text-section font-semibold num">{formatMYR(doc.totalAmountMYR)}</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-line text-left text-small text-muted">
                  <th scope="col" className="py-2 pr-3 font-normal">
                    Line item
                  </th>
                  <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">
                    Counts as
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {doc.items.map((item) => (
                  <tr key={item.id} className="border-b border-rule align-top last:border-b-0">
                    <td className="py-2.5 pr-3">{item.description}</td>
                    <td className="hidden whitespace-nowrap py-2.5 pr-3 text-muted sm:table-cell">
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right num">{formatMYR(item.totalPriceMYR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void reEvaluate()}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-(--radius-control) border border-control px-3 text-body font-medium hover:bg-active cursor-pointer disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            Re-check against current profile
          </button>
          <p className="text-small text-muted">Creates a new evaluation of this document; earlier claims are kept.</p>
        </div>
      </section>

      <section aria-labelledby="claims-title" className="rounded-(--radius-card) border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="claims-title" className="text-section font-semibold">
            Recent claims
          </h2>
          {history && (
            <Link href="/audit" className="text-small font-medium text-accent hover:underline">
              All {history.length} in the audit trail
            </Link>
          )}
        </div>
        {!history ? (
          <SkeletonRegion label="Loading recent claims…" className="mt-3">
            <ListRowsSkeleton rows={3} />
          </SkeletonRegion>
        ) : recent.length === 0 ? (
          <p className="mt-3 text-body text-muted">No claims yet. Upload a document to check it against the programmes.</p>
        ) : (
          <ul className="mt-2">
            {recent.map((c) => (
              <li
                key={c.claimId}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-medium">
                    <span className="font-mono">{c.documentNumber}</span>
                    <span className="text-muted font-normal"> · {c.vendorName}</span>
                  </p>
                  <p className="text-small text-muted num">
                    {formatMYR(c.documentAmountMYR)} document · {formatMYR(c.totalClaimableAmountMYR)} claimable ·{" "}
                    {formatDateTime(c.createdAt)}
                    {c.claimId === claim?.claimId && " · current"}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <StatusPill tone={STATUS_TONE[c.status] ?? "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</StatusPill>
                  <Link
                    href={`/audit?claim=${encodeURIComponent(c.claimId)}`}
                    className="text-small font-medium text-accent hover:underline"
                  >
                    View audit<span className="sr-only"> for claim {c.claimId}</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
