"use client";

import { useState, useRef, useEffect } from "react";
import {
  Menu,
  RefreshCw,
  ChevronDown,
  ArrowLeftRight,
  PlusCircle,
  LogIn,
  Edit3,
} from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";
import { BrandMark } from "@/components/BrandMark";
import { Dialog } from "@/components/Dialog";
import { NavLinks } from "@/components/NavLinks";
import { Skeleton } from "@/components/Skeleton";
import { SidebarUser } from "@/components/SidebarUser";

/** Top bar of the frame: connected company, live backend status, navigation, and account dropdown. */
export function Header() {
  const { company, isConnected, loading, retry, booting, pipeline, openAuthModal } = useClaim();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ssm = company.registrationNumber.split(" ")[0];

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-30 col-start-1 flex h-12 items-center justify-between gap-3 bg-frame px-4 md:col-start-2 md:px-5 border-b border-line">
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
          <div ref={dropdownRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="group flex items-center gap-1.5 rounded-(--radius-control) px-1.5 py-0.5 text-left hover:bg-active/80 cursor-pointer transition-colors max-w-full"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              title="Manage SME Organization (Switch, Register, Sign In)"
            >
              <div className="min-w-0 leading-tight">
                <p className="truncate text-body font-medium text-ink group-hover:text-accent transition-colors">
                  {company.companyName}
                </p>
                <p className="truncate text-small text-muted num">SSM {ssm}</p>
              </div>
              <ChevronDown
                size={14}
                className={`flex-none text-muted transition-transform duration-150 ${dropdownOpen ? "rotate-180 text-ink" : ""}`}
              />
            </button>

            {/* SME Organization Dropdown Menu */}
            {dropdownOpen && (
              <div
                role="menu"
                className="anim-pop absolute left-0 top-full mt-1.5 z-50 w-72 rounded-(--radius-card) border border-line bg-surface p-1.5 shadow-xl"
              >
                <div className="px-3 py-2 border-b border-rule">
                  <p className="text-small font-semibold text-ink truncate">{company.companyName}</p>
                  <p className="text-[11px] text-muted num">SSM {company.registrationNumber}</p>
                </div>
                <div className="py-1 flex flex-col gap-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      openAuthModal("switch");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-small font-medium text-ink hover:bg-active cursor-pointer transition-colors text-left"
                  >
                    <ArrowLeftRight size={14} className="text-accent flex-none" />
                    <span>Switch SME Organization</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      openAuthModal("register");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-small font-medium text-ink hover:bg-active cursor-pointer transition-colors text-left"
                  >
                    <PlusCircle size={14} className="text-positive flex-none" />
                    <span>Register New SME Account</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      openAuthModal("login");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-small font-medium text-ink hover:bg-active cursor-pointer transition-colors text-left"
                  >
                    <LogIn size={14} className="text-accent flex-none" />
                    <span>Sign In to SME Account</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      openAuthModal("edit");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-(--radius-control) px-3 py-2 text-small font-medium text-ink hover:bg-active cursor-pointer transition-colors text-left"
                  >
                    <Edit3 size={14} className="text-muted flex-none" />
                    <span>Edit SSM & Workforce Profile</span>
                  </button>
                </div>
              </div>
            )}
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
        <div className="flex h-12 flex-none items-center justify-between px-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <BrandMark size={20} />
            <p id="menu-title" className="text-body font-semibold">
              SME GrantFlow
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between px-2 py-3 overflow-y-auto">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
          <div className="pt-3 border-t border-rule mt-auto">
            <SidebarUser />
          </div>
        </div>
      </Dialog>
    </header>
  );
}
