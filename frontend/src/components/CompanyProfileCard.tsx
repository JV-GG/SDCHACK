import type { SMEProfile } from "@/types/claim";
import { formatDate, formatMYR } from "@/lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right num">{value}</dd>
    </div>
  );
}

function Group({ title, source, children }: { title: string; source: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-section font-semibold">{title}</h3>
        <p className="text-small text-muted">{source}</p>
      </div>
      <dl className="mt-2 divide-y divide-rule">{children}</dl>
    </section>
  );
}

/** What the connected systems report about the company. Read-only: the data is pulled, never typed. */
export function CompanyProfileCard({ company }: { company: SMEProfile }) {
  const sector = company.sector === "SERVICES" ? "Services" : "Manufacturing";
  const sizeCap = company.sector === "SERVICES" ? 75 : 200;
  return (
    <div className="flex flex-col gap-4">
      <Group title="SSM BizProfile" source="Linked to SSM e-Info">
        <Row label="Registration no." value={company.registrationNumber} />
        <Row label="Incorporated" value={formatDate(company.incorporationDate)} />
        <Row label="Operating tenure" value={`${company.tenureMonths} months`} />
        <Row label="Malaysian equity" value={`${company.malaysianEquityPercentage.toFixed(1)}%`} />
        <Row label="Sector" value={sector} />
        <Row label="GLC or MNC owned" value={company.isGlcOrMncOwned ? "Yes" : "No"} />
      </Group>
      <Group title="Orbyte HR" source="Linked to Orbyte HR">
        <Row label="Full-time employees" value={String(company.fullTimeEmployees)} />
        <Row label={`${sector} size cap`} value={`${company.fullTimeEmployees} of ${sizeCap} FTEs`} />
      </Group>
      <Group title="Accounting" source="Linked to the accounting ledger">
        <Row label="Annual sales turnover" value={formatMYR(company.annualTurnoverMYR)} />
        <Row label="Active exporter" value={company.isActiveExporter ? "Yes" : "No"} />
      </Group>
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
