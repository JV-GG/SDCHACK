"use client";

import { useState } from "react";
import { Menu, RefreshCw } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { BrandMark } from "@/components/BrandMark";
import { Dialog } from "@/components/Dialog";
import { NavLinks } from "@/components/NavLinks";

/** Top bar of the frame: connected company, live backend status, and navigation. */
export function Header() {
  const { claim, currentScenario, isConnected, loading, retry } = useClaim();
  const [menuOpen, setMenuOpen] = useState(false);

  const company = claim?.company ?? currentScenario.company;
  const ssm = company.registrationNumber.split(" ")[0];

  return (
    <header className="sticky top-0 z-10 col-start-1 flex h-12 items-center justify-between gap-3 bg-frame px-4 md:col-start-2 md:px-5 border-b border-line">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
          className="grid size-8 flex-none place-items-center rounded-md text-ink hover:bg-active md:hidden"
        >
          <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 md:hidden">
          <BrandMark size={20} />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-body font-medium">{company.companyName}</p>
          <p className="truncate text-small text-muted num">SSM {ssm}</p>
        </div>
        <span className="hidden flex-none items-center gap-1.5 rounded-full bg-pill-positive-bg px-2.5 text-small font-medium text-pill-positive-ink lg:inline-flex lg:h-6">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" />
          SSM & Orbyte HR Linked
        </span>
        <p className="hidden truncate text-small text-muted xl:block">
          Track 9: Autonomous SME Grant Copilot & Claim Engine
        </p>
      </div>

      <div className="flex flex-none items-center gap-3">
        {isConnected ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-small font-medium text-emerald-700 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Live Engine (FastAPI + DeepSeek)</span>
          </div>
        ) : (
          <button
            onClick={() => void retry()}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-small font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-400"
          >
            <span className="size-2 rounded-full bg-rose-500" />
            <span>Backend Offline</span>
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="menu-title"
        className="m-0! h-dvh! max-h-none! w-[min(300px,85vw)]! rounded-none!"
      >
        <div className="flex h-12 flex-none items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <p id="menu-title" className="text-body font-semibold">
              SME Grant Copilot
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
