"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Check, ChevronDown, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import type { AuditEventRecord, ClaimSummary, ClaimsReadinessPackage, OrgAuditLogResponse } from "@/types/claim";
import { eligibleGrants, useClaim } from "@/lib/ClaimContext";
import { fetchOrgAuditEvents, fetchOrgClaim, fetchOrgClaims } from "@/lib/api";
import { formatDateTime, formatDay, formatMYRShort } from "@/lib/format";
import { AuditTrailTimeline } from "@/components/AuditTrailTimeline";
import { StatusPill } from "@/components/StatusPill";
import { BackendError } from "@/components/BackendError";
import { AuditClaimBodySkeleton, AuditSkeleton, ListRowsSkeleton } from "@/components/PageSkeletons";
import { SkeletonRegion } from "@/components/Skeleton";
import { stagger } from "@/lib/motion";

const CATEGORY_LABEL: Record<string, string> = {
  AUTH: "Sign-ins",
  PROFILE: "Company changes",
  DOCUMENT: "Invoices",
  EVALUATION: "Checks",
  APPROVAL: "Approvals",
  SUBMISSION: "Sent claims",
  DISCOVERY: "Programme checks",
};

const SIGN_IN_EVENTS = new Set(["LOGIN", "LOGIN_FAILED", "SESSION_RESUMED", "ORG_SWITCHED", "ORG_REGISTERED"]);

const PLAIN_STATUS: Record<string, string> = {
  EVALUATED: "waiting for approval",
  APPROVED: "approved, not sent",
  SUBMITTED: "sent",
};

function actorText(e: AuditEventRecord) {
  if (e.actorType === "SYSTEM") return "GrantFlow";
  if (e.actorType === "AI") return "GrantFlow AI";
  return e.actorEmail ?? "Unknown session";
}

interface Step {
  label: string;
  when?: string;
  state: "done" | "current" | "waiting";
}

/** The claim's audit trail retold as the five things that happen to an invoice, in plain words. */
function storySteps(claim: ClaimsReadinessPackage): Step[] {
  const trail = claim.auditTrail;
  const at = (type: string) => trail.find((e) => e.eventType === type)?.timestamp;
  const lastAt = (type: string) => [...trail].reverse().find((e) => e.eventType === type)?.timestamp;
  const eligible = eligibleGrants(claim);
  const uploaded = at("DOCUMENT_SUBMITTED");

  const steps: Step[] = [
    {
      label: uploaded ? "You uploaded the invoice" : "We checked the saved invoice again",
      when: uploaded ?? trail[0]?.timestamp,
      state: "done",
    },
    {
      label:
        eligible.length > 0
          ? `We checked it against ${claim.evaluations.length} grants — ${eligible.length} matched`
          : `We checked it against ${claim.evaluations.length} grants — none matched`,
      when: claim.timestamp,
      state: "done",
    },
  ];
  if (eligible.length === 0) return steps;

  const drafted = at("NARRATIVES_DRAFTED");
  if (drafted)
    steps.push({
      label: "We wrote a draft for you",
      when: drafted,
      state: "done",
    });

  const approved = at("CLAIM_APPROVED");
  const edited = trail.some((e) => e.eventType === "NARRATIVE_EDITED");
  steps.push(
    approved
      ? {
          label: edited ? "You edited and approved it" : "You approved it",
          when: approved,
          state: "done",
        }
      : { label: "Waiting for your approval", state: "current" },
  );

  const sent = lastAt("GRANT_SUBMITTED");
  const agencies = Array.from(new Set(eligible.map((g) => g.agency))).join(" and ");
  steps.push(
    sent
      ? { label: `Sent to ${agencies}, then locked`, when: sent, state: "done" }
      : {
          label: `Send to ${agencies}`,
          state: approved ? "current" : "waiting",
        },
  );
  return steps;
}

function ClaimStory({ claim }: { claim: ClaimsReadinessPackage }) {
  const [showLog, setShowLog] = useState(false);
  const logId = useId();
  const steps = storySteps(claim);
  const matched = eligibleGrants(claim).length > 0;

  return (
    <article className="rounded-[14px] border border-line bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[19px] font-semibold leading-7">Invoice {claim.invoice.invoiceNumber}</h2>
        <p className="text-[15px] text-muted num">
          {matched ? `${formatMYRShort(claim.totalClaimableAmountMYR)} claim` : "No grant matched"} ·{" "}
          {formatDay(claim.timestamp)}
        </p>
      </div>
      <ol className="mt-5 flex flex-col">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`flex size-7 flex-none items-center justify-center rounded-full ${
                  s.state === "done"
                    ? "bg-pill-positive-bg text-positive"
                    : s.state === "current"
                      ? "border-2 border-accent bg-surface"
                      : "border-2 border-line bg-surface"
                }`}
              >
                {s.state === "done" && <Check size={14} strokeWidth={2.6} />}
              </span>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`min-h-4.5 w-0.5 flex-1 ${s.state === "done" ? "bg-pill-positive-bg" : "bg-line"}`}
                />
              )}
            </div>
            <div className={i < steps.length - 1 ? "pb-4" : ""}>
              <p
                className={`mt-0.5 text-section font-medium ${s.state === "waiting" ? "text-muted" : ""} ${s.state === "current" ? "text-accent" : ""}`}
              >
                {s.label}
                <span className="sr-only">
                  {s.state === "done" ? " (done)" : s.state === "current" ? " (next step)" : " (not yet)"}
                </span>
              </p>
              {s.when && <p className="mt-0.5 text-body text-muted num">{formatDateTime(s.when)}</p>}
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        aria-expanded={showLog}
        aria-controls={logId}
        onClick={() => setShowLog((v) => !v)}
        className="-ml-2 mt-3 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-medium text-accent hover:bg-active cursor-pointer"
      >
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className={`transition-transform ${showLog ? "rotate-180" : ""}`}
        />
        {showLog ? "Hide technical log" : "Show technical log"}
      </button>
      {showLog && (
        <div id={logId} className="anim-expand mt-2 border-t border-rule pt-4">
          <p className="mb-3 text-small text-muted">
            Claim <span className="font-mono">{claim.claimId}</span>, oldest first. Malaysia time (UTC+8).
          </p>
          <AuditTrailTimeline events={claim.auditTrail} />
        </div>
      )}
    </article>
  );
}

function ClaimPicker({
  history,
  currentId,
  value,
  onChange,
}: {
  history: ClaimSummary[];
  currentId?: string;
  value: string;
  onChange: (claimId: string) => void;
}) {
  const id = useId();
  // The current claim is always selectable, even before the history list has loaded.
  const hasValue = history.some((c) => c.claimId === value);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-body font-medium">
        Which invoice
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full max-w-120 rounded-[10px] border border-control bg-surface px-3 text-section num"
      >
        {!hasValue && value && <option value={value}>{value === currentId ? "Latest invoice" : value}</option>}
        {history.map((c) => (
          <option key={c.claimId} value={c.claimId}>
            {c.documentNumber} · {PLAIN_STATUS[c.status] ?? c.status.toLowerCase()} ·{" "}
            {c.totalClaimableAmountMYR > 0 ? formatMYRShort(c.totalClaimableAmountMYR) : "no grant"} ·{" "}
            {formatDay(c.createdAt)}
          </option>
        ))}
      </select>
    </div>
  );
}

function ActivityRow({ e }: { e: AuditEventRecord }) {
  return (
    <li className="flex flex-col gap-1 border-t border-rule py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-body font-medium">{e.title}</p>
        {e.description && <p className="mt-0.5 wrap-break-word text-body text-muted">{e.description}</p>}
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
        </p>
      </div>
      <div className="flex-none">
        <StatusPill tone={e.eventType === "LOGIN_FAILED" ? "negative" : "neutral"}>
          {e.eventType === "LOGIN_FAILED" ? "Failed sign-in" : (CATEGORY_LABEL[e.category] ?? e.category)}
        </StatusPill>
      </div>
    </li>
  );
}

/** Every recorded action for the organisation, behind a toggle, with a category filter. */
function AllActivity({ log }: { log: OrgAuditLogResponse }) {
  const [category, setCategory] = useState<string>("ALL");
  const filterId = useId();
  const shown = category === "ALL" ? log.events : log.events.filter((e) => e.category === category);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor={filterId} className="mb-1.5 block text-body font-medium">
            Show
          </label>
          <select
            id={filterId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-60 rounded-[10px] border border-control bg-surface px-3 text-section"
          >
            <option value="ALL">Everything</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <span className="text-small text-muted num">
          {shown.length} of {log.totalEvents}
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="text-body text-muted">Nothing here yet.</p>
      ) : (
        <ol>
          {shown.map((e) => (
            <ActivityRow key={e.id} e={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

/** History: each invoice's story in five plain steps, then company changes and sign-ins. */
export function AuditView() {
  const { claim, error, retry, currentOrg, booting, submittedGrants } = useClaim();
  const orgId = currentOrg?.id;
  const allId = useId();
  const [showAll, setShowAll] = useState(false);

  // Saved claims for the picker; refreshed when the org or the current claim changes.
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

  // Organisation activity: integrity check, company changes, sign-ins and the full list.
  const [log, setLog] = useState<OrgAuditLogResponse | null>(null);
  const [logState, setLogState] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    fetchOrgAuditEvents(orgId)
      .then((res) => {
        if (!alive) return;
        setLog(res);
        setLogState("ready");
      })
      .catch(() => alive && setLogState("error"));
    return () => {
      alive = false;
    };
  }, [orgId, claim, submittedGrants.length, reload]);

  // null = follow the current claim. Any other id loads that saved claim from the server.
  // A ?claim=<id> link (e.g. from My claims) preselects that claim.
  const linkedClaim = useSearchParams().get("claim");
  const [picked, setPicked] = useState<{
    orgId?: string;
    claimId: string;
  } | null>(linkedClaim ? { orgId: undefined, claimId: linkedClaim } : null);
  // A linked claim has no org yet; it applies to whichever organisation is signed in.
  const pickedId = picked && (picked.orgId === undefined || picked.orgId === orgId) ? picked.claimId : null;
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

  if (!claim && error) return <BackendError message={error} onRetry={() => void retry()} />;
  if (booting) return <AuditSkeleton />;

  const profileChanges = (log?.events ?? []).filter((e) => e.category === "PROFILE").slice(0, 3);
  const signIns = (log?.events ?? []).filter((e) => SIGN_IN_EVENTS.has(e.eventType));
  const lastSignIn = signIns.find((e) => e.eventType !== "LOGIN_FAILED");
  const failedSignIns = signIns.filter((e) => e.eventType === "LOGIN_FAILED").length;

  return (
    <div className="px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-400 flex-col gap-6">
        <div className="anim-reveal flex flex-wrap items-center justify-between gap-3" style={stagger(0)}>
          <h1 className="text-lead font-semibold tracking-[-0.01em]">History</h1>
          {log &&
            (log.chainValid ? (
              <p className="inline-flex items-center gap-2 rounded-full bg-pill-positive-bg px-3.5 py-2 text-body font-medium text-pill-positive-ink">
                <ShieldCheck size={16} aria-hidden="true" />
                Records verified
              </p>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-full bg-pill-negative-bg px-3.5 py-2 text-body font-medium text-pill-negative-ink">
                <ShieldAlert size={16} aria-hidden="true" />A record was changed after it was saved
              </p>
            ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)]">
          {!claim ? (
            <div className="rounded-[14px] border border-dashed border-control bg-raised/30 p-8 text-center">
              <p className="text-section text-muted">No invoices yet. Upload one on Home to start.</p>
              <Link
                href="/"
                className="mt-3 inline-flex min-h-11 items-center rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-surface hover:opacity-90"
              >
                Go to Home
              </Link>
            </div>
          ) : (
            <div className="anim-reveal flex flex-col gap-4" style={stagger(1)}>
              {orgId && history && history.length > 1 && selectValue && (
                <ClaimPicker
                  history={history}
                  currentId={claim.claimId}
                  value={selectValue}
                  onChange={(claimId) => setPicked({ orgId, claimId })}
                />
              )}
              {claimLoading || !shownClaim ? <AuditClaimBodySkeleton /> : <ClaimStory claim={shownClaim} />}
            </div>
          )}
          {orgId && (
            <div className="flex flex-col gap-6">
              <section
                aria-labelledby="company-changes"
                className="anim-reveal flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-6 py-5"
                style={stagger(2)}
              >
                <h2 id="company-changes" className="text-[17px] font-semibold">
                  Company details
                </h2>
                {!log ? (
                  <SkeletonRegion label="Loading company changes…">
                    <ListRowsSkeleton rows={1} />
                  </SkeletonRegion>
                ) : profileChanges.length === 0 ? (
                  <p className="text-[15px] text-muted">No changes yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {profileChanges.map((e) => (
                      <li key={e.id} className="text-[15px] text-muted">
                        <span className="num">{formatDay(e.createdAt)}</span> — {e.title}
                        {e.actorEmail ? ` (${e.actorEmail})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/data" className="self-start text-body font-medium text-accent hover:underline">
                  Go to My company
                </Link>
              </section>

              <section
                aria-labelledby="sign-ins"
                className="anim-reveal flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-6 py-5"
                style={stagger(3)}
              >
                <h2 id="sign-ins" className="text-[17px] font-semibold">
                  Sign-ins
                </h2>
                {!log ? (
                  <SkeletonRegion label="Loading sign-ins…">
                    <ListRowsSkeleton rows={1} />
                  </SkeletonRegion>
                ) : (
                  <p className="text-[15px] text-muted">
                    {lastSignIn ? (
                      <>
                        Last signed in <span className="num">{formatDateTime(lastSignIn.createdAt)}</span>.
                      </>
                    ) : (
                      "No sign-ins recorded yet."
                    )}
                    {failedSignIns > 0 && (
                      <span className="font-medium text-negative">
                        {" "}
                        {failedSignIns} failed sign-in
                        {failedSignIns === 1 ? "" : "s"} recently.
                      </span>
                    )}
                  </p>
                )}
              </section>
            </div>
          )}
        </div>

        {orgId && (
          <section aria-label="All activity" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-expanded={showAll}
                aria-controls={allId}
                onClick={() => setShowAll((v) => !v)}
                className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[15px] font-medium text-accent hover:bg-active cursor-pointer"
              >
                <ChevronDown
                  size={16}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={`transition-transform ${showAll ? "rotate-180" : ""}`}
                />
                {showAll ? "Hide all activity" : "See all activity"}
              </button>
              {showAll && (
                <button
                  type="button"
                  onClick={() => {
                    setLogState("loading");
                    setReload((n) => n + 1);
                  }}
                  aria-label="Refresh activity"
                  className="grid size-11 place-items-center rounded-md hover:bg-active cursor-pointer"
                >
                  <RefreshCw size={14} className={logState === "loading" ? "animate-spin" : ""} aria-hidden="true" />
                </button>
              )}
            </div>
            {showAll && (
              <div id={allId} className="anim-expand rounded-[14px] border border-line bg-surface p-5">
                {logState === "error" && !log ? (
                  <p className="text-body text-negative">Couldn&apos;t load activity. Try refreshing.</p>
                ) : !log ? (
                  <SkeletonRegion label="Loading activity…">
                    <ListRowsSkeleton rows={6} />
                  </SkeletonRegion>
                ) : (
                  <AllActivity log={log} />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
