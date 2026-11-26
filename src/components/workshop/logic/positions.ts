/**
 * Converting between the two ways a place in a file can be written down:
 *
 *   TextRange (from Ruff, via the workspace)     editor offsets (CodeMirror)
 *   { line: 3, col: 5, endLine: 3, endCol: 9 }   { from: 41, to: 45 }
 *   1-based lines and columns                    0-based positions in the whole text
 *
 * The workspace runs Ruff with UTF-16 positions (see
 * src/lib/workspace/liveCheck.ts), the same units JavaScript strings and
 * CodeMirror use, so a column is simply "index in the line + 1". Anything out
 * of range is clamped instead of throwing, so a stale finding (the text
 * changed since it was checked) can never crash the editor.
 *
 * Nothing here imports CodeMirror: `DocLines` is the small part of
 * CodeMirror's `Text` these functions need, so they also work in unit tests
 * and keep the editor library out of the game's first download.
 */
import type { TextEdit, TextRange } from "@/lib/workspace/contract";

/** One line of a document (CodeMirror's `Line` has this shape). */
export interface DocLine {
  /** 1-based line number. */
  number: number;
  /** Offset of the line's first character. */
  from: number;
  /** Offset just after the line's last character (before the line break). */
  to: number;
  text: string;
}

/** The part of CodeMirror's `Text` that position conversion needs. */
export interface DocLines {
  /** Number of lines (at least 1, even for an empty document). */
  readonly lines: number;
  /** Total length in UTF-16 units. */
  readonly length: number;
  /** The line with this 1-based number. */
  line(n: number): DocLine;
  /** The line that contains this offset. */
  lineAt(pos: number): DocLine;
}

/** One replacement in editor offsets (the shape CodeMirror's `changes` accepts). */
export interface OffsetChange {
  from: number;
  to: number;
  insert: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** The offset inside `lineText` of the 1-based column `col`; a column past the end of the line is the line's end. */
export function columnToOffset(lineText: string, col: number): number {
  return clamp(Math.floor(col) - 1, 0, lineText.length);
}

/** The 1-based column of `offset` inside `lineText` (the inverse of columnToOffset). */
export function offsetToColumn(lineText: string, offset: number): number {
  return clamp(offset, 0, lineText.length) + 1;
}

/** The offset of a 1-based (line, column) position, clamped into the document. */
export function positionToOffset(doc: DocLines, line: number, col: number): number {
  const docLine = doc.line(clamp(Math.floor(line), 1, doc.lines));
  return docLine.from + columnToOffset(docLine.text, col);
}

/** The 1-based (line, column) of an offset, clamped into the document. */
export function offsetToPosition(doc: DocLines, offset: number): { line: number; col: number } {
  const docLine = doc.lineAt(clamp(offset, 0, doc.length));
  return { line: docLine.number, col: offsetToColumn(docLine.text, offset - docLine.from) };
}

/** A TextRange as editor offsets. `to` is never before `from`. */
export function rangeToOffsets(doc: DocLines, range: TextRange): { from: number; to: number } {
  const from = positionToOffset(doc, range.line, range.col);
  const to = positionToOffset(doc, Math.max(range.line, range.endLine), range.endCol);
  return { from, to: Math.max(from, to) };
}

/**
 * Ruff's quick-fix edits as editor changes. Every edit's position refers to
 * the text *before* the fix, which is exactly how CodeMirror applies a list
 * of changes in one transaction; they are sorted by position, and an edit
 * that overlaps an earlier one is dropped (CodeMirror would reject it).
 */
export function editsToChanges(doc: DocLines, edits: readonly TextEdit[]): OffsetChange[] {
  const changes = edits
    .map((edit) => ({ ...rangeToOffsets(doc, edit), insert: edit.text }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const kept: OffsetChange[] = [];
  for (const change of changes) {
    const previous = kept[kept.length - 1];
    if (previous && change.from < previous.to) continue;
    kept.push(change);
  }
  return kept;
}

/**
 * The smallest single replacement that turns `before` into `after`: the
 * common start and end are left alone. Used for Polish (formatting), so the
 * cursor and the scroll position stay where they were instead of jumping to
 * the top as they would if the whole text were replaced. Null when the texts
 * are equal.
 */
export function minimalChange(before: string, after: string): OffsetChange | null {
  if (before === after) return null;
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (start < shorter && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let end = 0;
  while (end < shorter - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) end++;
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}

/** The text with every line break written as "\n" (how the editor counts positions). */
export function toUnixBreaks(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

/**
 * The line separator a file uses: "\r\n" when most of its line breaks are
 * Windows ones, otherwise "\n". A file that mixes both is saved with the
 * majority (see editor/lineEndings.ts for why this matters).
 */
export function lineSeparatorOf(text: string): "\r\n" | "\n" {
  const windows = text.split("\r\n").length - 1;
  const unix = text.split("\n").length - 1 - windows;
  return windows > unix ? "\r\n" : "\n";
}
