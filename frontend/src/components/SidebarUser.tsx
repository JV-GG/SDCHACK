"use client";

import { useClaim } from "@/lib/ClaimContext";

/** The person who signs off claims for the connected company. */
export function SidebarUser() {
  const { claim, currentScenario } = useClaim();
  const companyName = claim?.company.companyName ?? currentScenario.company.companyName;
  const initial = companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mt-auto flex items-center gap-2.5 px-3">
      <span
        aria-hidden="true"
        className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-small font-semibold text-accent"
      >
        {initial}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-body">Business owner</p>
        <p className="truncate text-small text-muted">Signs off claims</p>
      </div>
    </div>
  );
}
