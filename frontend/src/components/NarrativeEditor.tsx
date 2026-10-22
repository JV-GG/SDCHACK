"use client";

import { useId } from "react";
import type { LLMNarrative } from "@/types/claim";

interface Props {
  narrative: LLMNarrative;
  original: LLMNarrative;
  onChange: (next: LLMNarrative) => void;
  readOnly?: boolean;
}

const FIELD =
  "mt-1.5 w-full rounded-[var(--radius-control)] border border-control bg-surface p-3 text-[13.5px] leading-relaxed text-ink transition-colors read-only:bg-raised read-only:text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * The model's draft of the application narrative, open to editing. Anything the owner changes is
 * marked so it is clear what the reviewer wrote and what the model did.
 */
export function NarrativeEditor({ narrative, original, onChange, readOnly = false }: Props) {
  const uid = useId();

  const fields: {
    key: keyof LLMNarrative;
    label: string;
    description: string;
    rows?: number;
  }[] = [
    {
      key: "projectTitle",
      label: "Project title",
      description: "Official initiative title submitted to grant evaluation committee",
      rows: 2,
    },
    {
      key: "transformationJustification",
      label: "Operational justification",
      description: "Business impact, compliance mandate, and operational bottleneck resolution",
      rows: 9,
    },
    {
      key: "roiAndProductivityProjections",
      label: "Expected productivity return",
      description: "Projected labor hours saved, error reduction, and financial ROI metrics",
      rows: 8,
    },
  ];

  if (narrative.marketOrExportReadiness !== undefined) {
    fields.push({
      key: "marketOrExportReadiness",
      label: "Market or export readiness",
      description: "Scale-up potential, B2B commercial readiness, and cross-border expansion",
      rows: 7,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 rounded-(--radius-control) bg-accent-soft/40 px-3 py-2 text-small text-ink">
        <span className="font-medium">Drafted by DeepSeek-V3 Grant Copilot</span>
        <span className="text-muted text-[11.5px]">Editable draft · Human sign-off required</span>
      </div>

      {fields.map(({ key, label, description, rows }) => {
        const id = `${uid}-${key}`;
        const value = (narrative[key] as string | undefined) ?? "";
        const changed = value !== ((original[key] as string | undefined) ?? "");

        return (
          <div key={key} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <label htmlFor={id} className="font-semibold text-body text-ink">
                  {label}
                </label>
                <p className="text-[12px] text-muted">{description}</p>
              </div>
              {changed && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                  User Edited
                </span>
              )}
            </div>

            <textarea
              id={id}
              rows={rows ?? 5}
              value={value}
              readOnly={readOnly}
              onChange={(e) => onChange({ ...narrative, [key]: e.target.value })}
              className={`${FIELD} resize-y font-normal`}
              placeholder={`Enter ${label.toLowerCase()}...`}
            />
          </div>
        );
      })}
    </div>
  );
}
