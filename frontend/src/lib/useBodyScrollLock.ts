"use client";

import { useEffect, type RefObject } from "react";

// Global reference count to support multiple or transitioning modals
let lockCount = 0;
let savedScrollY = 0;
let originalBodyStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  overflow: string;
} | null = null;
let originalHtmlOverflow = "";

/**
 * Freezes the background document when a modal is active.
 * Sets position: fixed on body at current scroll position, activates modal-open classes,
 * and intercepts wheel / touchmove events outside the modal container.
 */
export function useBodyScrollLock(
  locked: boolean,
  containerRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      originalBodyStyles = {
        position: document.body.style.position,
        top: document.body.style.top,
        left: document.body.style.left,
        right: document.body.style.right,
        width: document.body.style.width,
        paddingRight: document.body.style.paddingRight,
        overflow: document.body.style.overflow,
      };
      originalHtmlOverflow = document.documentElement.style.overflow;

      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");

      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    lockCount++;

    const blockOutsideWheel = (e: WheelEvent) => {
      if (containerRef?.current && !containerRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    const blockOutsideTouch = (e: TouchEvent) => {
      if (containerRef?.current && !containerRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };

    if (containerRef) {
      window.addEventListener("wheel", blockOutsideWheel, { passive: false });
      window.addEventListener("touchmove", blockOutsideTouch, { passive: false });
    }

    return () => {
      if (containerRef) {
        window.removeEventListener("wheel", blockOutsideWheel);
        window.removeEventListener("touchmove", blockOutsideTouch);
      }

      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");

        if (originalBodyStyles) {
          document.body.style.position = originalBodyStyles.position;
          document.body.style.top = originalBodyStyles.top;
          document.body.style.left = originalBodyStyles.left;
          document.body.style.right = originalBodyStyles.right;
          document.body.style.width = originalBodyStyles.width;
          document.body.style.paddingRight = originalBodyStyles.paddingRight;
          document.body.style.overflow = originalBodyStyles.overflow;
          originalBodyStyles = null;
        } else {
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.left = "";
          document.body.style.right = "";
          document.body.style.width = "";
          document.body.style.paddingRight = "";
          document.body.style.overflow = "";
        }

        document.documentElement.style.overflow = originalHtmlOverflow || "";
        window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
      }
    };
  }, [locked, containerRef]);
}
