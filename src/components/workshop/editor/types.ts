/**
 * The editor as the React side sees it: a handle with plain methods, and the
 * hooks it calls back. Types only, so React components can use them without
 * importing CodeMirror (which is downloaded only when the Workshop opens,
 * see loadKit.ts).
 */
import type { MonsterKind, Severity } from "@/lib/types";
import type { TextEdit, TextRange } from "@/lib/workspace/contract";
import type { LanguageId } from "../logic/languages";

/** A finding as the gutter and the underline need it. */
export interface EditorFinding {
  id: string;
  monster: MonsterKind;
  severity: Severity;
  /** "Mutable default argument", for the marker's tooltip. */
  title: string;
  range: TextRange;
}

/** Which markers changed since the previous check, for the little arrive / leave effects. */
export interface MarkerJuice {
  /** Findings that are new because of what the player typed ("!"). */
  freshIds: readonly string[];
  /** Findings of the previous check that are gone (a pop and a sparkle). */
  goneIds: readonly string[];
}

export interface EditorHooks {
  /** The text of the file shown changed (called at most every TEXT_SYNC_MS, and right before switching files). */
  onText(path: string, text: string): void;
  /** The cursor moved (1-based). */
  onCursor(line: number, col: number): void;
  /** A monster marker in the gutter was clicked. */
  onMonsterClick(line: number, findingIds: string[]): void;
  /** The editor scrolled (popups anchored to a line follow it). */
  onScroll(): void;
}

/** A rectangle in window coordinates. */
export interface ScreenBox {
  top: number;
  bottom: number;
  left: number;
}

export interface EditorHandle {
  /** Shows `path`, restoring its undo history and scroll position from an earlier visit when its text still matches. */
  show(path: string, text: string, language: LanguageId): Promise<void>;
  /** The path shown, or null. */
  shownPath(): string | null;
  /** The current text of a file the editor has shown this session, or null. */
  textOf(path: string): string | null;
  /**
   * Replaces the monsters of the file shown. Ignored (returns false) when the
   * file has changed since `checkedText` was checked: a newer check is on its way.
   */
  setFindings(path: string, checkedText: string, findings: readonly EditorFinding[], juice: MarkerJuice): boolean;
  /** Applies a quick fix as one undo step. */
  applyEdits(edits: readonly TextEdit[]): void;
  /** Replaces the text with `next` as one undo step, touching only what differs (Polish). */
  replaceText(next: string): void;
  /** Sets the whole text of `path` (a revert); undo brings the old text back as unsaved typing. */
  resetFile(path: string, text: string): void;
  /** Forgets a file's editor state (its undo history). */
  forget(path: string): void;
  /** Moves the cursor to a 1-based line (and column) and scrolls it into the middle. */
  goTo(line: number, col?: number): void;
  /** Finding ids whose marker sits on this 1-based line (positions follow typing). */
  findingIdsAt(line: number): string[];
  /** The next line with a monster after (or before) `line`, wrapping around; null when there are none. */
  nextMonsterLine(line: number, direction: 1 | -1): number | null;
  /** Where a 1-based line is on screen, or null when it is scrolled out of view. */
  lineBox(line: number): ScreenBox | null;
  focus(): void;
  openSearch(): void;
  destroy(): void;
}
