/**
 * Attack geometry: pure maths, no drawing, no game state. Unit-tested in
 * tests/engine/attacks.test.ts.
 *
 * Every attack style becomes a HIT SHAPE in world pixels:
 *
 *   swing  → "arc":    a pie slice in front of the hero (110° wide)
 *   thrust → "line":   a long thin strip from the hero toward the aim
 *   slam   → "circle": a disc at arm's length
 *   nova   → "ring":   a band between two radii around the hero (it grows)
 *   projectile / boomerang → a small "circle" that travels
 *
 * A target is hit when its circle (centre + radius) touches the shape, so
 * big monsters are easier to hit than tiny ones, as you would expect.
 */
import type { AttackStyle } from "@/lib/game/catalog";

/** The parts of a Hittable the geometry needs. */
export interface Target {
  x: number;
  y: number;
  radius: number;
  kind: "monster" | "object";
  alive: boolean;
}

export type HitShape =
  | { type: "arc"; cx: number; cy: number; radius: number; aim: number; halfArc: number }
  | { type: "line"; cx: number; cy: number; aim: number; length: number; halfWidth: number }
  | { type: "circle"; cx: number; cy: number; radius: number }
  | { type: "ring"; cx: number; cy: number; inner: number; outer: number };

/** Half of the 110° swing arc. */
export const SWING_HALF_ARC = (55 * Math.PI) / 180;
/** Half-width of a thrust's strip. */
export const THRUST_HALF_WIDTH = 6;
/** Auto-aim looks this much further than the weapon reaches. */
export const AUTO_AIM_EXTRA_PX = 28;
/** Objects (bushes, pots) only attract auto-aim inside this half-angle of the facing direction. */
export const OBJECT_AIM_HALF_ANGLE = (75 * Math.PI) / 180;
/** The slam lands this fraction of the weapon range in front of the hero. */
export const SLAM_REACH = 0.55;
/** Targets closer than this are hit by a swing whatever the angle (hugging a monster still works). */
const POINT_BLANK_PX = 6;

/** Smallest angle between two directions, 0…π. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs(((a - b) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/**
 * Auto-aim: picks what an attack should point at.
 *
 * - Living monsters within `range + AUTO_AIM_EXTRA_PX` count in ANY
 *   direction (the game should be easy: you never miss because you faced
 *   the wrong way).
 * - Objects only count when they are roughly in front of the hero, so
 *   swinging at a monster never gets "stolen" by a bush behind you.
 * - Monsters win over objects; among equals the nearest wins.
 * Returns null when nothing is in reach (then the hero attacks where they face).
 */
export function chooseAimTarget<T extends Target>(px: number, py: number, facing: number, targets: Iterable<T>, range: number): T | null {
  const reach = range + AUTO_AIM_EXTRA_PX;
  let best: T | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const dist = Math.hypot(t.x - px, t.y - py) - t.radius;
    if (dist > reach) continue;
    if (t.kind === "object" && dist > 2 && angleBetween(Math.atan2(t.y - py, t.x - px), facing) > OBJECT_AIM_HALF_ANGLE) continue;
    // Objects get a big penalty so any monster in reach is preferred.
    const score = dist + (t.kind === "object" ? 1000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

/** The hit shape of a melee attack style (projectiles and boomerangs use their own small circle). */
export function meleeShape(style: AttackStyle, px: number, py: number, aim: number, range: number): HitShape | null {
  switch (style) {
    case "swing":
      return { type: "arc", cx: px, cy: py, radius: range, aim, halfArc: SWING_HALF_ARC };
    case "thrust":
      return { type: "line", cx: px, cy: py, aim, length: range, halfWidth: THRUST_HALF_WIDTH };
    case "slam":
      return { type: "circle", cx: px + Math.cos(aim) * range * SLAM_REACH, cy: py + Math.sin(aim) * range * SLAM_REACH, radius: range * 0.75 };
    case "nova":
      return { type: "ring", cx: px, cy: py, inner: 0, outer: range };
    default:
      return null;
  }
}

/** Does `shape` touch target `t`? */
export function shapeHits(shape: HitShape, t: Target): boolean {
  const dx = t.x - shape.cx;
  const dy = t.y - shape.cy;
  const dist = Math.hypot(dx, dy);
  switch (shape.type) {
    case "circle":
      return dist <= shape.radius + t.radius;
    case "ring":
      return dist + t.radius >= shape.inner && dist - t.radius <= shape.outer;
    case "arc": {
      if (dist > shape.radius + t.radius) return false;
      if (dist <= POINT_BLANK_PX + t.radius) return true;
      // Widen the arc by the angle the target's radius covers at that distance.
      const slack = Math.asin(Math.min(1, t.radius / dist));
      return angleBetween(Math.atan2(dy, dx), shape.aim) <= shape.halfArc + slack;
    }
    case "line": {
      // Project the target onto the strip's axis.
      const ux = Math.cos(shape.aim);
      const uy = Math.sin(shape.aim);
      const along = dx * ux + dy * uy;
      const across = Math.abs(-dx * uy + dy * ux);
      return along >= -t.radius && along <= shape.length + t.radius && across <= shape.halfWidth + t.radius;
    }
  }
}
