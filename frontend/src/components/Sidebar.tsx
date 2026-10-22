import { BrandMark } from "@/components/BrandMark";
import { NavLinks } from "@/components/NavLinks";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--sidebar-width)] flex-none flex-col gap-6 px-3 py-4 md:flex row-span-2">
      <div className="flex items-center gap-2.5 px-3">
        <BrandMark />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-body font-semibold">SME Grant Copilot</p>
          <p className="truncate text-small text-muted">Claim engine</p>
        </div>
      </div>
      <NavLinks />
      <div className="mt-auto flex items-center gap-2.5 px-3">
        <span
          aria-hidden="true"
          className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-small font-semibold text-accent"
        >
          N
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-body">Business owner</p>
          <p className="truncate text-small text-muted">Signs off claims</p>
        </div>
      </div>
    </aside>
  );
}
