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
  "mt-1.5 w-full rounded-[var(--radius-control)] border border-control bg-surface px-3 py-2 text-body read-only:bg-raised read-only:text-ink";

/**
 * The model's draft of the application narrative, open to editing. Anything the owner changes is
 * marked so it is clear what the reviewer wrote and what the model did.
 */
export function NarrativeEditor({ narrative, original, onChange, readOnly = false }: Props) {
  const uid = useId();

  const fields: {
    key: keyof LLMNarrative;
    label: string;
    rows?: number;
  }[] = [
    { key: "projectTitle", label: "Project title" },
    { key: "transformationJustification", label: "Operational justification", rows: 6 },
    { key: "roiAndProductivityProjections", label: "Expected productivity return", rows: 5 },
  ];
  if (narrative.marketOrExportReadiness !== undefined) {
    fields.push({ key: "marketOrExportReadiness", label: "Market or export readiness", rows: 4 });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-muted">Drafted by Gemini Flash Grant Engine. Human review required.</p>
      {fields.map(({ key, label, rows }) => {
        const id = `${uid}-${key}`;
        const value = (narrative[key] as string | undefined) ?? "";
        const changed = value !== ((original[key] as string | undefined) ?? "");
        return (
          <div key={key}>
            <div className="flex items-baseline justify-between">
              <label htmlFor={id} className="font-medium">
                {label}
              </label>
              {changed && <span className="text-small text-muted">Edited</span>}
            </div>
            {rows ? (
              <textarea
                id={id}
                rows={rows}
                value={value}
                readOnly={readOnly}
                onChange={(e) => onChange({ ...narrative, [key]: e.target.value })}
                className={`${FIELD} resize-y leading-5`}
              />
            ) : (
              <input
                id={id}
                type="text"
                value={value}
                readOnly={readOnly}
                onChange={(e) => onChange({ ...narrative, [key]: e.target.value })}
                className={`${FIELD} h-9`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
