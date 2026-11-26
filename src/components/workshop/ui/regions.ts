/**
 * F6 / Shift+F6 move the keyboard between the Workshop's four regions, the
 * way desktop editors do: explorer → editor → file sheet → top bar → …
 * Each region says where focus should land inside it.
 */

/** A region of the Workshop, in F6 order. */
export interface FocusRegion {
  element: HTMLElement | null;
  /** Puts focus at the region's natural starting point. */
  focus: () => void;
}

/** The first match of `selectors` inside `root` that can take focus, focused; false if none. */
export function focusFirst(root: HTMLElement | null, selectors: readonly string[]): boolean {
  for (const selector of selectors) {
    const target = root?.querySelector<HTMLElement>(selector);
    if (target && !target.hasAttribute("disabled")) {
      target.focus();
      return true;
    }
  }
  return false;
}

/** Moves focus to the next (1) or previous (-1) region after the one that holds focus now. */
export function cycleRegion(regions: readonly FocusRegion[], direction: 1 | -1): void {
  const current = regions.findIndex((region) => region.element?.contains(document.activeElement));
  const start = current < 0 ? (direction === 1 ? -1 : 0) : current;
  const next = regions[(start + direction + regions.length) % regions.length];
  next.focus();
}
