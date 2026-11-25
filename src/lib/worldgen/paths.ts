/**
 * Shortest-path searches used to lay roads and streams (Dijkstra's
 * algorithm over the tile grid).
 *
 * Roads are 2 tiles wide, so the road search moves a 2×2 "brush" instead of a
 * single tile, and it charges extra for every turn: that makes roads run in
 * long straight stretches with a few clean bends, like a hand-drawn map.
 * Existing roads are cheap to walk along, so later roads join earlier ones
 * and the network grows like a tree out of Town Square.
 */
import type { Point } from "@/lib/types";
import { DIRS4 } from "./grid";

/** A binary min-heap of (value, priority) pairs; values are state indices. */
export class MinHeap {
  private readonly priorities: number[] = [];
  private readonly values: number[] = [];

  get size(): number {
    return this.values.length;
  }

  push(value: number, priority: number): void {
    const p = this.priorities;
    const v = this.values;
    let i = v.length;
    p.push(priority);
    v.push(value);
    // Sift up: swap with the parent while we are cheaper than it.
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (p[parent] <= priority) break;
      p[i] = p[parent];
      v[i] = v[parent];
      i = parent;
    }
    p[i] = priority;
    v[i] = value;
  }

  /** Removes and returns the cheapest entry. Only call when size > 0. */
  pop(): { value: number; priority: number } {
    const p = this.priorities;
    const v = this.values;
    const top = { value: v[0], priority: p[0] };
    const lastP = p.pop() as number;
    const lastV = v.pop() as number;
    const n = v.length;
    if (n > 0) {
      // Sift down: move the last entry from the root to where it belongs.
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && p[child + 1] < p[child]) child++;
        if (p[child] >= lastP) break;
        p[i] = p[child];
        v[i] = v[child];
        i = child;
      }
      p[i] = lastP;
      v[i] = lastV;
    }
    return top;
  }
}

// ───────────────────────────── Roads ────────────────────────────

export interface RoadSearch {
  width: number;
  height: number;
  /** 1 = no road may cover this tile (inside a region, the border forest, ...). */
  blocked: Uint8Array;
  /** Extra cost for covering this tile (e.g. hugging a region's edge). */
  extraCost: Float32Array;
  /** 1 = the road is finished once its brush touches this tile (existing road, town gate). */
  goal: Uint8Array;
  /** 1 = already road: cheap to reuse, so roads merge instead of running side by side. */
  road: Uint8Array;
}

/** Cost of one turn, in "tiles walked". */
const TURN_PENALTY = 4;
/** Cost of a step along an existing road. */
const REUSE_COST = 0.35;
/** Direction index meaning "the road has not moved yet". */
const NO_DIR = 4;

/**
 * Finds the cheapest 2-wide road from `start` to any goal tile. Returns the
 * top-left corners of the 2×2 brush along the way, or null if no road fits.
 */
export function findRoad(search: RoadSearch, start: Point): Point[] | null {
  const { width, height, blocked, extraCost, goal, road } = search;
  const stride = NO_DIR + 1; // states per tile: arrived going up/right/down/left, or not moved yet
  const dist = new Float64Array(width * height * stride).fill(Infinity);
  const prev = new Int32Array(width * height * stride).fill(-1);
  const heap = new MinHeap();

  const brushTiles = (x: number, y: number) => [y * width + x, y * width + x + 1, (y + 1) * width + x, (y + 1) * width + x + 1];

  // Precompute, for every brush position, whether it fits and what stepping onto it costs.
  const fits = new Uint8Array(width * height);
  const stepCost = new Float32Array(width * height);
  for (let y = 0; y + 1 < height; y++) {
    for (let x = 0; x + 1 < width; x++) {
      const tiles = brushTiles(x, y);
      if (tiles.some((i) => blocked[i])) continue;
      fits[y * width + x] = 1;
      const base = tiles.every((i) => road[i]) ? REUSE_COST : 1;
      stepCost[y * width + x] = base + Math.max(...tiles.map((i) => extraCost[i]));
    }
  }
  const brushFits = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && fits[y * width + x] === 1;
  const brushCost = (x: number, y: number) => stepCost[y * width + x];

  // Start from every brush position that covers the start tile.
  for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const x = start.x + ox;
    const y = start.y + oy;
    if (!brushFits(x, y)) continue;
    const s = (y * width + x) * stride + NO_DIR;
    dist[s] = 0;
    heap.push(s, 0);
  }

  while (heap.size > 0) {
    const { value: state, priority } = heap.pop();
    if (priority > dist[state]) continue; // stale heap entry
    const tile = Math.floor(state / stride);
    const dir = state % stride;
    const x = tile % width;
    const y = (tile - x) / width;
    if (brushTiles(x, y).some((i) => goal[i])) return traceBack(prev, state, stride, width);

    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS4[d].x;
      const ny = y + DIRS4[d].y;
      if (!brushFits(nx, ny)) continue;
      const turn = dir !== NO_DIR && dir !== d ? TURN_PENALTY : 0;
      const next = (ny * width + nx) * stride + d;
      const cost = priority + brushCost(nx, ny) + turn;
      if (cost < dist[next]) {
        dist[next] = cost;
        prev[next] = state;
        heap.push(next, cost);
      }
    }
  }
  return null;
}

function traceBack(prev: Int32Array, end: number, stride: number, width: number): Point[] {
  const out: Point[] = [];
  for (let s = end; s !== -1; s = prev[s]) {
    const tile = Math.floor(s / stride);
    out.push({ x: tile % width, y: Math.floor(tile / width) });
  }
  return out.reverse();
}

// ──────────────────────────── Streams ───────────────────────────

/**
 * Plain single-tile Dijkstra from any of `sources` to the first tile where
 * `isGoal` is true. `stepCost(index)` is the price of entering a tile
 * (Infinity = forbidden). Used for the stream, whose noisy costs make it
 * meander.
 */
export function cheapestPath(
  width: number,
  height: number,
  sources: readonly Point[],
  stepCost: (index: number) => number,
  isGoal: (index: number) => boolean,
): Point[] | null {
  const dist = new Float64Array(width * height).fill(Infinity);
  const prev = new Int32Array(width * height).fill(-1);
  const heap = new MinHeap();
  for (const s of sources) {
    const i = s.y * width + s.x;
    dist[i] = 0;
    heap.push(i, 0);
  }
  while (heap.size > 0) {
    const { value: i, priority } = heap.pop();
    if (priority > dist[i]) continue;
    if (isGoal(i)) return traceBack(prev, i, 1, width);
    const x = i % width;
    const y = (i - x) / width;
    for (const d of DIRS4) {
      const nx = x + d.x;
      const ny = y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      const cost = priority + stepCost(ni);
      if (cost < dist[ni]) {
        dist[ni] = cost;
        prev[ni] = i;
        heap.push(ni, cost);
      }
    }
  }
  return null;
}
