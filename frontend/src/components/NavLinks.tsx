"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, FileCheck, History, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useClaim } from "@/lib/ClaimContext";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/submitted", label: "My claims", icon: FileCheck },
  { href: "/data", label: "My company", icon: Database },
  { href: "/audit", label: "History", icon: History },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { submittedGrants } = useClaim();

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const count = href === "/submitted" ? submittedGrants.length : 0;

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-[34px] items-center gap-2.5 rounded-lg px-3 text-body transition-colors ${
              active ? "bg-active font-medium text-ink" : "text-muted hover:bg-active/60 hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
            {count > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-pill-positive-bg px-1.5 text-xs font-semibold text-positive num">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
