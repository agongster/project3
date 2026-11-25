/**
 * Small helpers for row-major tile grids and rectangles.
 *
 * A TileMap stores its tiles in flat Uint8Arrays (index = y * width + x)
 * because that is compact and fast. These helpers hide the index arithmetic
 * so the generators can talk in plain (x, y) coordinates.
 */
import type { GroundId, Point, Rect, TileMap } from "@/lib/types";

/** The four walking directions: up, right, down, left. */
export const DIRS4: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** A width × height map where every tile has the same ground and solidity. */
export function createTileMap(width: number, height: number, ground: GroundId, solid: boolean): TileMap {
  const size = width * height;
  return {
    width,
    height,
    ground: new Uint8Array(size).fill(ground),
    solid: new Uint8Array(size).fill(solid ? 1 : 0),
  };
}

export function inBounds(map: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** Sets the ground and collision of one tile. */
export function setTile(map: TileMap, x: number, y: number, ground: GroundId, solid: boolean): void {
  const i = y * map.width + x;
  map.ground[i] = ground;
  map.solid[i] = solid ? 1 : 0;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/**
 * True when two rectangles overlap, or come closer than `gap` free tiles.
 * With gap = 0 this is a plain overlap test.
 */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x - gap < b.x + b.w && b.x - gap < a.x + a.w && a.y - gap < b.y + b.h && b.y - gap < a.y + a.h;
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** "King's move" distance: how many steps a piece that may move diagonally needs. */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Every tile of a rectangle, row by row. */
export function tilesOf(r: Rect): Point[] {
  const out: Point[] = [];
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
  }
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
