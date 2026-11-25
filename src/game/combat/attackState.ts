/**
 * The data of one running attack and the timing of each attack style.
 * Shared by the attack logic (attacks.ts) and the drawing (weaponFx.ts).
 */
import type { AttackStyle, WeaponDef } from "@/lib/game/catalog";
import type { Hittable } from "./hittable";

/**
 * Timing of each style, in seconds. `hitFrom`/`hitTo` are fractions of the
 * duration during which the hit shape is live (a slam only hits at its
 * impact moment, `hitFrom`; projectiles hit on their own, so never).
 */
export const STYLE_TIMING: Record<AttackStyle, { duration: number; hitFrom: number; hitTo: number }> = {
  swing: { duration: 0.18, hitFrom: 0, hitTo: 0.65 },
  thrust: { duration: 0.17, hitFrom: 0.1, hitTo: 0.7 },
  projectile: { duration: 0.14, hitFrom: 2, hitTo: 2 },
  boomerang: { duration: 0.14, hitFrom: 2, hitTo: 2 },
  slam: { duration: 0.34, hitFrom: 0.45, hitTo: 0.45 },
  nova: { duration: 0.32, hitFrom: 0, hitTo: 1 },
};

export interface ActiveAttack {
  weapon: WeaponDef;
  /** Direction of the attack in radians. */
  aim: number;
  age: number;
  duration: number;
  /** +1 / -1: swings alternate direction, which looks lively. */
  sweep: number;
  /** Targets already hit by this attack (each is hit at most once). */
  hit: Set<Hittable>;
  /** Slam only: the impact already happened. */
  impactDone: boolean;
}
