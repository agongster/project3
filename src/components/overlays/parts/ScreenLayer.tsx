"use client";

/**
 * A click-through layer over the whole window, for celebration effects
 * (legendary shimmer, victory confetti).
 *
 * It is rendered into <body> through a portal: the dialog panel is
 * transformed by its pop-in animation, and a transformed ancestor would
 * otherwise trap a `position: fixed` layer inside the panel.
 */
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function ScreenLayer({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {children}
    </div>,
    document.body,
  );
}
