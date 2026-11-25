/**
 * "Can the player actually walk there?"
 *
 * Both generators finish by proving that every important tile (doors, the
 * dungeon exit, every monster...) can be reached on foot. This file holds the
 * breadth-first searches used for that proof and for repairing worlds where
 * decorations accidentally blocked the way.
 */
import type { Point, Prop, TileMap } from "@/lib/types";
import { DIRS4, inBounds } from "./grid";

/**
 * Flood fill over walkable tiles, moving only up/down/left/right.
 *
 * A tile is blocked when `map.solid` says so or when it appears in
 * `extraSolid` (pass the solid props and NPC tiles here: the `solid` mask
 * only covers terrain and building footprints).
 *
 * Returns a mask of the map's size: 1 = reachable from `start`. If `start`
 * itself is blocked or outside the map, nothing is reachable.
 */
export function reachableFrom(map: TileMap, start: Point, extraSolid?: Iterable<Point>): Uint8Array {
  const { width, height } = map;
  const blocked = map.solid.slice();
  if (extraSolid) {
    for (const p of extraSolid) {
      if (inBounds(map, p.x, p.y)) blocked[p.y * width + p.x] = 1;
    }
  }

  const seen = new Uint8Array(width * height);
  if (!inBounds(map, start.x, start.y) || blocked[start.y * width + start.x]) return seen;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = start.y * width + start.x;
  seen[start.y * width + start.x] = 1;

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i - x) / width;
    for (const d of DIRS4) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (seen[ni] || blocked[ni]) continue;
      seen[ni] = 1;
      queue[tail++] = ni;
    }
  }
  return seen;
}

/**
 * Shortest 4-neighbour walk from `start` to `goal`, or null if there is none.
 * `isBlocked(index)` decides which tiles may not be stepped on (the goal tile
 * itself is always allowed). Used by the repair steps to find which
 * decorations stand in the way.
 */
export function findWalkPath(
  map: { width: number; height: number },
  start: Point,
  goal: Point,
  isBlocked: (index: number) => boolean,
): Point[] | null {
  const { width, height } = map;
  const startIndex = start.y * width + start.x;
  const goalIndex = goal.y * width + goal.x;
  const parent = new Int32Array(width * height).fill(-1);
  parent[startIndex] = startIndex;

  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;

  while (head < tail) {
    const i = queue[head++];
    if (i === goalIndex) break;
    const x = i % width;
    const y = (i - x) / width;
    for (const d of DIRS4) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (parent[ni] !== -1) continue;
      if (ni !== goalIndex && isBlocked(ni)) continue;
      parent[ni] = i;
      queue[tail++] = ni;
    }
  }

  if (parent[goalIndex] === -1) return null;
  const path: Point[] = [];
  for (let i = goalIndex; i !== startIndex; i = parent[i]) {
    path.push({ x: i % width, y: Math.floor(i / width) });
  }
  path.push({ x: start.x, y: start.y });
  return path.reverse();
}

/**
 * Repair step shared by both generators: makes every target reachable from
 * `start` by removing decorations that wall it off.
 *
 * For each unreachable target we look for a walk that ignores *removable*
 * blockers (bushes, trees, pots...) but still respects terrain and fixed
 * blockers (landmarks, signs, villagers), then delete the removable blockers
 * on that walk. Returns false if some target cannot be reached even then:
 * that means the terrain itself is broken and the caller should retry.
 */
export function clearBlockedPaths(
  map: TileMap,
  start: Point,
  targets: readonly Point[],
  blockers: () => Point[],
  isRemovable: (p: Point) => boolean,
  remove: (p: Point) => void,
): boolean {
  let reach = reachableFrom(map, start, blockers());
  for (const target of targets) {
    if (!inBounds(map, target.x, target.y)) return false;
    if (reach[target.y * map.width + target.x]) continue;

    const blocked = new Map<number, Point>();
    for (const b of blockers()) blocked.set(b.y * map.width + b.x, b);
    const path = findWalkPath(map, start, target, (i) => {
      if (map.solid[i]) return true;
      const b = blocked.get(i);
      return b !== undefined && !isRemovable(b);
    });
    if (!path) return false;
    for (const p of path) {
      if (blocked.has(p.y * map.width + p.x)) remove(p);
    }
    reach = reachableFrom(map, start, blockers());
    if (!reach[target.y * map.width + target.x]) return false;
  }
  return true;
}

/** Base tiles of every solid prop: what the player bumps into besides terrain. */
export function solidPropTiles(props: readonly Prop[]): Point[] {
  return props.filter((p) => p.solid).map((p) => ({ x: p.x, y: p.y }));
}
