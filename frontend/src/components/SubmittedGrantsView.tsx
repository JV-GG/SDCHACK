"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, FileCheck, Lock } from "lucide-react";
import { useClaim, type SubmittedGrantRecord } from "@/lib/ClaimContext";
import { formatDateTime, formatDay, formatMYRShort } from "@/lib/format";
import { ApplicationPacketModal } from "@/components/ApplicationPacketModal";
import { BackendError } from "@/components/BackendError";
import { SubmittedSkeleton } from "@/components/PageSkeletons";
import { stagger } from "@/lib/motion";

/**
 * What happens after sending. The app records the submission but receives no updates from the agency yet,
 * so "Sent" is the last confirmed step and the agency's review is shown as the step in progress.
 */
function Progress({ record }: { record: SubmittedGrantRecord }) {
  const steps = [
    { label: "Sent", when: formatDay(record.submittedAt), state: "done" as const },
    { label: `${record.agency} checking`, when: "Now", state: "current" as const },
    { label: "Approved", when: "", state: "waiting" as const },
    { label: "Paid", when: "", state: "waiting" as const },
  ];
  return (
    <ol aria-label="Progress" className="grid grid-cols-4 gap-1.5">
      {steps.map((s) => (
        <li key={s.label} className="flex min-w-0 flex-col gap-2">
          <span
            aria-hidden="true"
            className={`h-2 rounded-full ${s.state === "done" ? "bg-positive" : s.state === "current" ? "bg-accent" : "bg-line"}`}
          />
          <p
            className={`text-body ${s.state === "current" ? "font-semibold text-accent" : s.state === "done" ? "font-semibold" : "text-muted"}`}
          >
            {s.label}
            <span className="sr-only">
              {s.state === "done" ? " (done)" : s.state === "current" ? " (in progress)" : " (not yet)"}
            </span>
          </p>
          {s.when && <p className="-mt-1.5 text-small text-muted num">{s.when}</p>}
        </li>
      ))}
    </ol>
  );
}

function ClaimCard({ record, onOpen }: { record: SubmittedGrantRecord; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <article className="flex flex-col gap-5 rounded-[14px] border border-line bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex h-5.5 items-center rounded-sm bg-raised px-2 text-small text-muted">
            {record.agency}
          </span>
          <h2 className="mt-2 text-[20px] font-semibold leading-7">{record.grantName}</h2>
        </div>
        <p className="text-[26px] font-semibold leading-tight num">{formatMYRShort(record.claimableAmountMYR)}</p>
      </div>

      <Progress record={record} />

      <p className="rounded-[10px] bg-raised px-4 py-3 text-[15px]">
        Nothing for you to do. {record.agency} doesn&apos;t send us updates yet, so watch your email for their decision.
      </p>

      {open && (
        <dl id={detailsId} className="anim-expand grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-5 gap-y-3">
          <div>
            <dt className="text-small text-muted">Supplier</dt>
            <dd className="mt-0.5 text-[15px] font-medium">{record.vendorName}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Invoice</dt>
            <dd className="mt-0.5 text-[15px] font-medium num">{record.invoiceNumber}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Sent on</dt>
            <dd className="mt-0.5 text-[15px] font-medium num">{formatDateTime(record.submittedAt)}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Grant pays</dt>
            <dd className="mt-0.5 text-[15px] font-medium num">{record.matchingPercentage}% of eligible costs</dd>
          </div>
          <div>
            <dt className="text-small text-muted">Reference</dt>
            <dd className="mt-0.5 font-mono text-body">{record.claimId}</dd>
          </div>
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
          className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-medium text-accent hover:bg-active cursor-pointer"
        >
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
          {open ? "Hide details" : "Show details"}
        </button>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/audit?claim=${encodeURIComponent(record.claimId)}`}
            className="inline-flex min-h-11 items-center rounded-[10px] border border-control px-4 text-[15px] font-medium hover:bg-active"
          >
            History
          </Link>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-11 items-center rounded-[10px] bg-ink px-4 text-[15px] font-medium text-surface hover:opacity-90 cursor-pointer"
          >
            Open application
          </button>
        </div>
      </div>
    </article>
  );
}

/** My claims: what has been sent, how much was asked for, and where each claim stands. */
export function SubmittedGrantsView() {
  const { submittedGrants, booting, submittedLoading, claim, error, retry } = useClaim();
  const [activePacket, setActivePacket] = useState<SubmittedGrantRecord | null>(null);

  if (!claim && error) return <BackendError message={error} onRetry={() => void retry()} />;
  // Wait for the real records before showing totals or the empty state, so neither flashes wrong data.
  if (booting || submittedLoading) return <SubmittedSkeleton />;

  const total = submittedGrants.reduce((sum, g) => sum + g.claimableAmountMYR, 0);
  const agencies = Array.from(new Set(submittedGrants.map((g) => g.agency)));
  const latest = submittedGrants.reduce<string | null>(
    (max, g) => (max === null || g.submittedAt > max ? g.submittedAt : max),
    null,
  );

  return (
    <div className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-7">
        <h1 className="anim-reveal text-lead font-semibold tracking-[-0.01em]" style={stagger(0)}>
          My claims
        </h1>

        {submittedGrants.length === 0 ? (
          <div className="anim-reveal rounded-[14px] border border-dashed border-control bg-raised/30 p-12 text-center" style={stagger(1)}>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-raised text-muted">
              <FileCheck size={24} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h2 className="mt-3 text-[20px] font-semibold">No claims sent yet</h2>
            <p className="mx-auto mt-1 max-w-[46ch] text-[15px] text-muted">
              When you approve a grant on Home and send it, it shows up here so you can follow it.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-surface hover:opacity-90"
            >
              Go to Home
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <section
              aria-label="Summary"
              className="anim-reveal grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-px overflow-hidden rounded-xl border border-line bg-line"
              style={stagger(1)}
            >
              <div className="bg-surface px-5 py-4.5">
                <p className="text-body text-muted">Asked for</p>
                <p className="mt-1 text-[28px] font-semibold leading-tight text-positive num">{formatMYRShort(total)}</p>
              </div>
              <div className="bg-surface px-5 py-4.5">
                <p className="text-body text-muted">Claims sent</p>
                <p className="mt-1 text-[28px] font-semibold leading-tight num">{submittedGrants.length}</p>
                <p className="mt-0.5 text-small text-muted">to {agencies.join(", ")}</p>
              </div>
              <div className="bg-surface px-5 py-4.5">
                <p className="text-body text-muted">Last sent</p>
                <p className="mt-1 text-[28px] font-semibold leading-tight num">
                  {latest ? formatDay(latest) : "—"}
                </p>
              </div>
            </section>

            <div className="anim-reveal grid items-start gap-4 xl:grid-cols-2" style={stagger(2)}>
              {submittedGrants.map((s) => (
                <ClaimCard key={s.id} record={s} onOpen={() => setActivePacket(s)} />
              ))}
            </div>

            <p className="flex items-center gap-2 text-body text-muted">
              <Lock size={14} aria-hidden="true" />
              Sent claims are locked. Nobody can change them afterwards.
            </p>
          </>
        )}
      </div>

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
