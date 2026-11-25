/**
 * The one interface the attack system knows about.
 *
 * Anything the hero can hit (bushes, pots, crates, and later monsters)
 * implements `Hittable` and adds itself to the scene's `ctx.hittables` set.
 * The attack code only asks "where are you, how big are you, are you
 * alive?" and calls `takeHit`; what happens next (break into leaves, lose
 * HP, die and drop coins) is the target's own business.
 */

/** Where a hit came from (lets a target react differently, e.g. ignore pet pecks). */
export type HitSource = "weapon" | "projectile" | "pet" | "thorns";

export interface HitInfo {
  /** Half-hearts of damage (already doubled for crits). */
  damage: number;
  /** Knockback as a displacement in pixels (direction × weapon knockback). */
  knockbackX: number;
  knockbackY: number;
  crit: boolean;
  source: HitSource;
}

export interface Hittable {
  /** World position of the target's centre (on the ground). */
  x: number;
  y: number;
  /** Hit radius in pixels. */
  radius: number;
  alive: boolean;
  /**
   * "monster" targets get the full hit juice (damage numbers, hit-stop) and
   * attract auto-aim from any direction; "object"s (bushes, pots) only when
   * they are roughly in front of the hero.
   */
  kind: "monster" | "object";
  takeHit(hit: HitInfo): void;
}
