import type { ClaimsReadinessPackage } from "@/types/claim";
import { eligibleGrants, coFunding } from "@/lib/ClaimContext";
import { formatDateTime, formatMYR, STATUS_LABEL } from "@/lib/format";

function Cell({
  label,
  value,
  caption,
  lead = false,
  className = "",
}: {
  label: string;
  value: string;
  caption: string;
  lead?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-surface p-4 ${className}`}>
      <p className="text-body text-muted">{label}</p>
      <p className={`mt-1 font-normal num ${lead ? "text-lead" : "text-title"}`}>{value}</p>
      <p className="mt-1 text-small text-muted">{caption}</p>
    </div>
  );
}

/** The claim in five figures. One container, split by 1px dividers; the claimable amount leads. */
export function DashboardStats({ claim }: { claim: ClaimsReadinessPackage }) {
  const eligible = eligibleGrants(claim);
  const total = claim.evaluations.length;
  const lead = eligible[0];
  const last = claim.auditTrail[claim.auditTrail.length - 1];

  let claimableCaption = "No grant matched this invoice";
  if (lead) {
    const m = coFunding(claim, lead);
    claimableCaption = `${lead.matchingPercentage}% of ${formatMYR(claim.invoice.totalAmountMYR)}${
      m.capped ? `, held to the ${formatMYR(lead.maxCoFundingMYR)} cap` : ""
    }`;
  }

  const statusCaption =
    claim.status === "EVALUATED"
      ? "Waiting for owner sign-off"
      : claim.status === "APPROVED"
        ? "Signed off, packet ready"
        : "Packet exported for submission";

  return (
    <section aria-label="Claim summary">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <Cell
          lead
          className="col-span-2 lg:col-span-1"
          label="Claimable co-funding"
          value={formatMYR(claim.totalClaimableAmountMYR)}
          caption={claimableCaption}
        />
        <Cell
          label="Grants matched"
          value={`${eligible.length} of ${total}`}
          caption={`${total - eligible.length} criteria not met`}
        />
        <Cell label="Claim status" value={STATUS_LABEL[claim.status]} caption={statusCaption} />
        <Cell label="Connected sources" value="3 of 3" caption="SSM, Orbyte HR, accounting" />
        <Cell
          label="Audit events"
          value={String(claim.auditTrail.length)}
          caption={`Latest ${formatDateTime(last.timestamp)}`}
        />
      </div>
    </section>
  );
}
