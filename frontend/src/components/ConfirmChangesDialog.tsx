"use client";

import { useId } from "react";
import { ArrowRight, LoaderCircle, TriangleAlert } from "lucide-react";
import type { ProfileImpactResponse } from "@/types/claim";
import { formatMYR } from "@/lib/format";
import { Dialog } from "@/components/Dialog";

export interface FieldChange {
  key: string;
  label: string;
  before: string;
  after: string;
  /** A jump big enough to be a likely typo (e.g. 8 → 80 employees); shown with a prompt to double-check. */
  large: boolean;
}

interface Props {
  open: boolean;
  sectionTitle: string;
  changes: FieldChange[];
  impact: ProfileImpactResponse | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Last check before a profile edit is applied: every changed field as old → new, the effect on programme
 * eligibility, and an explicit Confirm. Nothing is saved until the user confirms.
 */
export function ConfirmChangesDialog({ open, sectionTitle, changes, impact, saving, onCancel, onConfirm }: Props) {
  const titleId = useId();
  const gained = impact?.changes.filter((c) => c.after) ?? [];
  const lost = impact?.changes.filter((c) => !c.after) ?? [];
  const suspicious = changes.filter((c) => c.large);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onCancel();
      }}
      labelledBy={titleId}
      className="w-[min(520px,calc(100vw-32px))]!"
    >
      <div className="px-6 pt-5">
        <h2 id={titleId} className="text-title font-semibold">
          Confirm changes
        </h2>
        <p className="mt-0.5 text-body text-muted">
          {sectionTitle}: check each value before it is applied. This updates eligibility for all programmes and is
          recorded in the audit trail.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
        <ul className="divide-y divide-rule rounded-(--radius-card) border border-line">
          {changes.map((c) => (
            <li key={c.key} className="px-4 py-3">
              <p className="text-small text-muted">{c.label}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-body num">
                <span className="text-muted line-through decoration-1">{c.before}</span>
                <ArrowRight size={14} className="flex-none text-muted" aria-hidden="true" />
                <span className="sr-only">changed to</span>
                <span className="font-semibold">{c.after}</span>
              </p>
              {c.large && (
                <p className="mt-1 flex items-center gap-1.5 text-small text-warning">
                  <TriangleAlert size={12} aria-hidden="true" />
                  Large change. Double-check this was not a typo.
                </p>
              )}
            </li>
          ))}
        </ul>

        {impact && (
          <div className="mt-4 rounded-(--radius-control) bg-raised px-4 py-3" aria-live="polite">
            <p className="text-body font-semibold">
              Pre-qualifies for {impact.eligibleAfter} of 7 programmes
              {impact.eligibleAfter !== impact.eligibleBefore && ` (currently ${impact.eligibleBefore})`}
            </p>
            {gained.map((g) => (
              <p key={g.grantId} className="mt-1 text-small text-positive">
                + Will qualify: {g.grantName} (up to {formatMYR(g.maxCoFundingMYR)})
              </p>
            ))}
            {lost.map((g) => (
              <p key={g.grantId} className="mt-1 text-small text-negative">
                − Will no longer qualify: {g.grantName}
              </p>
            ))}
            {impact.changes.length === 0 && (
              <p className="mt-0.5 text-small text-muted">No change to which programmes you qualify for.</p>
            )}
          </div>
        )}
        {suspicious.length > 0 && lost.length > 0 && (
          <p role="alert" className="mt-3 text-small text-warning">
            This change removes eligibility and includes a large jump in a value. Make sure the numbers are right.
          </p>
        )}
      </div>

      {/* Go back comes first in the DOM so it takes initial focus: pressing Enter right away cannot confirm. */}
      <div className="flex flex-none items-center justify-end gap-2 border-t border-line bg-raised px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-(--radius-control) border border-control bg-surface px-4 text-body font-medium hover:bg-active cursor-pointer disabled:opacity-60"
        >
          Go back and edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) bg-ink px-4 text-body font-medium text-surface hover:opacity-90 cursor-pointer disabled:opacity-70"
        >
          {saving && <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Confirm and save"}
        </button>
      </div>
    </Dialog>
  );
}
