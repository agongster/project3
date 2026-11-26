/**
 * Picks which files of a repo the game uses:
 *   - Python files written by the repo's own authors, not too big, and not
 *     too many: they become buildings (and dungeons);
 *   - other text files (README, config, docs, other languages): the Workshop
 *     can open and edit them, but they have no monsters.
 */
import type { RepoFileEntry, RepoListing } from "@/lib/types";

/** At most this many files become buildings (keeps the world walkable and loading fast). */
export const MAX_FILES = 150;
/** Bigger files are usually generated code or data, and slow to lint. */
export const MAX_FILE_BYTES = 100 * 1024;
/** At most this many other text files are listed for the Workshop. */
export const MAX_OTHER_FILES = 200;
/** Bigger non-Python files are usually data or generated, not something to edit by hand. */
export const MAX_OTHER_FILE_BYTES = 200 * 1024;
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
/**
 * Extensions (lower-case, without the dot) of the text files the Workshop
 * lists besides Python. Anything else (images, archives, fonts, notebooks
 * full of output, …) is left out, so a binary file is never offered.
 */
export const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  // docs and plain text
  "md", "markdown", "rst", "txt", "adoc",
  // config and data
  "toml", "cfg", "ini", "conf", "yaml", "yml", "json", "jsonc", "xml", "csv", "tsv", "env", "properties", "in",
  // other languages
  "pyi", "pyx", "pxd", "sh", "bash", "zsh", "fish", "bat", "ps1", "js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "scss", "html", "htm",
  "c", "h", "cc", "cpp", "hpp", "cu", "rs", "go", "java", "kt", "rb", "php", "sql", "r", "jl", "lua", "pl", "swift", "scala", "proto", "tex",
]);
/** Well-known text files without a telling extension (compared in lower case). */
export const TEXT_FILE_NAMES: ReadonlySet<string> = new Set([
  "dockerfile", "makefile", "gnumakefile", "license", "licence", "copying", "authors", "contributors", "changelog", "changes", "notice",
  "readme", "procfile", "pipfile", "gemfile", "rakefile", "vagrantfile", "jenkinsfile", "justfile", "codeowners", "manifest.in",
  ".gitignore", ".gitattributes", ".dockerignore", ".editorconfig", ".flake8", ".pylintrc", ".coveragerc", ".python-version", ".env.example",
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
  /** The other text files (see TEXT_EXTENSIONS), sorted by path. */
  otherFiles: RepoFileEntry[];
}

/**
 * Keeps lintable Python files. When there are more than MAX_FILES, the files
 * closest to the repo root win (then alphabetical order), so the top of the
 * project is always represented. The result is sorted by path. The other text
 * files follow the same rules with their own caps.
 */
export function filterFiles(entries: readonly TreeEntry[]): FilterResult {
  const skipped = { vendored: 0, tooLarge: 0, overCap: 0 };
  const candidates: RepoFileEntry[] = [];

  for (const entry of entries) {
    if (!isRegularFile(entry) || !entry.path.endsWith(".py")) continue;
    if (isVendored(entry.path)) skipped.vendored++;
    else if ((entry.size ?? 0) > MAX_FILE_BYTES) skipped.tooLarge++;
    else candidates.push({ path: entry.path, size: entry.size ?? 0 });
  }

  const kept = candidates.sort(shallowFirst).slice(0, MAX_FILES);
  skipped.overCap = candidates.length - kept.length;
  return { files: kept.sort((a, b) => comparePaths(a.path, b.path)), skipped, otherFiles: filterOtherFiles(entries) };
}

/** The non-Python text files, closest to the root first when there are too many. */
function filterOtherFiles(entries: readonly TreeEntry[]): RepoFileEntry[] {
  const candidates = entries
    .filter((entry) => isRegularFile(entry) && isOtherTextFile(entry.path) && !isVendored(entry.path) && (entry.size ?? 0) <= MAX_OTHER_FILE_BYTES)
    .map((entry) => ({ path: entry.path, size: entry.size ?? 0 }));
  return candidates
    .sort(shallowFirst)
    .slice(0, MAX_OTHER_FILES)
    .sort((a, b) => comparePaths(a.path, b.path));
}

/** True for a text file the Workshop can open that is not a Python file. */
export function isOtherTextFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (name.endsWith(".py")) return false;
  if (TEXT_FILE_NAMES.has(name)) return true;
  const dot = name.lastIndexOf(".");
  return dot > 0 && TEXT_EXTENSIONS.has(name.slice(dot + 1));
}

function isRegularFile(entry: TreeEntry): boolean {
  return entry.type === "blob" && entry.mode !== SYMLINK_MODE;
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
