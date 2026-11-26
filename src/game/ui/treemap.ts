/**
 * The repo as a TREEMAP, for the big map's second view: one rectangle per
 * file, its area proportional to the file's line count, files grouped into
 * one box per top-level folder. Pure layout (no canvas); minimap.ts draws it.
 *
 *   ┌ bakery/ ─────────────┬ potions/ ──────┐
 *   │ pricing.py │ orders  │ brewing │ labe │   big files, big boxes:
 *   │            ├─────────┤         ├──────┤   you see at a glance where
 *   │            │ recipes │         │ caul │   the code (and the bugs) are
 *   └────────────┴─────────┴─────────┴──────┘
 *
 * Layout is the classic SQUARIFIED treemap (Bruls, Huizing & van Wijk,
 * 2000): biggest items first, laid in rows along the shorter side of the
 * space that is left; a row takes one more item as long as that keeps its
 * boxes closer to square. Square-ish boxes are what make names fit.
 *
 * Positions are fractional; the drawing code rounds every edge, so
 * neighbouring boxes always meet without gaps.
 */
import { measureText } from "@/game/art/font";

/** Even an empty file gets the area of this many lines, so it stays visible. */
export const MIN_FILE_LINES = 8;
/** Height of a folder's name strip (the font's capitals plus descenders and outline). */
export const FOLDER_HEADER_PX = 10;
/** Folders get a name strip only when their box is at least this wide and tall. */
const HEADER_MIN_W = 18;
const HEADER_MIN_H = 2 * FOLDER_HEADER_PX;
/** Space between a folder's edge and its files. */
const FOLDER_PAD_PX = 1;
/** Name of the box for files at the top of the repo. */
export const ROOT_FOLDER_NAME = "./";
const ELLIPSIS = "…";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TreemapItem {
  id: string;
  weight: number;
}

export type PlacedItem = Box & { id: string };

/** One folder of the repo treemap, with its files inside. */
export interface FolderBox extends Box {
  name: string;
  /** True when the folder's name strip is drawn at the top of its box. */
  header: boolean;
  files: PlacedItem[];
}

/**
 * Squarified treemap: a box for every item inside `area`, each with an area
 * proportional to its weight. Items with a weight of 0 or less get an empty
 * box. Deterministic: equal weights are ordered by id.
 */
export function squarify(items: readonly TreemapItem[], area: Box): PlacedItem[] {
  const sorted = [...items].sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const total = sorted.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0 || area.w <= 0 || area.h <= 0) return sorted.map((item) => ({ id: item.id, x: area.x, y: area.y, w: 0, h: 0 }));

  const scale = (area.w * area.h) / total;
  const sizes = sorted.map((item) => ({ id: item.id, size: Math.max(0, item.weight) * scale }));
  const out: PlacedItem[] = [];
  let free = { ...area };
  let row: typeof sizes = [];
  for (const item of sizes) {
    const side = Math.min(free.w, free.h);
    if (row.length === 0 || worstRatio([...row, item], side) <= worstRatio(row, side)) {
      row.push(item);
      continue;
    }
    free = placeRow(row, free, out);
    row = [item];
  }
  if (row.length > 0) placeRow(row, free, out);
  return out;
}

/** The most stretched box (long side / short side) if `row` is laid along a side of length `side`. */
function worstRatio(row: readonly { size: number }[], side: number): number {
  const sum = row.reduce((s, r) => s + r.size, 0);
  if (sum <= 0 || side <= 0) return Infinity;
  let worst = 0;
  for (const r of row) {
    if (r.size <= 0) continue;
    worst = Math.max(worst, (side * side * r.size) / (sum * sum), (sum * sum) / (side * side * r.size));
  }
  return worst;
}

/** Lays a row along the shorter side of `free`, adds its boxes to `out` and returns the space left. */
function placeRow(row: readonly { id: string; size: number }[], free: Box, out: PlacedItem[]): Box {
  const sum = row.reduce((s, r) => s + r.size, 0);
  if (free.w >= free.h) {
    // A column on the left, as wide as the row's area needs.
    const stripW = free.h > 0 ? sum / free.h : 0;
    let y = free.y;
    for (const r of row) {
      const h = stripW > 0 ? r.size / stripW : 0;
      out.push({ id: r.id, x: free.x, y, w: stripW, h });
      y += h;
    }
    return { x: free.x + stripW, y: free.y, w: free.w - stripW, h: free.h };
  }
  // A strip along the top.
  const stripH = free.w > 0 ? sum / free.w : 0;
  let x = free.x;
  for (const r of row) {
    const w = stripH > 0 ? r.size / stripH : 0;
    out.push({ id: r.id, x, y: free.y, w, h: stripH });
    x += w;
  }
  return { x: free.x, y: free.y + stripH, w: free.w, h: free.h - stripH };
}

/** "bakery/oven.py" → "bakery"; a file at the top of the repo → ROOT_FOLDER_NAME. */
function folderOf(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? ROOT_FOLDER_NAME : path.slice(0, slash);
}

/**
 * The whole repo as a treemap inside `area`: a box per top-level folder
 * (area = all its lines), with a name strip when there is room, and the
 * folder's files squarified inside it. A file's weight is its line count,
 * at least MIN_FILE_LINES.
 */
export function layoutRepoTreemap(files: readonly { path: string; lineCount: number }[], area: Box): FolderBox[] {
  const byFolder = new Map<string, { path: string; lineCount: number }[]>();
  for (const f of files) {
    const list = byFolder.get(folderOf(f.path)) ?? [];
    list.push(f);
    byFolder.set(folderOf(f.path), list);
  }
  const weight = (f: { lineCount: number }) => Math.max(MIN_FILE_LINES, f.lineCount);
  const folders = squarify(
    [...byFolder].map(([name, list]) => ({ id: name, weight: list.reduce((sum, f) => sum + weight(f), 0) })),
    area,
  );
  return folders.map((box) => {
    const header = box.w >= HEADER_MIN_W && box.h >= HEADER_MIN_H;
    const inner = {
      x: box.x + FOLDER_PAD_PX,
      y: box.y + FOLDER_PAD_PX + (header ? FOLDER_HEADER_PX : 0),
      w: Math.max(0, box.w - 2 * FOLDER_PAD_PX),
      h: Math.max(0, box.h - 2 * FOLDER_PAD_PX - (header ? FOLDER_HEADER_PX : 0)),
    };
    const list = byFolder.get(box.id) ?? [];
    return { ...box, name: box.id, header, files: squarify(list.map((f) => ({ id: f.path, weight: weight(f) })), inner) };
  });
}

/**
 * `text` on one line, shortened with "…" to fit `maxPx` of the pixel font;
 * "" when not even one letter fits. Untrusted names (whitespace, very long
 * or exotic text) can never spill out of their box.
 */
export function fitLabel(text: string, maxPx: number): string {
  const oneLine = text.replace(/\s+/g, " ");
  if (measureText(oneLine) <= maxPx) return oneLine;
  const chars = Array.from(oneLine);
  while (chars.length > 1) {
    chars.pop();
    const cut = chars.join("") + ELLIPSIS;
    if (measureText(cut) <= maxPx) return cut;
  }
  return "";
}
