/**
 * Step 2 of the overworld: arrange the buildings *inside* one region.
 *
 * Every region uses the same simple, village-like recipe ("fishbone"):
 *
 *        ##   ###  |  ##  ####          ← a row of buildings, doors facing south
 *        D#   #D#  |  D#  #D##
 *     =========================         ← a street right under the row's doors
 *                  |                    ← yard strip (flowers, hedges, fences)
 *      ###   ##    |   ###              ← the next row...
 *      #D#   D#    |   #D#
 *       ===================
 *                  ^ the spine: one vertical street joining every row
 *
 * - Every file gets a "lot" in a row: buildings, but also the 1-tile
 *   lanterns (empty `__init__.py`) and stumps (failed downloads), so those
 *   line the streets too. Lots keep their path order, so files from the
 *   same sub-folder sit next to each other.
 * - Each row is split in two halves around the spine so the village grows
 *   out from a central main street.
 * - Random 1–2 tile gaps, an occasional set-back house with a little
 *   doorstep path, and rows shifted sideways keep it from looking like a
 *   spreadsheet.
 * - Town Square additionally gets a big cobblestone plaza in the middle.
 *
 * Everything here is in *local* coordinates (0,0 = the region's top-left
 * corner); the overworld later moves the block to its place on the map.
 */
import type { Point, Rect } from "@/lib/types";
import { chance, randInt, type Rng } from "@/lib/rng";
import { isMarker, type LotSpec } from "./regions";

/** What a local tile of a region block is. */
export const Cell = { Grass: 0, Street: 1, Plaza: 2 } as const;
export type CellId = (typeof Cell)[keyof typeof Cell];

/** Grass margin kept inside the edge of every region. */
const PAD = 1;
/** Narrowest region interior, so even a one-cottage region feels like a place. */
const MIN_INNER_WIDTH = 9;
/** Town Square's plaza size (odd width so the fountain sits exactly on the spine). */
export const PLAZA_W = 17;
export const PLAZA_H = 9;
/** Plaza row (from its top) where the east/west roads enter: the promenade south of the fountain. */
export const PLAZA_PROMENADE_ROW = 6;

export type Side = "top" | "bottom" | "left" | "right";

export interface PlacedLot {
  lot: LotSpec;
  /** Top-left corner of the footprint (local). */
  x: number;
  y: number;
  /** Walkable tile just south of the footprint, horizontally centred (for markers: the street below). */
  door: Point;
}

/** One horizontal street (local coordinates). */
export interface Street {
  y: number;
  x0: number;
  x1: number;
}

export interface BlockLayout {
  w: number;
  h: number;
  /** w × h local tiles, values from `Cell`. */
  cells: Uint8Array;
  lots: PlacedLot[];
  plaza: Rect | null;
  /** Column of the vertical main street. */
  spineX: number;
  /** First and last row the spine runs between. */
  spineTop: number;
  spineBottom: number;
  streets: Street[];
  /** Grass strips between a street and the next row of houses (good spots for hedges). */
  yardRows: number[];
}

/** Gate = where a road may attach: the tile just outside the block, next to a street end. */
export interface Gate {
  side: Side;
  /** Local coordinates; one step outside the block's rectangle. */
  point: Point;
  /** Local tiles that were turned into street to reach the edge. */
  tiles: Point[];
}

interface RowItem {
  lot: LotSpec;
  /** Free columns kept on the side facing the spine. */
  gap: number;
  /** 1 = the house stands one tile back from the street, with a doorstep path. */
  setback: number;
}

interface Row {
  left: RowItem[];
  right: RowItem[];
}

/** Lays out one region's lots (in path order). `withPlaza` is true only for Town Square. */
export function layoutBlock(lots: readonly LotSpec[], rng: Rng, withPlaza: boolean): BlockLayout {
  const items: RowItem[] = lots.map((lot) =>
    // Lanterns and stumps huddle close to their neighbours and right on the street.
    isMarker(lot) ? { lot, gap: 1, setback: 0 } : { lot, gap: randInt(rng, 1, 2), setback: chance(rng, 0.25) ? 1 : 0 },
  );
  const rows = splitIntoRows(items, chooseRowCount(items)).map(splitAroundSpine);
  // Defensive: a region without any file still gets one short street.
  if (rows.length === 0 && !withPlaza) rows.push({ left: [], right: [] });

  // Horizontal extent: the widest left half and the widest right half decide where the spine goes.
  const plazaHalf = withPlaza ? (PLAZA_W - 1) / 2 : 0;
  const minHalf = Math.ceil((MIN_INNER_WIDTH - 1) / 2);
  const leftExtent = Math.max(minHalf, plazaHalf, ...rows.map((r) => sideLength(r.left)));
  const rightExtent = Math.max(minHalf, plazaHalf, ...rows.map((r) => sideLength(r.right)));
  const spineX = PAD + leftExtent;
  const w = spineX + 1 + rightExtent + PAD;

  // Vertical stacking: rows (band + street), yards between them, the plaza in the middle for the town.
  const rowsAbovePlaza = withPlaza ? Math.ceil(rows.length / 2) : rows.length;
  const placedLots: PlacedLot[] = [];
  const streets: Street[] = [];
  const yardRows: number[] = [];
  let plaza: Rect | null = null;
  let y = PAD;

  for (let index = 0; index <= rows.length; index++) {
    // The town's plaza is slotted in between the upper and lower rows.
    if (withPlaza && index === rowsAbovePlaza) {
      plaza = { x: spineX - plazaHalf, y, w: PLAZA_W, h: PLAZA_H };
      y += PLAZA_H;
    }
    if (index === rows.length) break;

    if (index > 0 || plaza !== null) {
      yardRows.push(y);
      y += 1;
    }
    const row = rows[index];
    const bandHeight = Math.max(2, ...[...row.left, ...row.right].map((it) => it.lot.h + it.setback));
    const streetY = y + bandHeight;
    const placed = placeRow(row, spineX, streetY, leftExtent, rightExtent, rng);
    placedLots.push(...placed);
    streets.push(streetFor(placed, spineX, streetY, w, rng));
    y = streetY + 1;
  }
  const h = y + PAD;

  const walkwayRows = streets.map((s) => s.y);
  if (plaza) walkwayRows.push(plaza.y, plaza.y + plaza.h - 1);
  const spineTop = Math.min(...walkwayRows);
  const spineBottom = Math.max(...walkwayRows);

  const layout: BlockLayout = { w, h, cells: new Uint8Array(w * h), lots: placedLots, plaza, spineX, spineTop, spineBottom, streets, yardRows };
  paintCells(layout);
  return layout;
}

/**
 * How many rows? With R rows of total length L, a region is about L / R wide
 * and 5·R tall (band + street + yard per row); R = √(L / 5) would make it
 * square. Dividing by 7 instead keeps regions a bit wider than tall, which
 * suits the wide camera.
 */
function chooseRowCount(items: readonly RowItem[]): number {
  if (items.length === 0) return 0;
  return Math.max(1, Math.round(Math.sqrt(sideLength(items) / 7)));
}

/** Cuts the (path-ordered) lots into rows of similar width. */
function splitIntoRows(items: RowItem[], rowCount: number): RowItem[][] {
  if (items.length === 0) return [];
  const sizeOf = (it: RowItem) => it.gap + it.lot.w;
  const target = items.reduce((sum, it) => sum + sizeOf(it), 0) / rowCount;
  const rows: RowItem[][] = [[]];
  let length = 0;
  for (const item of items) {
    const current = rows[rows.length - 1];
    // Start a new row once this one is "full" (counting half of the next house to round fairly).
    if (current.length > 0 && length + sizeOf(item) / 2 > target && rows.length < rowCount) {
      rows.push([item]);
      length = sizeOf(item);
    } else {
      current.push(item);
      length += sizeOf(item);
    }
  }
  return rows;
}

/** Splits a row into the part left of the spine and the part right of it, as evenly as possible. */
function splitAroundSpine(items: RowItem[]): Row {
  const total = sideLength(items);
  let best = 0;
  let bestImbalance = Infinity;
  let prefix = 0;
  for (let k = 0; k <= items.length; k++) {
    const imbalance = Math.abs(prefix - (total - prefix));
    if (imbalance < bestImbalance) {
      bestImbalance = imbalance;
      best = k;
    }
    if (k < items.length) prefix += items[k].gap + items[k].lot.w;
  }
  return { left: items.slice(0, best), right: items.slice(best) };
}

/** Columns one side of a row needs: each lot plus its gap. */
function sideLength(items: readonly RowItem[]): number {
  return items.reduce((sum, it) => sum + it.gap + it.lot.w, 0);
}

/**
 * Puts one row's lots on the map. Left-half lots are packed from the spine
 * outwards (right to left), right-half lots from the spine outwards (left to
 * right); both halves may drift outwards a little for variety. Every lot's
 * bottom edge lines up with the street (or one tile above it, for set-back
 * houses).
 */
function placeRow(
  row: Row,
  spineX: number,
  streetY: number,
  leftExtent: number,
  rightExtent: number,
  rng: Rng,
): PlacedLot[] {
  const placed: PlacedLot[] = [];
  const leftDrift = randInt(rng, 0, Math.min(2, leftExtent - sideLength(row.left)));
  const rightDrift = randInt(rng, 0, Math.min(2, rightExtent - sideLength(row.right)));

  let cursor = spineX - leftDrift; // exclusive right edge of the free space
  const leftPlaced: PlacedLot[] = [];
  for (let i = row.left.length - 1; i >= 0; i--) {
    const item = row.left[i];
    const x = cursor - item.gap - item.lot.w;
    leftPlaced.unshift(placeLot(item, x, streetY));
    cursor = x;
  }
  placed.push(...leftPlaced);

  cursor = spineX + 1 + rightDrift; // first free column right of the spine
  for (const item of row.right) {
    const x = cursor + item.gap;
    placed.push(placeLot(item, x, streetY));
    cursor = x + item.lot.w;
  }
  return placed;
}

function placeLot(item: RowItem, x: number, streetY: number): PlacedLot {
  const bottom = streetY - 1 - item.setback;
  const y = bottom - item.lot.h + 1;
  // Door column: the centre, or the left-of-centre column for even widths.
  const door = { x: x + Math.floor((item.lot.w - 1) / 2), y: bottom + 1 };
  return { lot: item.lot, x, y, door };
}

/** A row's street runs under all its doors and always touches the spine. */
function streetFor(placed: PlacedLot[], spineX: number, y: number, w: number, rng: Rng): Street {
  if (placed.length === 0) return { y, x0: spineX - 3, x1: spineX + 3 };
  const doorXs = placed.map((b) => b.door.x);
  const x0 = Math.max(PAD, Math.min(spineX, ...doorXs) - randInt(rng, 0, 1));
  const x1 = Math.min(w - 1 - PAD, Math.max(spineX, ...doorXs) + randInt(rng, 0, 1));
  return { y, x0, x1 };
}

function paintCells(layout: BlockLayout): void {
  const set = (x: number, y: number, cell: CellId) => {
    layout.cells[y * layout.w + x] = cell;
  };
  if (layout.plaza) {
    const p = layout.plaza;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) set(x, y, Cell.Plaza);
  }
  for (const s of layout.streets) for (let x = s.x0; x <= s.x1; x++) set(x, s.y, Cell.Street);
  for (let y = layout.spineTop; y <= layout.spineBottom; y++) {
    if (layout.cells[y * layout.w + layout.spineX] === Cell.Grass) set(layout.spineX, y, Cell.Street);
  }
  // Set-back houses get a one-tile doorstep path down to the street.
  for (const b of layout.lots) {
    if (layout.cells[b.door.y * layout.w + b.door.x] === Cell.Grass) set(b.door.x, b.door.y, Cell.Street);
  }
}

/**
 * Extends the street network to the edge of the block on `side` and returns
 * the gate tile just outside it, where a road can attach.
 *
 * - top / bottom: the spine continues straight up / down.
 * - left / right: for the town, the plaza promenade continues sideways;
 *   elsewhere the street closest to the block's vertical middle does.
 */
export function openGate(layout: BlockLayout, side: Side): Gate {
  const tiles: Point[] = [];
  const pave = (x: number, y: number) => {
    const i = y * layout.w + x;
    if (layout.cells[i] !== Cell.Grass) return;
    layout.cells[i] = Cell.Street;
    tiles.push({ x, y });
  };

  if (side === "top" || side === "bottom") {
    const x = layout.spineX;
    if (side === "top") {
      for (let y = layout.spineTop - 1; y >= 0; y--) pave(x, y);
      return { side, point: { x, y: -1 }, tiles };
    }
    for (let y = layout.spineBottom + 1; y < layout.h; y++) pave(x, y);
    return { side, point: { x, y: layout.h }, tiles };
  }

  const { y, x0, x1 } = gateRow(layout);
  if (side === "left") {
    for (let x = x0 - 1; x >= 0; x--) pave(x, y);
    return { side, point: { x: -1, y }, tiles };
  }
  for (let x = x1 + 1; x < layout.w; x++) pave(x, y);
  return { side, point: { x: layout.w, y }, tiles };
}

/** The horizontal walkway that side gates branch off from. */
function gateRow(layout: BlockLayout): Street {
  if (layout.plaza) {
    const p = layout.plaza;
    return { y: p.y + PLAZA_PROMENADE_ROW, x0: p.x, x1: p.x + p.w - 1 };
  }
  const middle = layout.h / 2;
  return layout.streets.reduce((best, s) => (Math.abs(s.y - middle) < Math.abs(best.y - middle) ? s : best));
}
