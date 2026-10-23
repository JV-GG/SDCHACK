"use client";

import { useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { BrandMark } from "@/components/BrandMark";
import { Dialog } from "@/components/Dialog";
import { NavLinks } from "@/components/NavLinks";
import { Skeleton } from "@/components/Skeleton";

/** Top bar of the frame: connected company, live backend status, and navigation. */
export function Header() {
  const { company, isConnected, loading, retry, booting, pipeline } = useClaim();
  const [menuOpen, setMenuOpen] = useState(false);

  const ssm = company.registrationNumber.split(" ")[0];

  return (
    <header className="sticky top-0 z-10 col-start-1 flex h-12 items-center justify-between gap-3 bg-frame px-4 md:col-start-2 md:px-5 border-b border-line">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          className="grid size-8 flex-none place-items-center rounded-md text-ink hover:bg-active md:hidden cursor-pointer"
        >
          <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 md:hidden">
          <BrandMark size={20} />
        </div>
        {booting ? (
          // Not the demo company's name: wait for the real organisation, keeping the same two-line height.
          <div className="min-w-0" role="status" aria-label="Loading organisation">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-44" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ) : (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-body font-medium">{company.companyName}</p>
            <p className="truncate text-small text-muted num">SSM {ssm}</p>
          </div>
        )}
      </div>

      {!isConnected && (
        <div className="flex flex-none items-center gap-3">
          <button
            onClick={() => void retry()}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-small font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-400 cursor-pointer"
          >
            <span className="size-2 rounded-full bg-rose-500" />
            <span>Backend Offline</span>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      )}

      {/* Thin progress line on the bar's lower edge while the app is fetching or re-evaluating. */}
      <div aria-hidden="true" className="progress-bar" data-active={loading || pipeline.running} />

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="menu-title"
        variant="drawer"
        className="m-0! h-dvh! max-h-none! w-[min(300px,85vw)]! rounded-none!"
      >
        <div className="flex h-12 flex-none items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <p id="menu-title" className="text-body font-semibold">
              SME GrantFlow
            </p>
          </div>
        </div>
        <div className="px-2 py-3">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </div>
      </Dialog>
    </header>
  );
}
