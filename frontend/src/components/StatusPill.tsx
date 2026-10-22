import type { ReactNode } from "react";

type Tone = "positive" | "negative" | "warning" | "neutral";

const TONES: Record<Tone, string> = {
  positive: "bg-pill-positive-bg text-pill-positive-ink",
  negative: "bg-pill-negative-bg text-pill-negative-ink",
  warning: "bg-pill-warning-bg text-pill-warning-ink",
  neutral: "bg-pill-neutral-bg text-pill-neutral-ink",
};

/** A status mark that sits beside a value or inside a row. Pale tint, dark text of the same hue. */
export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 flex-none items-center whitespace-nowrap rounded-full px-2 text-small font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
