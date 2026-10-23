"use client";

import { ChevronUp } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { Skeleton } from "@/components/Skeleton";

/** Connected SME Organization account switcher & SSM profile trigger in the sidebar. */
export function SidebarUser() {
  const { company, openAuthModal, booting } = useClaim();
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
          {booting ? (
            <>
              <Skeleton className="size-7 flex-none rounded-full" />
              <div className="min-w-0 flex-1" role="status" aria-label="Loading organisation">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-small font-semibold text-accent"
              >
                {initial}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-body font-medium text-ink">{company.companyName}</p>
                <p className="truncate text-small text-muted num">SSM {company.registrationNumber}</p>
              </div>
            </>
          )}
        </div>
        <ChevronUp size={15} className="flex-none text-muted" />
      </button>
    </div>
  );
}
