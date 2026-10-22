"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import type { Mode } from "@/lib/ClaimContext";
import { BrandMark } from "@/components/BrandMark";
import { Dialog } from "@/components/Dialog";
import { NavLinks } from "@/components/NavLinks";

const MODES: { id: Mode; label: string; short: string }[] = [
  { id: "live", label: "Live backend API", short: "Live" },
  { id: "mock", label: "Mock demonstration mode", short: "Mock" },
];

function ModeToggle() {
  const { mode, setMode } = useClaim();
  return (
    <div role="group" aria-label="Data source" className="flex h-8 flex-none rounded-full bg-active p-0.5">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          aria-pressed={mode === m.id}
          onClick={() => setMode(m.id)}
          className={`rounded-full px-3 text-small font-medium ${
            mode === m.id ? "bg-surface text-ink" : "text-muted hover:text-ink"
          }`}
        >
          <span className="sm:hidden">{m.short}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Top bar of the frame: the connected company, the data-link status and the Live/Mock switch. */
export function Header() {
  const { claim, notice, source, mode } = useClaim();
  const [menuOpen, setMenuOpen] = useState(false);
  const ssm = claim.company.registrationNumber.split(" ")[0];

  return (
    <header className="sticky top-0 z-10 col-start-1 flex h-12 items-center justify-between gap-3 bg-frame px-4 md:col-start-2 md:px-5">
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
          <p className="truncate text-body font-medium">{claim.company.companyName}</p>
          <p className="truncate text-small text-muted num">SSM {ssm}</p>
        </div>
        <span className="hidden flex-none items-center gap-1.5 rounded-full bg-pill-positive-bg px-2.5 text-small font-medium text-pill-positive-ink lg:inline-flex lg:h-6">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-positive" />
          SSM and Orbyte HR linked
        </span>
        <p className="hidden truncate text-small text-muted xl:block">
          Track 9: low awareness and cumbersome grant applications
        </p>
      </div>

      <div className="flex flex-none items-center gap-3">
        {mode === "live" && (
          <span className="hidden text-small text-muted lg:inline" role="status">
            {source === "live" ? "Connected to backend" : (notice ?? "Backend unreachable. Showing mock data.")}
          </span>
        )}
        <ModeToggle />
      </div>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy="menu-title"
        className="!m-0 !h-dvh !max-h-none !w-[min(300px,85vw)] !rounded-none"
      >
        <div className="flex h-12 flex-none items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <p id="menu-title" className="text-body font-semibold">
              SME Grant Copilot
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-md hover:bg-active"
          >
            <X size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="px-3 py-2">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </div>
      </Dialog>
    </header>
  );
}
