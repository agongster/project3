/**
 * The rows of the read-only diff view (Changes tab): a file's original text
 * against its forged text, as numbered lines marked unchanged / added /
 * removed, with a gap row between distant changes. Built on the `diff`
 * package's line diff, the same one the patch export uses.
 */
import { structuredPatch } from "diff";

export interface DiffRow {
  kind: "context" | "added" | "removed" | "gap";
  /** Line number in the original text (null for added lines and gaps). */
  oldLine: number | null;
  /** Line number in the forged text (null for removed lines and gaps). */
  newLine: number | null;
  text: string;
}

/** Unchanged lines shown around each change. */
export const DIFF_CONTEXT_LINES = 3;
/** The view stops after this many rows, so a rewritten huge file can't freeze the page. */
export const MAX_DIFF_ROWS = 1500;

/** Rows for `original` → `saved`; `truncated` is true when rows were cut at MAX_DIFF_ROWS. */
export function diffRows(original: string, saved: string): { rows: DiffRow[]; truncated: boolean } {
  const patch = structuredPatch("a", "b", original, saved, "", "", { context: DIFF_CONTEXT_LINES });
  const rows: DiffRow[] = [];

  for (const [index, hunk] of patch.hunks.entries()) {
    if (index > 0) rows.push({ kind: "gap", oldLine: null, newLine: null, text: "" });
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;
    for (const line of hunk.lines) {
      const mark = line[0];
      const text = line.slice(1);
      if (mark === "+") rows.push({ kind: "added", oldLine: null, newLine: newLine++, text });
      else if (mark === "-") rows.push({ kind: "removed", oldLine: oldLine++, newLine: null, text });
      else if (mark === " ") rows.push({ kind: "context", oldLine: oldLine++, newLine: newLine++, text });
      // "\ No newline at end of file" markers are left out.
      if (rows.length >= MAX_DIFF_ROWS) return { rows, truncated: true };
    }
  }
  return { rows, truncated: false };
}
