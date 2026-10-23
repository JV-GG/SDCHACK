"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { LoaderCircle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuditEventRecord, ClaimSummary, ClaimsReadinessPackage, OrgAuditLogResponse } from "@/types/claim";
import { useClaim } from "@/lib/ClaimContext";
import { fetchOrgAuditEvents, fetchOrgClaim, fetchOrgClaims } from "@/lib/api";
import { formatDateTime, formatMYR, STATUS_LABEL } from "@/lib/format";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { StatusPill } from "@/components/StatusPill";

type Tab = "claim" | "org";

const CATEGORY_LABEL: Record<string, string> = {
  AUTH: "Sign-in",
  PROFILE: "Profile",
  DOCUMENT: "Document",
  EVALUATION: "Evaluation",
  APPROVAL: "Approval",
  SUBMISSION: "Submission",
  DISCOVERY: "Discovery",
};

const SIGN_IN_EVENTS = new Set(["LOGIN", "LOGIN_FAILED", "SESSION_RESUMED", "ORG_SWITCHED", "ORG_REGISTERED"]);

function actorText(e: AuditEventRecord) {
  if (e.actorType === "SYSTEM") return "System";
  if (e.actorType === "AI") return e.actorEmail ? `AI on behalf of ${e.actorEmail}` : "AI";
  return e.actorEmail ?? "Unidentified session";
}

function ActivityRow({ e }: { e: AuditEventRecord }) {
  return (
    <li className="flex flex-col gap-1 border-t border-rule py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-body font-medium">{e.title}</p>
        {e.description && <p className="mt-0.5 break-words text-body text-muted">{e.description}</p>}
        <p className="mt-1 text-small text-muted">
          <time dateTime={e.createdAt} className="num">
            {formatDateTime(e.createdAt)}
          </time>
          <span aria-hidden="true"> · </span>
          <span>{actorText(e)}</span>
          {e.ipAddress && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="num">IP {e.ipAddress}</span>
            </>
          )}
          {e.claimId && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="font-mono">{e.claimId}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex-none">
        <StatusPill tone={e.eventType === "LOGIN_FAILED" ? "negative" : "neutral"}>
          {e.eventType === "LOGIN_FAILED" ? "Failed sign-in" : CATEGORY_LABEL[e.category] ?? e.category}
        </StatusPill>
      </div>
    </li>
  );
}

function OrgActivity({ orgId }: { orgId: string }) {
  const { claim, submittedGrants } = useClaim();
  const [log, setLog] = useState<OrgAuditLogResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [category, setCategory] = useState<string>("ALL");
  const [reload, setReload] = useState(0);
  const filterId = useId();

  // Refetch when the org, the claim (approve/submit) or submitted grants change, or on manual refresh.
  useEffect(() => {
    let alive = true;
    fetchOrgAuditEvents(orgId)
      .then((res) => {
        if (!alive) return;
        setLog(res);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [orgId, claim, submittedGrants.length, reload]);

  const events = log?.events ?? [];
  const shown = category === "ALL" ? events : events.filter((e) => e.category === category);
  const signIns = events.filter((e) => SIGN_IN_EVENTS.has(e.eventType)).slice(0, 5);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Organisation activity" className="rounded-(--radius-card) border border-line bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule px-5 py-3">
          <div>
            <label htmlFor={filterId} className="mb-1 block text-small text-muted">
              Show
            </label>
            <select
              id={filterId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 w-56 rounded-(--radius-control) border border-control bg-surface px-2 text-body"
            >
              <option value="ALL">All activity</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            {log && (
              <span className="text-small text-muted num">
                {shown.length} shown · {log.totalEvents} recorded
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setState("loading");
                setReload((n) => n + 1);
              }}
              aria-label="Refresh activity"
              className="grid size-8 place-items-center rounded-(--radius-control) border border-control hover:bg-active cursor-pointer"
            >
              <RefreshCw size={14} className={state === "loading" ? "animate-spin" : ""} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="p-5">
          {state === "error" && !log ? (
            <p className="text-body text-negative">Could not load activity from the backend.</p>
          ) : !log ? (
            <p className="flex items-center gap-2 text-body text-muted">
              <LoaderCircle size={16} className="animate-spin text-accent" aria-hidden="true" />
              Loading activity…
            </p>
          ) : shown.length === 0 ? (
            <p className="text-body text-muted">No activity in this category yet.</p>
          ) : (
            <ol>
              {shown.map((e) => (
                <ActivityRow key={e.id} e={e} />
              ))}
            </ol>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-6" aria-label="Log integrity and sign-ins">
        <section aria-labelledby="audit-integrity">
          <h2 id="audit-integrity" className="mb-2 text-section font-semibold">
            Log integrity
          </h2>
          <div className="rounded-(--radius-card) bg-raised px-4 py-3 text-body">
            {!log ? (
              <p className="text-muted">Checking…</p>
            ) : log.chainValid ? (
              <p className="flex gap-2">
                <ShieldCheck size={16} className="mt-0.5 flex-none text-positive" aria-hidden="true" />
                <span>
                  Hash chain verified. All {log.totalEvents} entries are unchanged since they were written.
                </span>
              </p>
            ) : (
              <p className="flex gap-2 text-negative">
                <ShieldAlert size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                <span>Hash chain broken. At least one entry was edited or removed after it was written.</span>
              </p>
            )}
            <p className="mt-2 text-small text-muted">
              Every entry is written by the server with its time, company account and client IP, and is linked to the
              previous entry by SHA-256.
            </p>
          </div>
        </section>
        <section aria-labelledby="audit-signins">
          <h2 id="audit-signins" className="mb-2 text-section font-semibold">
            Recent sign-ins
          </h2>
          {signIns.length === 0 ? (
            <p className="rounded-(--radius-card) bg-raised px-4 py-3 text-body text-muted">No sign-ins recorded yet.</p>
          ) : (
            <ul className="rounded-(--radius-card) bg-raised px-4 py-1 text-body">
              {signIns.map((e) => (
                <li key={e.id} className="border-t border-rule py-2 first:border-t-0">
                  <p className={e.eventType === "LOGIN_FAILED" ? "font-medium text-negative" : "font-medium"}>
                    {e.title}
                  </p>
                  <p className="text-small text-muted num">
                    {formatDateTime(e.createdAt)} · {e.ipAddress ? `IP ${e.ipAddress}` : "IP not recorded"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

/** Picker groups, most progressed first; newest first within each group (server order). */
const STATUS_GROUPS = [
  { status: "SUBMITTED", label: "Submitted" },
  { status: "APPROVED", label: "Approved, not submitted" },
  { status: "EVALUATED", label: "Evaluated, awaiting sign-off" },
];

/** Option text for one claim: id, document, status, claimable amount and when it was evaluated. */
function claimOptionLabel(c: ClaimSummary, currentId?: string) {
  const parts = [
    c.claimId,
    c.documentNumber,
    STATUS_LABEL[c.status] ?? c.status,
    formatMYR(c.totalClaimableAmountMYR),
    formatDateTime(c.createdAt),
  ];
  // "Current" leads so it stays visible when the select truncates long labels.
  return `${c.claimId === currentId ? "Current: " : ""}${parts.join(" · ")}`;
}

function ClaimPicker({
  history,
  currentId,
  value,
  onChange,
}: {
  history: ClaimSummary[] | null;
  currentId?: string;
  value: string;
  onChange: (claimId: string) => void;
}) {
  const id = useId();
  const options = history ?? [];
  // The current claim is always selectable, even before the history list has loaded.
  const hasValue = options.some((c) => c.claimId === value);
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1 block text-small text-muted">
          Select claim
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full max-w-160 rounded-(--radius-control) border border-control bg-surface px-2 text-body num"
        >
          {!hasValue && value && <option value={value}>{value === currentId ? "Current: " : ""}{value}</option>}
          {STATUS_GROUPS.map(({ status, label }) => {
            const group = options.filter((c) => c.status === status);
            return group.length === 0 ? null : (
              <optgroup key={status} label={`${label} (${group.length})`}>
                {group.map((c) => (
                  <option key={c.claimId} value={c.claimId}>
                    {claimOptionLabel(c, currentId)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
      {history && (
        <span className="text-small text-muted num">
          {history.length} saved claim{history.length === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function ClaimTrail({
  claim,
  loading,
  picker,
}: {
  claim: ClaimsReadinessPackage | null;
  loading: boolean;
  picker: ReactNode;
}) {
  if (loading) {
    return (
      <>
        {picker}
        <p className="flex items-center gap-2 text-body text-muted">
          <LoaderCircle size={16} className="animate-spin text-accent" aria-hidden="true" />
          Loading claim…
        </p>
      </>
    );
  }
  if (!claim) {
    return (
      <div className="rounded-(--radius-card) border border-dashed border-control bg-raised/30 p-8 text-center">
        <p className="text-body text-muted">No claim yet. Submit an invoice or quotation on the Grant Hub.</p>
        <Link
          href="/"
          className="mt-3 inline-flex h-9 items-center rounded-(--radius-control) bg-ink px-4 text-body font-medium text-surface hover:opacity-90"
        >
          Go to Grant Hub
        </Link>
      </div>
    );
  }

  // Count events per actor from the trail itself, so the list always agrees with the timeline.
  const actors = new Map<string, number>();
  for (const e of claim.auditTrail) {
    const who = e.performedBy.split(" · ")[0]; // group the same account across IPs
    actors.set(who, (actors.get(who) ?? 0) + 1);
  }

  return (
    <>
    {picker}
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Claim events" className="rounded-(--radius-card) border border-line bg-surface p-5">
        <AuditTrailTimeline events={claim.auditTrail} comfortable />
      </section>
      <aside className="flex flex-col gap-6" aria-label="Claim and actors">
        <section aria-labelledby="audit-claim">
          <h2 id="audit-claim" className="mb-2 text-section font-semibold">
            Claim
          </h2>
          <dl className="rounded-(--radius-card) bg-raised px-4 py-1 text-body">
            {[
              ["Document", claim.invoice.invoiceNumber],
              ["Status", STATUS_LABEL[claim.status]],
              ["Claimable", formatMYR(claim.totalClaimableAmountMYR)],
              ["Events", String(claim.auditTrail.length)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right num">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="audit-actors">
          <h2 id="audit-actors" className="mb-2 text-section font-semibold">
            Who acted
          </h2>
          <ul className="rounded-(--radius-card) bg-raised px-4 py-1 text-body">
            {Array.from(actors.entries()).map(([who, count]) => (
              <li key={who} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 break-words">{who}</span>
                <span className="flex-none text-muted num">
                  {count} {count === 1 ? "action" : "actions"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
    </>
  );
}

/** The audit trail: one claim's history, and everything the organisation's account has done. */
export function AuditView() {
  const { claim, error, retry, currentOrg } = useClaim();
  const [tab, setTab] = useState<Tab>("claim");
  const uid = useId();
  const orgId = currentOrg?.id;

  // Claim history for the picker; refreshed when the org or the current claim changes.
  const [history, setHistory] = useState<ClaimSummary[] | null>(null);
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

  // null = follow the current claim. Any other id loads that saved claim from the server.
  const [picked, setPicked] = useState<{ orgId?: string; claimId: string } | null>(null);
  const pickedId = picked && picked.orgId === orgId ? picked.claimId : null;
  const [loadedClaim, setLoadedClaim] = useState<ClaimsReadinessPackage | null>(null);
  useEffect(() => {
    if (!orgId || !pickedId || pickedId === claim?.claimId) return;
    let alive = true;
    fetchOrgClaim(orgId, pickedId)
      .then((c) => alive && setLoadedClaim(c))
      .catch(() => alive && setLoadedClaim(null));
    return () => {
      alive = false;
    };
  }, [orgId, pickedId, claim?.claimId]);

  const followCurrent = !pickedId || pickedId === claim?.claimId;
  const shownClaim = followCurrent ? claim : loadedClaim?.claimId === pickedId ? loadedClaim : null;
  const claimLoading = !followCurrent && shownClaim === null;
  const selectValue = pickedId ?? claim?.claimId ?? "";

  if (!claim && error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-body text-rose-600 font-medium mb-3">Backend Error: {error}</p>
        <button
          onClick={() => void retry()}
          className="rounded-(--radius-control) bg-ink px-4 py-2 text-body font-medium text-surface cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "claim", label: "This claim" },
    { id: "org", label: "Organisation activity" },
  ];

  return (
    <div className="px-4 py-6 md:px-6">
      <h1 className="text-title font-semibold">Audit trail</h1>
      <p className="mt-1 max-w-[72ch] text-section text-muted">
        {tab === "claim" && (shownClaim ?? claim) ? (
          <>
            Every action on claim <span className="font-mono">{(shownClaim ?? claim)!.claimId}</span>, oldest first.
          </>
        ) : (
          <>Sign-ins, profile changes, documents, approvals and submissions for {currentOrg?.email ?? "this account"}, newest first.</>
        )}{" "}
        Times are Malaysia time (UTC+8).
      </p>

      <div role="tablist" aria-label="Audit views" className="mt-4 flex gap-4 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${uid}-${t.id}-tab`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${uid}-${t.id}-panel`}
            onClick={() => setTab(t.id)}
            className={`-mb-px h-10 border-b-2 px-0.5 text-body cursor-pointer ${
              tab === t.id ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id={`${uid}-${tab}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-${tab}-tab`}
        className="mt-6"
      >
        {tab === "claim" ? (
          <ClaimTrail
            claim={shownClaim}
            loading={claimLoading}
            picker={
              orgId && selectValue ? (
                <ClaimPicker
                  history={history}
                  currentId={claim?.claimId}
                  value={selectValue}
                  onChange={(claimId) => setPicked({ orgId, claimId })}
                />
              ) : null
            }
          />
        ) : currentOrg ? (
          <OrgActivity orgId={currentOrg.id} />
        ) : (
          <p className="text-body text-muted">Sign in to an organisation to see its activity.</p>
        )}
      </div>
    </div>
  );
}
