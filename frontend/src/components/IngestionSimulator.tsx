"use client";

import Link from "next/link";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { CATEGORY_LABEL, formatDate, formatMYR } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

const STAGES = [
  "Expense trigger detected in accounting",
  "Pulling SSM BizProfile & Orbyte HR verification data",
  "Executing deterministic grant rules & drafting DeepSeek AI justification",
];

/**
 * Steps 1 and 2 of the journey: choose an expense event, ingest it, and watch the live pipeline run.
 * Evaluated 100% LIVE via the FastAPI backend and DeepSeek / RunPod LLM.
 */
export function IngestionSimulator() {
  const { scenario, scenarios, selectScenario, ingest, pipeline, claim, currentScenario } = useClaim();
  const invoice = currentScenario.invoice;
  const onScreen = claim?.invoice.invoiceNumber ?? invoice.invoiceNumber;

  return (
    <section className="rounded-(--radius-card) border border-line bg-surface p-5" aria-labelledby="ingest-title">
      <h2 id="ingest-title" className="text-section font-semibold">
        Expense trigger & Scenario Ingestion
      </h2>
      <p className="mt-0.5 text-body text-muted">
        Select a real-world Malaysian SME invoice event, then ingest to trigger live grant matching.
      </p>

      <div role="radiogroup" aria-label="Test scenario" className="mt-4 grid gap-2 sm:grid-cols-2">
        {scenarios.map((s, index) => {
          const selected = scenario === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pipeline.running}
              onClick={() => selectScenario(s.id)}
              className={`rounded-(--radius-control) border px-3 py-2.5 text-left disabled:opacity-60 transition-colors ${
                selected ? "border-ink bg-surface shadow-xs" : "border-line bg-raised hover:border-control"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="block font-medium truncate">
                  {s.title.split(":")[0] || `Scenario ${index + 1}`}
                </span>
                {selected && <span className="size-2 rounded-full bg-accent flex-none" />}
              </div>
              <span className="block text-small font-medium text-ink mt-0.5">
                {s.title.split(":")[1]?.trim() || s.title}
              </span>
              <span className="block text-small text-muted mt-1 line-clamp-2">
                {s.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <p className="font-medium">{invoice.vendorName}</p>
            <p className="text-small text-muted num">
              <span className="font-mono">{invoice.invoiceNumber}</span>, dated {formatDate(invoice.invoiceDate)}
            </p>
          </div>
          {invoice.vendorIsMdecTsp ? (
            <StatusPill tone="positive">MDEC TSP accredited</StatusPill>
          ) : (
            <StatusPill tone="neutral">Not an MDEC TSP</StatusPill>
          )}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full sm:min-w-110 border-collapse text-body">
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
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} className="pb-0 pr-3 pt-3 text-right font-medium">
                  Invoice total
                </th>
                <td className="whitespace-nowrap pt-3 text-right font-medium num">{formatMYR(invoice.totalAmountMYR)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void ingest()}
          disabled={pipeline.running}
          className="min-h-9 rounded-(--radius-control) bg-ink px-4 py-1.5 text-left text-body font-medium text-surface hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {pipeline.running ? "Evaluating live with AI…" : `Re-evaluate ${invoice.invoiceNumber}`}
        </button>
        <Link href="/" className="text-body font-medium text-accent underline-offset-2 hover:underline">
          Open Grant Hub
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
