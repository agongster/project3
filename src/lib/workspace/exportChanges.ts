/**
 * Taking the player's edits out of the browser: as one unified diff that
 * `git apply` understands, or as a zip of the changed files.
 *
 *   diff --git a/pkg/mod.py b/pkg/mod.py
 *   --- a/pkg/mod.py
 *   +++ b/pkg/mod.py
 *   @@ -3,7 +3,6 @@
 *    …
 *
 * The diff itself comes from the `diff` package; the zip from `fflate`.
 */
import { diffLines, FILE_HEADERS_ONLY, formatPatch, structuredPatch } from "diff";
import { strToU8, zipSync } from "fflate";
import type { FileChange } from "./contract";

/** Unchanged lines shown around each change in the patch (git's own default). */
export const PATCH_CONTEXT_LINES = 3;

/** A modified file with its added / removed line counts (for the "Changes" list). */
export function describeChange(path: string, original: string, saved: string): FileChange {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const part of diffLines(original, saved)) {
    if (part.added) linesAdded += part.count;
    else if (part.removed) linesRemoved += part.count;
  }
  return { path, original, saved, linesAdded, linesRemoved };
}

/** All changes as one patch for `git apply` (run in the repo's root). "" when nothing changed. */
export function unifiedDiff(changes: readonly FileChange[]): string {
  return changes.map(filePatch).join("");
}

function filePatch(change: FileChange): string {
  const oldName = gitQuotePath(`a/${change.path}`);
  const newName = gitQuotePath(`b/${change.path}`);
  const patch = structuredPatch(oldName, newName, change.original, change.saved, undefined, undefined, { context: PATCH_CONTEXT_LINES });
  return `diff --git ${oldName} ${newName}\n${formatPatch(patch, FILE_HEADERS_ONLY)}`;
}

/** The changed files with their full new text, at their paths in the repo, as a .zip file's bytes. */
export function zipChanges(changes: readonly FileChange[]): Uint8Array {
  return zipSync(Object.fromEntries(changes.map((change) => [change.path, strToU8(change.saved)])));
}

/** Characters git escapes inside a quoted path, and how. */
const GIT_ESCAPES: Readonly<Record<string, string>> = { '"': '\\"', "\\": "\\\\", "\t": "\\t", "\n": "\\n", "\r": "\\r" };

/**
 * A path the way git writes it in a patch header: as is, or in double quotes
 * with C-style escapes when it contains a quote, a backslash or a control
 * character (which would otherwise break the header line).
 */
export function gitQuotePath(path: string): string {
  if (!/["\\\u0000-\u001f\u007f]/.test(path)) return path;
  const escaped = Array.from(path, (char) => GIT_ESCAPES[char] ?? (char < " " || char === "\u007f" ? octalEscape(char) : char)).join("");
  return `"${escaped}"`;
}

function octalEscape(char: string): string {
  return `\\${char.charCodeAt(0).toString(8).padStart(3, "0")}`;
}
