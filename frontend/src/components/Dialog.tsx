"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  children: ReactNode;
  className?: string;
  /** "drawer" slides in from the left (mobile navigation); "center" fades and rises. */
  variant?: "center" | "drawer";
}

/**
 * Native <dialog>: focus trap, Escape to close, and complete scroll freeze of background page.
 * Uses bulletproof position:fixed scroll-locking and non-passive wheel cancellation.
 */
export function Dialog({ open, onClose, labelledBy, children, className = "", variant = "center" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useBodyScrollLock(open, ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      data-variant={variant}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg bg-surface p-0 text-ink overscroll-contain open:flex ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
