"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  children: ReactNode;
  className?: string;
}

/**
 * Native <dialog>: focus trap, Escape to close and inert background come from the browser.
 * Children mount only while open, so editors inside start from fresh state every time.
 */
export function Dialog({ open, onClose, labelledBy, children, className = "" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg bg-surface p-0 text-ink open:flex ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
