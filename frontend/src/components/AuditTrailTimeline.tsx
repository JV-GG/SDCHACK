import type { ClaimsReadinessPackage } from "@/types/claim";
import { formatDateTime } from "@/lib/format";

type AuditEvent = ClaimsReadinessPackage["auditTrail"][number];

/** Chronological record of what happened to the claim, who did it and when (Malaysia time). */
export function AuditTrailTimeline({ events, comfortable = false }: { events: AuditEvent[]; comfortable?: boolean }) {
  if (events.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-control px-4 py-3 text-body text-muted">
        No events recorded for this claim yet.
      </p>
    );
  }
  return (
    <ol className="relative ml-1.5 border-l border-line">
      {events.map((e, i) => (
        <li key={`${e.timestamp}-${i}`} className="relative pb-5 pl-5 last:pb-0">
          <span aria-hidden="true" className="absolute -left-[4.5px] top-1.5 size-2 rounded-full bg-control" />
          <p className={comfortable ? "text-section" : "text-body"}>{e.action}</p>
          <p className={`mt-0.5 text-muted ${comfortable ? "text-body" : "text-small"}`}>
            <time dateTime={e.timestamp} className="num">
              {formatDateTime(e.timestamp)}
            </time>
            <span aria-hidden="true"> · </span>
            <span className="sr-only"> by </span>
            {e.performedBy}
          </p>
        </li>
      ))}
    </ol>
  );
}
