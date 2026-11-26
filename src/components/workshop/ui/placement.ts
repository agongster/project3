/**
 * Two small browser helpers: where the bug card goes next to its line, and
 * handing the player a file to save (patch, zip) without any server.
 */
import type { ScreenBox } from "../editor/types";

/** The bug card's width in pixels (it must match .ws-bug-card in workshop.css). */
export const CARD_WIDTH = 420;
/** Space kept between the card and the line or the edges (px). */
const CARD_GAP = 6;

/** Where the card goes, in window pixels: under the line, or above it when the line is low on screen. */
export interface CardAnchor {
  left: number;
  top?: number;
  bottom?: number;
}

/**
 * Places the card next to `line` inside the editor area `area`. When the line
 * is scrolled out of view the card sits at the top of the area.
 */
export function cardAnchor(line: ScreenBox | null, area: DOMRect): CardAnchor {
  const maxLeft = Math.max(area.left + CARD_GAP, area.right - CARD_WIDTH - CARD_GAP);
  if (!line) return { left: maxLeft, top: area.top + CARD_GAP };
  const left = Math.min(Math.max(line.left, area.left + CARD_GAP), maxLeft);
  const lowerHalf = line.top > area.top + area.height / 2;
  return lowerHalf ? { left, bottom: window.innerHeight - line.top + CARD_GAP } : { left, top: line.bottom + CARD_GAP };
}

/** Lets the player save `data` as a file called `name` (built in the browser, nothing is uploaded). */
export function downloadFile(name: string, data: string | Uint8Array, type: string): void {
  const part: BlobPart = typeof data === "string" ? data : new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([part], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL is freed.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
