/**
 * Two small browser helpers: where the bug card goes next to its line, and
 * handing the player a file to save (patch, zip) without any server.
 */
import type { ScreenBox } from "../editor/types";

/** The bug card's width in pixels (it must match .ws-bug-card in workshop.css). */
export const CARD_WIDTH = 420;
/** Space kept between the card and the line or the edges (px). */
const CARD_GAP = 6;

/** Where the card goes, in window pixels: under the line, or above it when there is more room above. */
export interface CardAnchor {
  left: number;
  top?: number;
  bottom?: number;
  /** The room between the line and the window's edge: a taller card scrolls inside, never off screen. */
  maxHeight: number;
}

/**
 * Places the card next to `line` inside the editor area `area`. When the line
 * is scrolled out of view the card sits at the top of the area.
 */
export function cardAnchor(line: ScreenBox | null, area: DOMRect, windowHeight = window.innerHeight): CardAnchor {
  const maxLeft = Math.max(area.left + CARD_GAP, area.right - CARD_WIDTH - CARD_GAP);
  if (!line) return { left: maxLeft, top: area.top + CARD_GAP, maxHeight: windowHeight - area.top - 2 * CARD_GAP };
  const left = Math.min(Math.max(line.left, area.left + CARD_GAP), maxLeft);
  const roomAbove = line.top - 2 * CARD_GAP;
  const roomBelow = windowHeight - line.bottom - 2 * CARD_GAP;
  if (roomAbove > roomBelow) return { left, bottom: windowHeight - line.top + CARD_GAP, maxHeight: roomAbove };
  return { left, top: line.bottom + CARD_GAP, maxHeight: roomBelow };
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
