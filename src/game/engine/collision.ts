/**
 * Moving a box through a grid of solid tiles. Pure functions, unit-tested in
 * tests/engine/collision.test.ts.
 *
 * The hero's hit-box is a small rectangle around their feet. Each step we
 * try to move it by (dx, dy):
 *
 * 1. AXIS BY AXIS. Move along x first, then along y. If x is blocked, y can
 *    still happen: pushing diagonally into a wall makes you SLIDE along it.
 *
 * 2. FLUSH STOPS. When the box would enter a solid tile we snap it so it
 *    touches the tile's edge exactly (no gap, no overlap).
 *
 * 3. NO TUNNELLING. Big moves (a dash) are split into sub-steps shorter than
 *    a tile, so the box can never jump over a thin wall.
 *
 * 4. CORNER NUDGING. If you walk straight into a wall but the opening is
 *    only a few pixels to the side (you clipped a house corner), we slide
 *    you sideways around the corner instead of stopping dead. This is what
 *    makes walking around houses and trees feel smooth instead of sticky.
 */

export const TILE_PX = 16;

/** Pixel rectangle; (x, y) is the top-left corner. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Answers "is tile (tx, ty) solid?" (tiles outside the map should be solid). */
export type SolidTileFn = (tx: number, ty: number) => boolean;

export interface MoveResult {
  x: number;
  y: number;
  /** True when the x / y part of the move was stopped by a wall. */
  blockedX: boolean;
  blockedY: boolean;
}

/** How many pixels a corner may stick into your path and still be nudged around. */
export const DEFAULT_NUDGE_PX = 5;

/** Longest sub-step; must stay below the tile size so walls can't be skipped. */
const MAX_SUBSTEP = 8;

/**
 * A box exactly touching a wall must not count as "inside" it, so the far
 * edges are pulled in by this tiny amount before converting to tiles.
 */
const EDGE_EPS = 1e-6;

/** True when the box overlaps at least one solid tile. */
export function boxHitsSolid(x: number, y: number, w: number, h: number, solid: SolidTileFn): boolean {
  const tx0 = Math.floor(x / TILE_PX);
  const tx1 = Math.floor((x + w - EDGE_EPS) / TILE_PX);
  const ty0 = Math.floor(y / TILE_PX);
  const ty1 = Math.floor((y + h - EDGE_EPS) / TILE_PX);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (solid(tx, ty)) return true;
    }
  }
  return false;
}

/**
 * Moves the box along ONE axis by `delta`, stopping flush against the first
 * solid tile. Returns the new coordinate on that axis.
 */
function sweepAxis(box: Box, axis: "x" | "y", delta: number, solid: SolidTileFn): { pos: number; blocked: boolean } {
  const size = axis === "x" ? box.w : box.h;
  let pos = axis === "x" ? box.x : box.y;
  let remaining = delta;
  const hits = (p: number) => (axis === "x" ? boxHitsSolid(p, box.y, box.w, box.h, solid) : boxHitsSolid(box.x, p, box.w, box.h, solid));

  while (remaining !== 0) {
    const step = Math.max(-MAX_SUBSTEP, Math.min(MAX_SUBSTEP, remaining));
    const next = pos + step;
    if (!hits(next)) {
      pos = next;
      remaining -= step;
      continue;
    }
    // Blocked: the tile we ran into is the one under the box's leading edge.
    if (step > 0) {
      const tile = Math.floor((next + size - EDGE_EPS) / TILE_PX);
      pos = Math.max(pos, tile * TILE_PX - size);
    } else {
      const tile = Math.floor(next / TILE_PX);
      pos = Math.min(pos, (tile + 1) * TILE_PX);
    }
    return { pos, blocked: true };
  }
  return { pos, blocked: false };
}

/**
 * When a move along `axis` (direction `dir` = ±1) is blocked, looks for the
 * smallest sideways shift (up to `maxNudge` px) that would let the box go on.
 * Returns that signed shift, or 0 when the wall is genuinely in the way.
 */
export function findNudge(box: Box, axis: "x" | "y", dir: number, solid: SolidTileFn, maxNudge: number): number {
  for (let d = 1; d <= maxNudge; d++) {
    for (const side of [-1, 1]) {
      const shift = side * d;
      const sx = axis === "x" ? box.x : box.x + shift;
      const sy = axis === "x" ? box.y + shift : box.y;
      const ahead = axis === "x" ? boxHitsSolid(sx + dir, sy, box.w, box.h, solid) : boxHitsSolid(sx, sy + dir, box.w, box.h, solid);
      if (!ahead && !boxHitsSolid(sx, sy, box.w, box.h, solid)) return shift;
    }
  }
  return 0;
}

/**
 * Moves `box` by (dx, dy) with wall sliding and corner nudging.
 * The input box is not modified.
 */
export function moveBox(box: Box, dx: number, dy: number, solid: SolidTileFn, maxNudge: number = DEFAULT_NUDGE_PX): MoveResult {
  const b = { ...box };

  const mx = sweepAxis(b, "x", dx, solid);
  b.x = mx.pos;
  // Clipped a corner while walking purely sideways: slide around it.
  if (mx.blocked && dy === 0 && maxNudge > 0) {
    const shift = findNudge(b, "x", Math.sign(dx), solid, maxNudge);
    if (shift !== 0) b.y = sweepAxis(b, "y", Math.sign(shift) * Math.min(Math.abs(dx), Math.abs(shift)), solid).pos;
  }

  const my = sweepAxis(b, "y", dy, solid);
  b.y = my.pos;
  if (my.blocked && dx === 0 && maxNudge > 0) {
    const shift = findNudge(b, "y", Math.sign(dy), solid, maxNudge);
    if (shift !== 0) b.x = sweepAxis(b, "x", Math.sign(shift) * Math.min(Math.abs(dy), Math.abs(shift)), solid).pos;
  }

  return { x: b.x, y: b.y, blockedX: mx.blocked, blockedY: my.blocked };
}
