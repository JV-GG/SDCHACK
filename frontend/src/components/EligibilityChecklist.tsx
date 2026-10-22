import { CircleCheck, TriangleAlert } from "lucide-react";
import type { RuleCheckResult } from "@/types/claim";

/**
 * The deterministic rules engine's verdict, one row per rule: what the rule asks, what the data
 * says, and the engine's note. Failed rules are marked with a warning, passed ones with a tick.
 */
export function EligibilityChecklist({ checks }: { checks: RuleCheckResult[] }) {
  return (
    <ul className="flex flex-col">
      {checks.map((check) => (
        <li key={check.ruleName} className="flex gap-3 border-t border-rule py-3 first:border-t-0 first:pt-0 last:pb-0">
          {check.passed ? (
            <CircleCheck size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-positive" aria-hidden="true" />
          ) : (
            <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 flex-none text-negative" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {check.ruleName}
              <span className="sr-only">{check.passed ? ": passed" : ": not met"}</span>
            </p>
            <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-body">
              <dt className="text-muted">Requires</dt>
              <dd className="num">{check.requirement}</dd>
              <dt className="text-muted">Found</dt>
              <dd className={`num ${check.passed ? "" : "font-medium text-negative"}`}>{check.actual}</dd>
            </dl>
            {check.reason && <p className="mt-1 text-small text-muted">{check.reason}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
