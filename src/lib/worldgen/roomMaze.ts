/**
 * Branch mazes: the interior walls of one room, decided by how branchy its
 * function is. Straight-line code gets an open room; every `if`, `for`,
 * `while`, `except`… makes it a little more tangled:
 *
 *     level 0  (0–1 branches)   open room
 *     level 1  (2–4)            two pillars, alcoves
 *     level 2  (5–8)            a partition wall, a pillar, alcoves
 *     level 3  (9–14)           two partitions (the path snakes), alcoves, a pillar
 *     level 4  (15+)            an island the path splits around, partitions,
 *                               alcoves, a pillar
 *
 * Positions are in ROOM-LOCAL tiles: (0, 0) is the room's top-left floor
 * tile, (w-1, h-1) its bottom-right one; the room's own walls lie outside.
 *
 * The maze must never make the game annoying, so every wall piece is tried
 * and kept only if the room stays open (see `roomIsOpen`):
 *   - all floor stays connected (every monster and the chest stay reachable)
 *   - every floor tile lies in a 2×2 square of floor: no passage is ever
 *     narrower than 2 tiles, where the hero and monsters fight
 *   - tiles the caller keeps clear (doors, the entrance zone, the chest's
 *     spot, the plaque's reading spot) stay floor
 *   - walls cover at most MAX_WALL_SHARE of the room, leaving space to fight
 * and by construction: free-standing pieces keep 2 tiles from the room's
 * walls (so corridor mouths and a ring around the room stay open),
 * partitions leave at least a PARTITION_GAP-tile gap at their far end, and
 * sections between partitions are at least SECTION_MIN_W wide — rooms, not
 * dead-end corridors. Alcoves are only STUB_DEPTH tiles deep. Every piece is at
 * least 2 tiles tall, so it always shows a wall top above its face.
 */
import type { Point } from "@/lib/types";
import { randInt, type Rng } from "@/lib/rng";

/** Branch counts at which a room reaches maze level 1, 2, 3 and 4. */
export const MAZE_LEVEL_BRANCHES = [2, 5, 9, 15];
/** Walls may cover at most this share of a room's floor. */
export const MAX_WALL_SHARE = 0.2;
/** A partition stops at least this many tiles short of the opposite wall… */
const PARTITION_GAP = 3;
/** …and is at least this long (shorter ones would just be stubs). */
const MIN_PARTITION_LEN = 3;
/** Floor on either side of a partition is at least this wide. */
const SECTION_MIN_W = 4;
/** Alcoves (between stubs jutting from a wall) are this deep… */
const STUB_DEPTH = 2;
/** …and stubs stand this far apart. */
const STUB_SPACING = 3;
/** Free-standing pieces keep at least this many floor tiles to the room's walls. */
const RING = 2;
/** The split-and-rejoin island is this long at most. */
const MAX_ISLAND_LEN = 6;
/** Random spots tried for a pillar, alcoves or island before giving up on it. */
const RANDOM_SPOTS = 12;

type PieceKind = "pillar" | "partition" | "alcoves" | "island";

/** The pieces each maze level tries to place, in order. */
const RECIPES: readonly (readonly PieceKind[])[] = [
  [],
  ["pillar", "pillar", "alcoves"],
  ["partition", "pillar", "alcoves"],
  ["partition", "partition", "alcoves", "pillar"],
  ["island", "partition", "partition", "alcoves", "pillar"],
];

/** 0 for straight-line code up to MAZE_LEVEL_BRANCHES.length for the most tangled functions. */
export function mazeLevel(branches: number): number {
  return MAZE_LEVEL_BRANCHES.filter((threshold) => branches >= threshold).length;
}

/** A room being furnished: its size, its walls (by local index) and what must stay clear. */
interface RoomGrid {
  w: number;
  h: number;
  walls: Set<number>;
  keptClear: (x: number, y: number) => boolean;
  /** Columns of the partitions placed so far. */
  partitions: { x: number; fromTop: boolean }[];
}

/**
 * The interior walls of a w × h room at `level` (room-local tiles, row by
 * row). `keptClear(x, y)` marks tiles that must stay floor. Each piece of
 * the level's recipe goes to the first of its candidate spots that keeps
 * the room open, or is left out when none does.
 */
export function planInteriorWalls(w: number, h: number, level: number, keptClear: (x: number, y: number) => boolean, rng: Rng): Point[] {
  const grid: RoomGrid = { w, h, walls: new Set(), keptClear, partitions: [] };
  for (const kind of RECIPES[Math.min(level, RECIPES.length - 1)]) {
    const piece = candidates(kind, grid, rng).find((p) => tryAdd(grid, p));
    if (piece && kind === "partition") grid.partitions.push({ x: piece[0].x, fromTop: piece[0].y === 0 });
  }
  return [...grid.walls].sort((a, b) => a - b).map((i) => ({ x: i % w, y: Math.floor(i / w) }));
}

// ───────────────────────────── pieces ─────────────────────────────

function block(x: number, y: number, w: number, h: number): Point[] {
  const out: Point[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

/** Spots to try for one piece, best first (empty when the room is too small for it). */
function candidates(kind: PieceKind, grid: RoomGrid, rng: Rng): Point[][] {
  const { w, h } = grid;
  const random = (make: () => Point[]) => Array.from({ length: RANDOM_SPOTS }, make);
  switch (kind) {
    case "pillar": {
      // A 2×2 block standing free in the middle of the floor.
      if (w < 2 * RING + 2 || h < 2 * RING + 2) return [];
      return random(() => block(randInt(rng, RING, w - RING - 2), randInt(rng, RING, h - RING - 2), 2, 2));
    }
    case "partition": {
      // A 1-wide wall from the top or bottom wall, stopping PARTITION_GAP short of the other side.
      // The first stands near a third of the way across, the next near two thirds, alternating
      // top/bottom: two of them make the path snake through the room.
      // Where monsters leave no space for a full partition, a shorter one (at least MIN_PARTITION_LEN) will do.
      if (h < PARTITION_GAP + MIN_PARTITION_LEN) return [];
      const target = ((grid.partitions.length + 1) * w) / 3;
      const previous = grid.partitions[grid.partitions.length - 1];
      const fromTop = previous ? !previous.fromTop : rng() < 0.5;
      const columns = partitionColumns(grid).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      const lengths = Array.from({ length: h - PARTITION_GAP - MIN_PARTITION_LEN + 1 }, (_, i) => h - PARTITION_GAP - i);
      // Longest first; for each length the columns nearest the target, the preferred side first.
      return lengths.flatMap((length) => columns.flatMap((x) => [fromTop, !fromTop].map((top) => block(x, top ? 0 : h - length, 1, length))));
    }
    case "alcoves": {
      // Short stubs jutting from the bottom wall: shallow side alcoves between them.
      const count = randInt(rng, 2, 3);
      const span = (count - 1) * STUB_SPACING;
      if (w - 2 * RING - 1 < span || h < STUB_DEPTH + 2 * RING + 1) return [];
      return random(() => {
        const x0 = randInt(rng, RING, w - RING - 1 - span);
        return Array.from({ length: count }, (_, i) => block(x0 + i * STUB_SPACING, h - STUB_DEPTH, 1, STUB_DEPTH)).flat();
      });
    }
    case "island": {
      // A long 2-tall block across the middle: the path splits into two lanes and joins again.
      const maxLen = Math.min(MAX_ISLAND_LEN, w - 2 * RING - 2);
      if (maxLen < 4 || h < 2 * RING + 2) return [];
      const y = Math.floor((h - 2) / 2);
      return random(() => {
        const length = randInt(rng, 4, maxLen);
        return block(randInt(rng, RING, w - RING - length), y, length, 2);
      });
    }
  }
}

/**
 * Columns a partition may use: SECTION_MIN_W from the side walls, more than
 * SECTION_MIN_W from other partitions (so the sections between them are
 * rooms, not corridors), and clear of other walls by a column.
 */
function partitionColumns(grid: RoomGrid): number[] {
  const { w, h, walls } = grid;
  const columnHasWall = (x: number) => Array.from({ length: h }, (_, y) => y).some((y) => walls.has(y * w + x));
  const out: number[] = [];
  for (let x = SECTION_MIN_W; x <= w - 1 - SECTION_MIN_W; x++) {
    if (grid.partitions.some((p) => Math.abs(p.x - x) <= SECTION_MIN_W)) continue;
    if (columnHasWall(x - 1) || columnHasWall(x) || columnHasWall(x + 1)) continue;
    out.push(x);
  }
  return out;
}

/** Adds the piece if the room stays open with it; otherwise leaves the room unchanged. */
function tryAdd(grid: RoomGrid, piece: readonly Point[]): boolean {
  const { w, h, walls } = grid;
  if (piece.some((p) => p.x < 0 || p.y < 0 || p.x >= w || p.y >= h || walls.has(p.y * w + p.x) || grid.keptClear(p.x, p.y))) return false;
  if (walls.size + piece.length > MAX_WALL_SHARE * w * h) return false;
  const next = new Set(walls);
  for (const p of piece) next.add(p.y * w + p.x);
  if (!roomIsOpen(w, h, next)) return false;
  for (const p of piece) walls.add(p.y * w + p.x);
  return true;
}

// ───────────────────────────── the safety check ─────────────────────────────

/**
 * True when a w × h room with these interior walls (local indices) is
 * connected and has no passage narrower than 2 tiles: every floor tile is
 * part of at least one 2×2 square of floor.
 */
export function roomIsOpen(w: number, h: number, walls: ReadonlySet<number>): boolean {
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !walls.has(y * w + x);
  let floorCount = 0;
  let start = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!floor(x, y)) continue;
      floorCount++;
      if (start === -1) start = y * w + x;
      const inSquare = [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ].some(([sx, sy]) => floor(x + sx, y + sy) && floor(x + sx + 1, y + sy) && floor(x + sx, y + sy + 1) && floor(x + sx + 1, y + sy + 1));
      if (!inSquare) return false;
    }
  }
  if (start === -1) return false;
  // Flood fill (4 directions) from the first floor tile: it must reach all of them.
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.pop() as number;
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const ni = ny * w + nx;
      if (floor(nx, ny) && !seen.has(ni)) {
        seen.add(ni);
        queue.push(ni);
      }
    }
  }
  return seen.size === floorCount;
}
