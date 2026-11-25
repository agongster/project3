/**
 * Picks which files of a repo become buildings: Python files written by the
 * repo's own authors, not too big, and not too many.
 */
import type { RepoFileEntry, RepoListing } from "@/lib/types";

/** At most this many files become buildings (keeps the world walkable and loading fast). */
export const MAX_FILES = 150;
/** Bigger files are usually generated code or data, and slow to lint. */
export const MAX_FILE_BYTES = 100 * 1024;
/** Directories full of code the repo's authors didn't write (or that is generated). */
export const VENDORED_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  "venv",
  ".venv",
  "env",
  "site-packages",
  "node_modules",
  "__pycache__",
  "build",
  "dist",
  ".tox",
  "migrations",
  "vendor",
  "third_party",
  ".eggs",
]);
/** Git's file mode for symbolic links. Their "content" is just a path, not Python. */
const SYMLINK_MODE = "120000";

/** One entry of GitHub's `git/trees?recursive=1` response (only the fields we use). */
export interface TreeEntry {
  path: string;
  /** "blob" (file), "tree" (directory) or "commit" (submodule). */
  type: string;
  mode?: string;
  size?: number;
}

export interface FilterResult {
  files: RepoFileEntry[];
  skipped: RepoListing["skipped"];
}

/**
 * Keeps lintable Python files. When there are more than MAX_FILES, the files
 * closest to the repo root win (then alphabetical order), so the top of the
 * project is always represented. The result is sorted by path.
 */
export function filterFiles(entries: readonly TreeEntry[]): FilterResult {
  const skipped = { vendored: 0, tooLarge: 0, overCap: 0 };
  const candidates: RepoFileEntry[] = [];

  for (const entry of entries) {
    if (!isPythonFile(entry)) continue;
    if (isVendored(entry.path)) skipped.vendored++;
    else if ((entry.size ?? 0) > MAX_FILE_BYTES) skipped.tooLarge++;
    else candidates.push({ path: entry.path, size: entry.size ?? 0 });
  }

  const kept = candidates.sort(shallowFirst).slice(0, MAX_FILES);
  skipped.overCap = candidates.length - kept.length;
  return { files: kept.sort((a, b) => comparePaths(a.path, b.path)), skipped };
}

function isPythonFile(entry: TreeEntry): boolean {
  return entry.type === "blob" && entry.mode !== SYMLINK_MODE && entry.path.endsWith(".py");
}

function isVendored(path: string): boolean {
  return path.split("/").some((segment) => VENDORED_DIRECTORIES.has(segment));
}

function depth(path: string): number {
  return path.split("/").length;
}

function shallowFirst(a: RepoFileEntry, b: RepoFileEntry): number {
  return depth(a.path) - depth(b.path) || comparePaths(a.path, b.path);
}

/** Plain code-point order: the same on every machine (unlike localeCompare). */
function comparePaths(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
