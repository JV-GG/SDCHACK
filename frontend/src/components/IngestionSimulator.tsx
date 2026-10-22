"use client";

import Link from "next/link";
import { CircleCheck, LoaderCircle, Zap } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatMYR } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

const STAGES = [
  "Expense trigger detected in accounting",
  "Pulling SSM BizProfile & Orbyte HR verification data",
  "Executing deterministic grant rules & drafting DeepSeek AI justification",
];

/**
 * Connected Accounting Ingestion Simulator.
 * Triggers live pipeline evaluation for the demo SME against FastAPI & DeepSeek.
 */
export function IngestionSimulator() {
  const { invoice, reEvaluate, pipeline, claim } = useClaim();
  const onScreen = claim?.invoice.invoiceNumber ?? invoice.invoiceNumber;

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5" aria-labelledby="ingest-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="ingest-title" className="text-section font-semibold">
            Connected Accounting Ingestion
          </h2>
          <p className="mt-0.5 text-body text-muted">
            Incoming expenditure detected from connected cloud accounting & e-Invoicing feeds.
          </p>
        </div>
        {invoice.vendorIsMdecTsp ? (
          <StatusPill tone="positive">MDEC TSP Accredited</StatusPill>
        ) : (
          <StatusPill tone="neutral">Unregistered Vendor</StatusPill>
        )}
      </div>

      <div className="mt-4 rounded-[var(--radius-control)] bg-raised p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-semibold text-ink text-body">{invoice.vendorName}</p>
            <p className="text-small text-muted num">
              Tax Invoice <span className="font-mono">{invoice.invoiceNumber}</span> · Dated {formatDate(invoice.invoiceDate)}
            </p>
          </div>
          <div className="text-right">
            <span className="text-small text-muted block">Total Incurred</span>
            <span className="font-semibold text-section text-ink num">{formatMYR(invoice.totalAmountMYR)}</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full sm:min-w-[440px] border-collapse text-body">
            <thead>
              <tr className="border-b border-line text-left text-small text-muted">
                <th scope="col" className="py-2 pr-3 font-normal">
                  Line item
                </th>
                <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">
                  Mapped to
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">
                  Qty
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-b border-rule align-top">
                  <td className="py-2.5 pr-3">{item.description}</td>
                  <td className="hidden whitespace-nowrap py-2.5 pr-3 text-muted sm:table-cell">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </td>
                  <td className="py-2.5 pr-3 text-right num">{item.quantity}</td>
                  <td className="whitespace-nowrap py-2.5 text-right num">{formatMYR(item.totalPriceMYR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void reEvaluate()}
          disabled={pipeline.running}
          className="min-h-9 flex items-center gap-2 rounded-[var(--radius-control)] bg-ink px-4 py-1.5 text-left text-body font-medium text-surface hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {pipeline.running ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Zap size={16} />
          )}
          <span>{pipeline.running ? "Evaluating live with AI…" : `Re-run Ingestion & Rules Engine`}</span>
        </button>
        <Link href="/" className="text-body font-medium text-accent underline-offset-2 hover:underline">
          View Grant Hub
        </Link>
        <p className="text-small text-muted">
          Active evaluated claim: <span className="font-mono">{onScreen}</span>
        </p>
      </div>

      <ol className="mt-5 flex flex-col gap-2" aria-label="Pipeline progress" aria-live="polite">
        {STAGES.map((label, i) => {
          const done = !pipeline.running || i < pipeline.step;
          const active = pipeline.running && i === pipeline.step;
          return (
            <li key={label} className={`flex items-center gap-2.5 ${done || active ? "" : "text-muted"}`}>
              {active ? (
                <LoaderCircle size={16} strokeWidth={1.75} className="flex-none animate-spin text-accent" aria-hidden="true" />
              ) : done ? (
                <CircleCheck size={16} strokeWidth={1.75} className="flex-none text-positive" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="ml-1 size-2 flex-none rounded-full bg-control" />
              )}
              <span>{label}</span>
              <span className="sr-only">{active ? " (in progress)" : done ? " (done)" : " (waiting)"}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
