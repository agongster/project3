import { useEffect, useState, type RefObject } from "react";
import { VIEW_H, VIEW_W } from "@/game/bridge";

/**
 * The biggest whole-number zoom at which the VIEW_W × VIEW_H game fits in
 * the available space. Whole numbers keep every art pixel the same size
 * (a 2.5× zoom would make some pixels 2 and others 3 screen pixels wide).
 */
export function gameScale(availableWidth: number, availableHeight: number): number {
  return Math.max(1, Math.floor(Math.min(availableWidth / VIEW_W, availableHeight / VIEW_H)));
}

/** `gameScale` for the element behind `ref`, kept up to date as the window resizes. */
export function useGameScale(ref: RefObject<HTMLElement | null>): number {
  // Start from the window size so the first frame is already the right size.
  const [scale, setScale] = useState(() => gameScale(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(gameScale(entry.contentRect.width, entry.contentRect.height));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return scale;
}
