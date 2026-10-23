import type { CSSProperties, ReactNode } from "react";

/** A single placeholder block. Size it with Tailwind classes (h-*, w-*) to match the content it stands in for. */
export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/** Placeholder paragraph: full-width lines with a shorter last line. */
export function SkeletonText({
  lines = 2,
  lineClassName = "h-4",
  lastWidth = "62%",
  className = "",
}: {
  lines?: number;
  lineClassName?: string;
  lastWidth?: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={lineClassName}
          style={i === lines - 1 && lines > 1 ? { width: lastWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Wraps a group of skeletons so assistive tech hears one polite "Loading…" message instead of
 * nothing (the blocks themselves are hidden from the accessibility tree).
 */
export function SkeletonRegion({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Shared bordered surface used by most cards, so skeleton cards keep the real card's frame. */
export function SkeletonCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className={`rounded-(--radius-card) border border-line bg-surface ${className}`}>
      {children}
    </div>
  );
}
