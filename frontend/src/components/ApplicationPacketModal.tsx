"use client";

import { CircleCheck, Circle, Printer, X } from "lucide-react";
import type { GrantEvaluation } from "@/types/claim";
import { coFunding, useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatDateTime, formatMYR } from "@/lib/format";
import { Dialog } from "@/components/Dialog";

const AGENCY_FULL: Record<GrantEvaluation["agency"], string> = {
  MDEC: "Malaysia Digital Economy Corporation (MDEC), with Bank Simpanan Nasional",
  "SME Corp": "SME Corporation Malaysia",
  MATRADE: "Malaysia External Trade Development Corporation (MATRADE)",
};

/** Which documents the connected systems can vouch for, and which still need the owner. */
function documentStatus(name: string): { ready: boolean; note: string } {
  const n = name.toLowerCase();
  if (n.includes("ssm")) return { ready: true, note: "Verified from SSM" };
  if (n.includes("invoice") || n.includes("quotation")) return { ready: true, note: "Attached from accounting" };
  if (n.includes("justification")) return { ready: true, note: "Included in this packet" };
  if (n.includes("bank")) return { ready: false, note: "Owner attaches before submitting" };
  if (n.includes("declaration")) return { ready: false, note: "Owner signs before submitting" };
  return { ready: false, note: "Owner attaches before submitting" };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h3 className="text-section font-semibold">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Step 5: the submission-ready packet. Print styles hide everything except this document. */
export function ApplicationPacketModal({
  open,
  onClose,
  grant,
}: {
  open: boolean;
  onClose: () => void;
  grant: GrantEvaluation | undefined;
}) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="packet-title">
      {grant && <PacketBody grant={grant} onClose={onClose} />}
    </Dialog>
  );
}

function PacketBody({ grant, onClose }: { grant: GrantEvaluation; onClose: () => void }) {
  const { claim, markSubmitted } = useClaim();
  const narrative = claim.narratives.find((n) => n.grantId === grant.grantId);
  const money = coFunding(claim, grant);
  const signoff = [...claim.auditTrail].reverse().find((e) => /approved and signed off/i.test(e.action));
  const co = claim.company;

  return (
    <>
      <div className="no-print flex flex-none items-center justify-between gap-3 border-b border-line px-6 py-3">
        <p className="text-body text-muted">Application packet, ready to submit</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close packet"
          className="grid size-8 place-items-center rounded-md hover:bg-active"
        >
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-raised p-4 sm:p-6">
        <article className="print-area mx-auto max-w-[760px] bg-surface p-6 sm:p-10">
          <header className="flex flex-wrap items-start justify-between gap-4 pb-4">
            <div className="min-w-0">
              <p className="text-small text-muted">{AGENCY_FULL[grant.agency]}</p>
              <h2 id="packet-title" className="mt-1 text-title font-semibold">
                Application for {grant.grantName}
              </h2>
            </div>
            <dl className="text-small">
              <div className="flex gap-2">
                <dt className="text-muted">Claim reference</dt>
                <dd className="font-mono">{claim.claimId}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted">Prepared</dt>
                <dd className="num">{formatDateTime(signoff?.timestamp ?? claim.timestamp)}</dd>
              </div>
            </dl>
          </header>

          <Section title="Applicant">
            <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {[
                ["Company", co.companyName],
                ["Registration no. (SSM)", co.registrationNumber],
                ["Incorporated", formatDate(co.incorporationDate)],
                ["Operating tenure", `${co.tenureMonths} months`],
                ["Malaysian equity", `${co.malaysianEquityPercentage.toFixed(1)}%`],
                ["Full-time employees", String(co.fullTimeEmployees)],
                ["Annual sales turnover", formatMYR(co.annualTurnoverMYR)],
                ["Sector", co.sector === "SERVICES" ? "Services" : "Manufacturing"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-rule py-1.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right num">{v}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Expenditure">
            <p className="mb-2 text-body">
              Tax invoice <span className="font-mono">{claim.invoice.invoiceNumber}</span> from {claim.invoice.vendorName},
              dated {formatDate(claim.invoice.invoiceDate)}.
            </p>
            <table className="w-full border-collapse text-body">
              <thead>
                <tr className="border-b border-line text-left text-small text-muted">
                  <th scope="col" className="py-1.5 pr-3 font-normal">
                    Line item
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-normal">
                    Category
                  </th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-normal">
                    Qty
                  </th>
                  <th scope="col" className="py-1.5 text-right font-normal">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {claim.invoice.items.map((i) => (
                  <tr key={i.id} className="border-b border-rule align-top">
                    <td className="py-2 pr-3">{i.description}</td>
                    <td className="py-2 pr-3 text-muted">{CATEGORY_LABEL[i.category]}</td>
                    <td className="py-2 pr-3 text-right num">{i.quantity}</td>
                    <td className="whitespace-nowrap py-2 text-right num">{formatMYR(i.totalPriceMYR)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3} className="pr-3 pt-2 text-right font-normal text-muted">
                    Invoice total
                  </th>
                  <td className="pt-2 text-right num">{formatMYR(claim.invoice.totalAmountMYR)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3} className="pr-3 text-right font-normal text-muted">
                    {grant.matchingPercentage}% matching{money.capped ? ", held to the grant cap" : ""}
                  </th>
                  <td className="text-right num">{formatMYR(money.matched)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3} className="pr-3 pt-1 text-right">
                    Co-funding requested
                  </th>
                  <td className="pt-1 text-right font-semibold num">{formatMYR(money.claimable)}</td>
                </tr>
              </tfoot>
            </table>
          </Section>

          <Section title="Eligibility declaration">
            <ul className="flex flex-col">
              {grant.checks.map((c) => (
                <li key={c.ruleName} className="flex items-start gap-2.5 border-b border-rule py-2 last:border-b-0">
                  <CircleCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-positive" aria-hidden="true" />
                  <p>
                    <span className="font-medium">{c.ruleName}.</span> <span className="text-muted">{c.requirement}.</span>{" "}
                    <span className="num">{c.actual}.</span>
                    <span className="sr-only"> Passed</span>
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          {narrative && (
            <Section title="Project justification">
              <p className="font-medium">{narrative.projectTitle}</p>
              <p className="mt-2 whitespace-pre-line leading-5">{narrative.transformationJustification}</p>
              <p className="mt-3 font-medium">Expected productivity return</p>
              <p className="mt-1 whitespace-pre-line leading-5">{narrative.roiAndProductivityProjections}</p>
              {narrative.marketOrExportReadiness && (
                <>
                  <p className="mt-3 font-medium">Export readiness</p>
                  <p className="mt-1 whitespace-pre-line leading-5">{narrative.marketOrExportReadiness}</p>
                </>
              )}
            </Section>
          )}

          <Section title="Supporting documents">
            <ul className="flex flex-col">
              <li className="flex items-start gap-2.5 border-b border-rule py-2">
                <CircleCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-positive" aria-hidden="true" />
                <p>
                  Orbyte HR headcount summary, {co.fullTimeEmployees} full-time employees{" "}
                  <span className="text-muted">Verified from Orbyte HR</span>
                </p>
              </li>
              {grant.requiredDocuments.map((doc) => {
                const s = documentStatus(doc);
                return (
                  <li key={doc} className="flex items-start gap-2.5 border-b border-rule py-2 last:border-b-0">
                    {s.ready ? (
                      <CircleCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-positive" aria-hidden="true" />
                    ) : (
                      <Circle size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-muted" aria-hidden="true" />
                    )}
                    <p>
                      {doc} <span className="text-muted">{s.note}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Sign-off">
            <p>
              Approved by the business owner of {co.companyName}
              {signoff ? (
                <>
                  {" "}
                  on <span className="num">{formatDateTime(signoff.timestamp)}</span>
                </>
              ) : null}
              . Every action on this claim is recorded in the audit trail, which is attached.
            </p>
          </Section>
        </article>
      </div>

      <div className="no-print flex flex-none flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-6 py-4">
        <p className="text-small text-muted" role="status">
          {claim.status === "SUBMITTED" ? "Exported for submission. The audit trail has the record." : "Review, then print or save as PDF."}
        </p>
        <div className="flex items-center gap-2">
          {claim.status === "APPROVED" && (
            <button
              type="button"
              onClick={markSubmitted}
              className="h-9 rounded-[var(--radius-control)] border border-control px-3 text-body font-medium hover:bg-active"
            >
              Mark as submitted to {grant.agency}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 text-body font-medium text-surface hover:opacity-90"
          >
            <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
            Print or export application PDF
          </button>
        </div>
      </div>
    </>
  );
}
