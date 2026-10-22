"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, History, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Grant Hub", icon: LayoutDashboard },
  { href: "/data", label: "Connected data", icon: Database },
  { href: "/audit", label: "Audit trail", icon: History },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-[34px] items-center gap-2.5 rounded-lg px-3 text-body ${
              active ? "bg-active font-medium text-ink" : "text-muted hover:bg-active/60 hover:text-ink"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
