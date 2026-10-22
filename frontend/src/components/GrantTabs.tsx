"use client";

import { useId } from "react";
import type { GrantEvaluation } from "@/types/claim";

/**
 * Underline tabs that switch between the eligible grants of one claim. Renders nothing when there is
 * only one grant, so a single-grant claim keeps a plain header.
 */
export function GrantTabs({
  grants,
  selected,
  onSelect,
  label,
}: {
  grants: GrantEvaluation[];
  selected: string;
  onSelect: (grantId: string) => void;
  label: string;
}) {
  const uid = useId();
  if (grants.length < 2) return null;
  return (
    <div role="tablist" aria-label={label} className="flex gap-4 overflow-x-auto border-b border-line px-6">
      {grants.map((g) => {
        const active = g.grantId === selected;
        return (
          <button
            key={g.grantId}
            id={`${uid}-${g.grantId}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(g.grantId)}
            className={`-mb-px h-10 flex-none border-b-2 px-0.5 text-body cursor-pointer ${
              active ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {g.agency}
          </button>
        );
      })}
    </div>
  );
}
