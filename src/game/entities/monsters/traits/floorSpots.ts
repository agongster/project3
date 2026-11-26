/**
 * FREE FLOOR near a monster, found at run time, for the things a trait puts
 * down in the dungeon: the Phantom's rune, the Echo Bat's echo.
 *
 * Rooms can have interior walls, pillars, pots and alcoves, so nothing here
 * assumes an empty room. A tile qualifies when it is
 *   - open floor right now (no wall, solid prop or unbroken pot),
 *   - reachable on foot from the entrance (a flood fill over open tiles),
 *   - not the entrance safe zone, the exit doormat, the chest spot or the
 *     tile its arrow floats over, and
 *   - not under any prop, not a monster's starting tile, not already taken.
 * Among those, the nearest tile within the asked range wins, preferring
 * tiles the monster can see; a tile under a floor carving only wins when
 * no clear tile is as near.
 *
 * Pure (the map comes in as plain data and functions), unit-tested in
 * tests/engine/monsterTraits.test.ts.
 */
import type { Dungeon, Point, Rect } from "@/lib/types";
import { hasLineOfSight } from "../steering";

const TILE = 16;
/** The safe zone reaches this many tiles from the entrance (matches sceneWorld.ts). */
const SAFE_ZONE_REACH_TILES = 1;
/** Score penalty (in tiles) for a spot the monster can't see: a wall between them reads as unrelated. */
const UNSEEN_PENALTY = 4;
/** Score penalty for a spot under a floor carving: a clear spot this much further away still wins. */
const CARVING_PENALTY = 0.75;

/** What the spot finder needs to know about a dungeon. */
export interface SpotMap {
  width: number;
  height: number;
  /** Can the hero stand on this tile right now? */
  isOpen(tx: number, ty: number): boolean;
  /** Terrain that blocks sight (walls, void). */
  isWall(tx: number, ty: number): boolean;
  entrance: Point;
  exit: Point;
  chest: Point;
  /** Tiles nothing may be put on: every monster's starting tile and every prop. */
  occupied: readonly Point[];
  /** Floor carvings (world px boxes, see scenes/floorCodeLayout.ts). */
  carvings: readonly Rect[];
}

/** Distance band in tiles from the monster's tile. */
export interface SpotRange {
  min: number;
  max: number;
}

/** A SpotMap for a generated dungeon, with `isOpen` supplied by the caller (the scene knows which pots are broken). */
export function dungeonSpotMap(dungeon: Dungeon, isOpen: SpotMap["isOpen"], carvings: readonly Rect[]): SpotMap {
  const isWall = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height || dungeon.solid[ty * dungeon.width + tx] === 1;
  const occupied = [...dungeon.monsters.map((m) => ({ x: m.x, y: m.y })), ...dungeon.props.map((p) => ({ x: p.x, y: p.y }))];
  return { width: dungeon.width, height: dungeon.height, isOpen, isWall, entrance: dungeon.entrance, exit: dungeon.exit, chest: dungeon.chest, occupied, carvings };
}

export class FloorSpots {
  private readonly reachable: Uint8Array;
  private readonly taken = new Set<number>();

  constructor(private readonly map: SpotMap) {
    this.reachable = floodFill(map);
    for (const p of map.occupied) this.taken.add(this.index(p.x, p.y));
  }

  /** True when a rune or an echo may go on this tile (and nothing has taken it yet). */
  isFree(tx: number, ty: number): boolean {
    const { map } = this;
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
    return this.reachable[this.index(tx, ty)] === 1 && map.isOpen(tx, ty) && !this.taken.has(this.index(tx, ty)) && !this.isReserved(tx, ty);
  }

  /** The best free tile within `range` of tile (tx, ty), which is then taken; null when there is none. */
  claimNear(tx: number, ty: number, range: SpotRange): Point | null {
    let best: Point | null = null;
    let bestScore = Infinity;
    const reach = Math.ceil(range.max);
    for (let y = ty - reach; y <= ty + reach; y++) {
      for (let x = tx - reach; x <= tx + reach; x++) {
        const d = Math.hypot(x - tx, y - ty);
        if (d < range.min || d > range.max || !this.isFree(x, y)) continue;
        const score = d + (this.sees(tx, ty, x, y) ? 0 : UNSEEN_PENALTY) + (this.underCarving(x, y) ? CARVING_PENALTY : 0);
        if (score < bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    if (best) this.taken.add(this.index(best.x, best.y));
    return best;
  }

  private index(tx: number, ty: number): number {
    return ty * this.map.width + tx;
  }

  /** The safe zone, the exit doormat, the chest spot and the tile above it (its arrow). */
  private isReserved(tx: number, ty: number): boolean {
    const { entrance, exit, chest } = this.map;
    const inSafeZone = Math.abs(tx - entrance.x) <= SAFE_ZONE_REACH_TILES && Math.abs(ty - entrance.y) <= SAFE_ZONE_REACH_TILES;
    const isExit = tx === exit.x && ty === exit.y;
    const isChest = tx === chest.x && (ty === chest.y || ty === chest.y - 1);
    return inSafeZone || isExit || isChest;
  }

  private sees(ax: number, ay: number, bx: number, by: number): boolean {
    const clear = (px: number, py: number) => !this.map.isWall(Math.floor(px / TILE), Math.floor(py / TILE));
    return hasLineOfSight(ax * TILE + TILE / 2, ay * TILE + TILE / 2, bx * TILE + TILE / 2, by * TILE + TILE / 2, clear);
  }

  private underCarving(tx: number, ty: number): boolean {
    const x = tx * TILE;
    const y = ty * TILE;
    return this.map.carvings.some((c) => c.x < x + TILE && x < c.x + c.w && c.y < y + TILE && y < c.y + c.h);
  }
}

/** 1 for every open tile the hero can walk to from the entrance (4-way steps), 0 elsewhere. */
function floodFill(map: SpotMap): Uint8Array {
  const seen = new Uint8Array(map.width * map.height);
  const start = map.entrance;
  if (!map.isOpen(start.x, start.y)) return seen;
  const queue: Point[] = [start];
  seen[start.y * map.width + start.x] = 1;
  while (queue.length > 0) {
    const { x, y } = queue.pop()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const i = ny * map.width + nx;
      if (seen[i] === 1 || !map.isOpen(nx, ny)) continue;
      seen[i] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}
