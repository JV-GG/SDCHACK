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
 * Native <dialog>: focus trap, Escape to close, and complete scroll freeze of background page.
 * Uses bulletproof position:fixed scroll-locking and non-passive wheel cancellation.
 */
export function Dialog({ open, onClose, labelledBy, children, className = "" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      if (!el.open) el.showModal();

      // Record exact scroll position before locking
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // 1. Physically freeze document.body via position: fixed (prevents inertia & trackpad momentum)
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";

      // 2. Intercept wheel and touch gestures on backdrop or outside dialog
      const blockBackgroundWheel = (e: WheelEvent) => {
        if (!el.contains(e.target as Node)) {
          e.preventDefault();
        }
      };

      const blockBackgroundTouch = (e: TouchEvent) => {
        if (!el.contains(e.target as Node)) {
          e.preventDefault();
        }
      };

      window.addEventListener("wheel", blockBackgroundWheel, { passive: false });
      window.addEventListener("touchmove", blockBackgroundTouch, { passive: false });

      return () => {
        // Clean up listeners and unlock body
        window.removeEventListener("wheel", blockBackgroundWheel);
        window.removeEventListener("touchmove", blockBackgroundTouch);

        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.paddingRight = "";
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";

        // Restore exact scroll offset
        window.scrollTo(0, scrollY);
      };
    } else {
      if (el.open) el.close();
    }
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
      className={`m-auto max-h-[calc(100dvh-32px)] w-[min(960px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg bg-surface p-0 text-ink overscroll-contain open:flex ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
