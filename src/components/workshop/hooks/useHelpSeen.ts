/**
 * Has the player dismissed the "how this works" panel? Remembered in
 * localStorage, so it greets each player once. Storage that is blocked or
 * full just means the panel shows again: nothing breaks.
 */
import { useSyncExternalStore } from "react";

export const HELP_SEEN_KEY = "lintlands:workshop:help-seen";

const listeners = new Set<() => void>();
/** Also kept in memory, so the panel can be dismissed even where storage is blocked. */
let seenThisVisit = false;

function readSeen(): boolean {
  if (seenThisVisit) return true;
  try {
    return window.localStorage.getItem(HELP_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Remembers that the panel was dismissed. */
export function markHelpSeen(): void {
  seenThisVisit = true;
  try {
    window.localStorage.setItem(HELP_SEEN_KEY, "1");
  } catch {
    // Storage unavailable: the panel will simply show again next time.
  }
  for (const listener of [...listeners]) listener();
}

/** True once the panel was dismissed (false during server rendering). */
export function useHelpSeen(): boolean {
  return useSyncExternalStore(subscribe, readSeen, () => false);
}
