"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  FileCheck,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { useClaim, type SubmittedGrantRecord } from "@/lib/ClaimContext";
import { formatDateTime, formatMYR } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { StatusPill } from "@/components/StatusPill";

const AGENCY_FULL: Record<string, string> = {
  MDEC: "Malaysia Digital Economy Corporation (MDEC)",
  "SME Corp": "SME Corporation Malaysia",
  MATRADE: "Malaysia External Trade Development Corporation (MATRADE)",
};

export function SubmittedGrantsView() {
  const { submittedGrants } = useClaim();
  const [activePacket, setActivePacket] = useState<SubmittedGrantRecord | null>(null);

  const totalClaimedMYR = submittedGrants.reduce((sum, g) => sum + g.claimableAmountMYR, 0);
  const distinctAgencies = Array.from(new Set(submittedGrants.map((g) => g.agency)));

  return (
    <div className="px-4 py-6 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-semibold">Submitted grants</h1>
          <p className="mt-1 max-w-[70ch] text-section text-muted">
            Official repository of all SME grant claims signed off by business management and submitted to
            government agencies. All submissions include cryptographic verification fingerprints.
          </p>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-4">
        <div className="bg-surface p-4">
          <p className="text-body text-muted">Submitted claims</p>
          <p className="mt-1 text-lead font-normal num">{submittedGrants.length}</p>
          <p className="mt-1 text-small text-muted">
            {submittedGrants.length === 1 ? "1 grant application" : `${submittedGrants.length} grant applications`}
          </p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-body text-muted">Total co-funding</p>
          <p className="mt-1 text-lead font-normal num text-positive">{formatMYR(totalClaimedMYR)}</p>
          <p className="mt-1 text-small text-muted">Cumulative subsidy requested</p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-body text-muted">Agencies engaged</p>
          <p className="mt-1 text-lead font-normal num">{distinctAgencies.length}</p>
          <p className="mt-1 text-small text-muted">
            {distinctAgencies.length > 0 ? distinctAgencies.join(", ") : "None yet"}
          </p>
        </div>
        <div className="bg-surface p-4">
          <p className="text-body text-muted">Audit integrity</p>
          <div className="mt-1 flex items-center gap-1.5 text-positive font-semibold text-body">
            <ShieldCheck size={18} strokeWidth={2} />
            <span>SHA-256 Verified</span>
          </div>
          <p className="mt-1 text-small text-muted">Immutable tamper-proof logs</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="mt-6 flex flex-col gap-4">
        {submittedGrants.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-control p-12 text-center bg-raised/30">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-raised text-muted">
              <FileCheck size={24} strokeWidth={1.5} />
            </div>
            <h2 className="mt-3 text-section font-semibold">No submitted grants yet</h2>
            <p className="mt-1 text-body text-muted max-w-[50ch] mx-auto">
              Once you review an eligible grant claim on the Grant Hub, sign off on the project justification, and
              mark it as submitted, its permanent application packet and dossier will appear here.
            </p>
            <div className="mt-5">
              <Link
                href="/"
                className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90"
              >
                <span>Go to Grant Hub</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          submittedGrants.map((s) => (
            <article
              key={s.id}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6 transition-all"
            >
              {/* Card Top Row */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-5 items-center rounded-sm bg-raised px-1.5 text-small font-medium text-muted">
                      {AGENCY_FULL[s.agency] ?? s.agency}
                    </span>
                    <span className="font-mono text-small text-muted">{s.claimId}</span>
                  </div>
                  <h2 className="mt-2 text-title font-semibold">{s.grantName}</h2>
                  <p className="mt-0.5 text-body text-muted num">
                    {s.matchingPercentage}% matching co-funding on tax invoice {s.invoiceNumber}
                  </p>
                </div>
                <div className="flex flex-row items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
                  <StatusPill tone="positive">Submitted</StatusPill>
                  <p className="text-title font-semibold num text-right text-positive">
                    {formatMYR(s.claimableAmountMYR)}
                    <span className="block text-small font-normal text-muted">approved claim amount</span>
                  </p>
                </div>
              </div>

              {/* Metadata strip */}
              <div className="mt-5 grid grid-cols-1 gap-3 rounded-[var(--radius-control)] bg-raised p-3.5 sm:grid-cols-3 text-body">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Receipt size={16} className="text-muted flex-none" />
                  <div className="truncate">
                    <span className="text-small text-muted block">Vendor</span>
                    <span className="truncate font-medium">{s.vendorName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Calendar size={16} className="text-muted flex-none" />
                  <div className="truncate">
                    <span className="text-small text-muted block">Submitted Date</span>
                    <span className="num font-medium">{formatDateTime(s.submittedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={16} className="text-positive flex-none" />
                  <div className="truncate">
                    <span className="text-small text-muted block">Audit Status</span>
                    <span className="font-medium text-positive">Signed off & archived</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
                <div className="flex items-center gap-2 text-small text-muted">
                  <Building2 size={15} />
                  <span>Company: {s.claimSnapshot.company.companyName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/audit"
                    className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-control px-3 text-body font-medium hover:bg-active text-ink"
                  >
                    View audit trail
                  </Link>
                  <button
                    type="button"
                    onClick={() => setActivePacket(s)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] bg-ink px-3 text-body font-medium text-surface hover:opacity-90 cursor-pointer"
                  >
                    <span>View dossier & packet</span>
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Packet / Dossier Modal for Submitted Grant */}
      {activePacket && (
        <ApplicationPacketModal
          open={activePacket !== null}
          onClose={() => setActivePacket(null)}
          initialGrantId={activePacket.grantId}
          claimOverride={activePacket.claimSnapshot}
        />
      )}
    </div>
  );
}
