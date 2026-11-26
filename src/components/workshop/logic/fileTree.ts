/**
 * The explorer's data: the workspace's flat list of files turned into a
 * folder tree, the rows that are visible for the folders the player has
 * opened and the text in the filter box, and the ranking behind quick-open
 * (Ctrl/Cmd+P).
 *
 *   entries ──buildFileTree──► tree ──visibleRows(expanded, filter)──► rows to draw
 *   paths   ──rankPaths(query)──► best matches for quick-open
 */
import type { WorkspaceEntry } from "@/lib/workspace/contract";

export interface TreeFolder {
  kind: "folder";
  /** The last part of the path ("bakery"); "" for the root. */
  name: string;
  /** Full path without a trailing slash ("bakery/oven"); "" for the root. */
  path: string;
  children: TreeNode[];
}

export interface TreeFile {
  kind: "file";
  name: string;
  path: string;
  entry: WorkspaceEntry;
}

export type TreeNode = TreeFolder | TreeFile;

/** One line of the explorer. */
export interface TreeRow {
  node: TreeNode;
  /** 0 for the top level. */
  depth: number;
  /** Folders only: are its children shown? */
  expanded: boolean;
}

/** At most this many quick-open results are listed. */
export const QUICK_OPEN_LIMIT = 40;

/** Folders first, then files, each in case-insensitive name order. */
function compareNodes(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.name.localeCompare(b.name);
}

function sortTree(folder: TreeFolder): void {
  folder.children.sort(compareNodes);
  for (const child of folder.children) if (child.kind === "folder") sortTree(child);
}

/** Builds the folder tree. Empty path parts ("a//b.py", a trailing "/") are ignored. */
export function buildFileTree(entries: readonly WorkspaceEntry[]): TreeFolder {
  const root: TreeFolder = { kind: "folder", name: "", path: "", children: [] };
  const folders = new Map<string, TreeFolder>([["", root]]);

  function folderFor(parts: readonly string[]): TreeFolder {
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join("/");
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: "folder", name: parts[i], path, children: [] };
        folders.set(path, folder);
        parent.children.push(folder);
      }
      parent = folder;
    }
    return parent;
  }

  for (const entry of entries) {
    const parts = entry.path.split("/").filter((part) => part !== "");
    if (parts.length === 0) continue;
    const name = parts.pop()!;
    folderFor(parts).children.push({ kind: "file", name, path: entry.path, entry });
  }
  sortTree(root);
  return root;
}

/** "a/b/c.py" → ["a", "a/b"]: the folders that must be open for the file to be visible. */
export function ancestorFolders(path: string): string[] {
  const parts = path.split("/").filter((part) => part !== "");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** True when every word of the filter appears in the path (case-insensitive). */
export function matchesFilter(path: string, filter: string): boolean {
  const lower = path.toLowerCase();
  return filter
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
    .every((word) => lower.includes(word));
}

/** True if the folder holds at least one file that matches the filter. */
function folderMatches(folder: TreeFolder, filter: string): boolean {
  return folder.children.some((child) => (child.kind === "file" ? matchesFilter(child.path, filter) : folderMatches(child, filter)));
}

/**
 * The rows to draw, top to bottom. Without a filter, a folder's children are
 * shown when the folder is in `expanded`. With a filter, only matching files
 * are shown, and every folder on the way to one is open, so the player sees
 * all hits at once.
 */
export function visibleRows(root: TreeFolder, expanded: ReadonlySet<string>, filter: string): TreeRow[] {
  const filtering = filter.trim() !== "";
  const rows: TreeRow[] = [];

  function walk(folder: TreeFolder, depth: number): void {
    for (const node of folder.children) {
      if (node.kind === "file") {
        if (!filtering || matchesFilter(node.path, filter)) rows.push({ node, depth, expanded: false });
        continue;
      }
      if (filtering && !folderMatches(node, filter)) continue;
      const open = filtering || expanded.has(node.path);
      rows.push({ node, depth, expanded: open });
      if (open) walk(node, depth + 1);
    }
  }

  walk(root, 0);
  return rows;
}

// ───────────────────────────── Quick-open ─────────────────────────────

/** Bonus for a query letter that starts a path part ("o" in "bakery/orders.py"). */
const WORD_START_BONUS = 8;
/** Bonus for a letter that directly follows the previous matched letter. */
const RUN_BONUS = 5;
/** Bonus for letters matched inside the file name rather than its folders. */
const FILE_NAME_BONUS = 3;
/** Every skipped character costs this much, so tight matches rank first. */
const GAP_PENALTY = 0.1;

/**
 * How well `query` fuzzy-matches `path`: every query letter must appear in
 * order ("bord" matches "bakery/orders.py"). Higher is better; null when the
 * path does not match at all. An empty query matches everything with 0.
 */
export function fuzzyScore(query: string, path: string): number | null {
  const needle = query.toLowerCase().replace(/\s+/g, "");
  if (needle === "") return 0;
  const hay = path.toLowerCase();
  const nameStart = hay.lastIndexOf("/") + 1;
  let score = 0;
  let from = 0;
  let previous = -2;
  for (const letter of needle) {
    const at = hay.indexOf(letter, from);
    if (at < 0) return null;
    const before = at === 0 ? "/" : hay[at - 1];
    if (before === "/" || before === "_" || before === "-" || before === ".") score += WORD_START_BONUS;
    if (at === previous + 1) score += RUN_BONUS;
    if (at >= nameStart) score += FILE_NAME_BONUS;
    score -= (at - from) * GAP_PENALTY;
    previous = at;
    from = at + 1;
  }
  return score;
}

/** The best quick-open matches for `query`, best first (ties keep the given order). */
export function rankPaths(paths: readonly string[], query: string, limit = QUICK_OPEN_LIMIT): string[] {
  return paths
    .map((path, index) => ({ path, index, score: fuzzyScore(query, path) }))
    .filter((hit): hit is { path: string; index: number; score: number } => hit.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((hit) => hit.path);
}
