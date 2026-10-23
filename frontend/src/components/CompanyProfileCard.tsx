import type { SMEProfile } from "@/types/claim";
import { formatMYR } from "@/lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right num">{value}</dd>
    </div>
  );
}

/** Four facts that decide most grants, for the rail of the Grant Hub. */
export function CompanySnapshot({ company }: { company: SMEProfile }) {
  return (
    <dl className="rounded-[var(--radius-card)] bg-raised px-4 py-1 text-body">
      <Row label="Malaysian equity" value={`${company.malaysianEquityPercentage.toFixed(1)}%`} />
      <Row label="Operating tenure" value={`${company.tenureMonths} months`} />
      <Row label="Full-time employees" value={String(company.fullTimeEmployees)} />
      <Row label="Annual turnover" value={formatMYR(company.annualTurnoverMYR)} />
    </dl>
  );
}
