/**
 * Steering maths for monsters: directions, "how far can I run this way?",
 * picking an escape route, figure-eights, line of sight and finding a free
 * spot to teleport to.
 *
 * Pure functions: the map is passed in as `isFree(px, py)` (true when a
 * world pixel is open to the monster), so everything here is unit-tested in
 * tests/engine/monsters.test.ts without a browser.
 */

export interface Vec {
  x: number;
  y: number;
}

/** "Can I stand on this world pixel?" */
export type FreeFn = (px: number, py: number) => boolean;

/** Distances are sampled every this many pixels (well under a tile). */
const SAMPLE_PX = 4;

/** Escape-route scoring: how much open space ahead counts vs. pointing away from the threat. */
const ESCAPE_OPEN_WEIGHT = 1;
const ESCAPE_AWAY_WEIGHT = 0.8;
/** Routes that run into a wall sooner than this get a big penalty (that is how monsters end up cornered). */
const ESCAPE_MIN_CLEAR_PX = 20;
const ESCAPE_DIRECTIONS = 16;
const ESCAPE_LOOKAHEAD_PX = 64;

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Unit vector from one point toward another (zero when they coincide). */
export function directionTo(fromX: number, fromY: number, toX: number, toY: number): Vec {
  const d = Math.hypot(toX - fromX, toY - fromY);
  return d > 1e-6 ? { x: (toX - fromX) / d, y: (toY - fromY) / d } : { x: 0, y: 0 };
}

/** How far one can travel from (x, y) along `angle` before hitting something (capped at `max`). */
export function clearDistance(x: number, y: number, angle: number, isFree: FreeFn, max: number): number {
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  for (let d = SAMPLE_PX; d <= max; d += SAMPLE_PX) {
    if (!isFree(x + cx * d, y + cy * d)) return d - SAMPLE_PX;
  }
  return max;
}

/**
 * Picks the direction a fleeing monster should run (radians).
 *
 * Every one of ESCAPE_DIRECTIONS candidate directions gets a score:
 *   + how much open floor lies ahead (so it runs into the room, not a corner)
 *   + how much it points away from the threat
 * Directions that hit a wall almost at once are heavily penalised, so a
 * monster backed into a corner slips out sideways instead of pressing into
 * the wall forever.
 */
export function pickEscapeAngle(x: number, y: number, threatX: number, threatY: number, isFree: FreeFn, lookahead = ESCAPE_LOOKAHEAD_PX): number {
  const away = Math.atan2(y - threatY, x - threatX);
  let best = away;
  let bestScore = -Infinity;
  for (let i = 0; i < ESCAPE_DIRECTIONS; i++) {
    const angle = away + (i / ESCAPE_DIRECTIONS) * Math.PI * 2;
    const clear = clearDistance(x, y, angle, isFree, lookahead);
    const awayness = Math.cos(angle - away); // 1 = straight away, -1 = straight at the threat
    let score = (clear / lookahead) * ESCAPE_OPEN_WEIGHT + awayness * ESCAPE_AWAY_WEIGHT;
    if (clear < ESCAPE_MIN_CLEAR_PX) score -= 2;
    if (score > bestScore) {
      bestScore = score;
      best = angle;
    }
  }
  return best;
}

/**
 * A point on a figure-eight centred on (0, 0): `t` is the phase in radians,
 * `w` the full width and `h` the full height of the loop.
 */
export function figureEight(t: number, w: number, h: number): Vec {
  return { x: (Math.sin(t) * w) / 2, y: (Math.sin(2 * t) * h) / 2 };
}

/** True when nothing blocks the straight line between two points. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, isClear: FreeFn): boolean {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / SAMPLE_PX);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isClear(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

/**
 * A random spot between `minR` and `maxR` pixels from (cx, cy) that passes
 * `isGood`, or null after `tries` misses (the caller then stays put).
 */
export function findSpotAround(cx: number, cy: number, minR: number, maxR: number, isGood: FreeFn, random: () => number, tries = 24): Vec | null {
  for (let i = 0; i < tries; i++) {
    const angle = random() * Math.PI * 2;
    const r = minR + (maxR - minR) * random();
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (isGood(x, y)) return { x, y };
  }
  return null;
}
