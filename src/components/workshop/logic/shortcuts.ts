/**
 * The Workshop's keyboard shortcuts in one table: which key combination runs
 * which command, and how to print it on a button ("⌘S" on a Mac, "Ctrl S"
 * elsewhere). "Mod" is Cmd on a Mac and Ctrl elsewhere; both are accepted
 * everywhere, so a Mac keyboard on Linux (or the reverse) still works.
 *
 * Typing keys (letters, Tab, Enter, arrows) are never shortcuts here: they
 * belong to the editor.
 */
export type WorkshopCommand =
  | "forge"
  | "forgeAll"
  | "quickOpen"
  | "search"
  | "bugCard"
  | "nextBug"
  | "previousBug"
  | "polish"
  | "nextRegion"
  | "previousRegion"
  | "back";

interface Shortcut {
  command: WorkshopCommand;
  /** KeyboardEvent.code of the main key (layout-independent, works with Alt on a Mac). */
  code: string;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** How the main key is printed. */
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { command: "forge", code: "KeyS", mod: true, label: "S" },
  { command: "forgeAll", code: "KeyS", mod: true, shift: true, label: "S" },
  { command: "quickOpen", code: "KeyP", mod: true, label: "P" },
  { command: "search", code: "KeyF", mod: true, label: "F" },
  { command: "bugCard", code: "Period", mod: true, label: "." },
  { command: "nextBug", code: "F8", label: "F8" },
  { command: "previousBug", code: "F8", shift: true, label: "F8" },
  { command: "polish", code: "KeyF", shift: true, alt: true, label: "F" },
  { command: "nextRegion", code: "F6", label: "F6" },
  { command: "previousRegion", code: "F6", shift: true, label: "F6" },
  { command: "back", code: "Escape", label: "Esc" },
];

/** The fields of a KeyboardEvent the matcher reads (easy to fake in tests). */
export interface KeyPress {
  code: string;
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** Letter keys are matched by the character typed too, so Ctrl+S works on any keyboard layout. */
function keyMatches(press: KeyPress, shortcut: Shortcut): boolean {
  if (press.code === shortcut.code) return true;
  const letter = /^Key([A-Z])$/.exec(shortcut.code)?.[1];
  return letter !== undefined && !press.altKey && press.key.toUpperCase() === letter;
}

/** The command for a key press, or null if it is not a Workshop shortcut. */
export function commandFor(press: KeyPress): WorkshopCommand | null {
  const mod = press.ctrlKey || press.metaKey;
  const match = SHORTCUTS.find(
    (shortcut) =>
      keyMatches(press, shortcut) && Boolean(shortcut.mod) === mod && Boolean(shortcut.shift) === press.shiftKey && Boolean(shortcut.alt) === press.altKey,
  );
  return match?.command ?? null;
}

/** The parts of a shortcut as printed on key caps, e.g. ["⌘", "S"] or ["Ctrl", "Shift", "S"]. */
export function shortcutKeys(command: WorkshopCommand, isMac: boolean): string[] {
  const shortcut = SHORTCUTS.find((candidate) => candidate.command === command);
  if (!shortcut) return [];
  const keys: string[] = [];
  if (shortcut.mod) keys.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.shift) keys.push(isMac ? "⇧" : "Shift");
  if (shortcut.alt) keys.push(isMac ? "⌥" : "Alt");
  keys.push(shortcut.label);
  return keys;
}
