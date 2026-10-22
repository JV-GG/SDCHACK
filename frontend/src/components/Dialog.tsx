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
 * Background page scroll is locked when open to prevent background scrolling.
 */
export function Dialog({ open, onClose, labelledBy, children, className = "" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      if (!el.open) el.showModal();
      // Lock background scrolling while modal is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      if (el.open) el.close();
      document.body.style.overflow = "";
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={() => {
        document.body.style.overflow = "";
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === ref.current) {
          document.body.style.overflow = "";
          onClose();
        }
      }}
      className={`m-auto max-h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg bg-surface p-0 text-ink open:flex ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
