"use client";

import { Building2, ChevronUp } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";

/** Connected SME Organization account switcher & SSM profile trigger in the sidebar. */
export function SidebarUser() {
  const { company, currentOrg, openAuthModal } = useClaim();
  const initial = company.companyName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-rule pt-3">
      <button
        type="button"
        onClick={() => openAuthModal("switch")}
        className="flex w-full items-center justify-between gap-2.5 rounded-(--radius-control) px-2.5 py-2 text-left hover:bg-active cursor-pointer transition-colors"
        title="Switch SME organization, sign in/up, or edit SSM profile"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden="true"
            className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-small font-semibold text-accent"
          >
            {initial}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-body font-medium text-ink">{company.companyName}</p>
            <p className="truncate text-small text-muted num">
              SSM {company.registrationNumber}
            </p>
          </div>
        </div>
        <ChevronUp size={15} className="flex-none text-muted" />
      </button>
      <div className="flex items-center justify-between px-2.5 text-[11px] text-muted">
        <button
          type="button"
          onClick={() => openAuthModal("register")}
          className="font-medium text-accent hover:underline cursor-pointer"
        >
          Sign Up / Edit
        </button>
      </div>
    </div>
  );
}
