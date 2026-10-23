import { BrandMark } from "@/components/BrandMark";
import { NavLinks } from "@/components/NavLinks";
import { SidebarUser } from "@/components/SidebarUser";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-(--sidebar-width) flex-none flex-col gap-6 px-3 py-4 md:flex row-span-2">
      <div className="flex items-center gap-2.5 px-3">
        <BrandMark />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-body font-semibold">SME Grant Copilot</p>
        </div>
      </div>
      <NavLinks />
      <SidebarUser />
    </aside>
  );
}
