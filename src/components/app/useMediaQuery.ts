import { useCallback, useSyncExternalStore } from "react";

/**
 * True while the CSS media query matches, updated live as the window
 * resizes. Used where CSS alone can't adapt the layout, e.g. picking the
 * zoom of a pixel-art canvas (which must be a whole number).
 *
 *   const roomy = useMediaQuery(ROOMY_SCREEN);
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Windows big enough for the large hero previews and theme cards (a 1440×900 laptop is). */
export const ROOMY_SCREEN = "(min-height: 820px) and (min-width: 1200px)";
