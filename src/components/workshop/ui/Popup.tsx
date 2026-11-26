"use client";

/**
 * A Workshop popup (quick-open, a confirmation, the diff view, help): a
 * dimmed layer over the Workshop with a pixel panel in it. It keeps Tab
 * inside, gives focus back when it closes, and Esc closes it without
 * reaching the Workshop (where Esc would mean "back to the world").
 */
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/components/ui/kit";
import { useFocusTrap } from "./bits";

interface PopupProps {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Where the panel sits: in the middle, or near the top (quick-open). */
  place?: "center" | "top";
}

export function Popup({ label, onClose, children, className, place = "center" }: PopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }

  return (
    <div
      className={cx("ws-popup-layer anim-fade-in", place === "top" && "ws-popup-top")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cx("px-panel anim-pop ws-popup", className)} onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}
