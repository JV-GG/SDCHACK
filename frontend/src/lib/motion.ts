import type { CSSProperties } from "react";

/** Stagger index for `.anim-reveal`: block i starts 60ms after block i-1. */
export function stagger(i: number): CSSProperties {
  return { ["--i" as string]: i } as CSSProperties;
}
