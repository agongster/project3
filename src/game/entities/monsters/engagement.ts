/**
 * The rules that keep every fight fair, applied to all the monsters of a
 * dungeon each step (by the director, and by the headless tests):
 *
 *  - NOTICING: a calm monster notices the hero when they come within its
 *    notice radius AND it can see them (no wall in between). At most
 *    MAX_PURSUERS monsters chase the hero at once; the rest stay calm until
 *    the hero walks right up to them. Only one boss fights at a time — a
 *    second boss dozes ("zzz") until the first is beaten. Any other monster
 *    that gets hit always joins in.
 *  - FORGETTING: an engaged monster that loses the hero (out of sight, too
 *    far, or too far from home) for FORGET_AFTER_SEC calms down and goes home.
 *  - SEPARATION: monsters push each other apart so they never stack up.
 *  - CONTACT DAMAGE: bumping into a monster that is "harmful" right now
 *    costs its catalog `touchDamage` (1 half-heart for regular monsters,
 *    0 for the Todo Mite), and it bounces back.
 */
import type { MonsterWorld } from "./brain";
import { ALERT_SEC, type Monster } from "./monster";
import { distance } from "./steering";

export const MAX_PURSUERS = 3;
/** Walking this close to a calm monster always wakes it, even when MAX_PURSUERS are already busy. */
const CLOSE_WAKE_PX = 28;
/** Engaged monsters lose interest beyond this distance from the hero… */
const FORGET_RADIUS_PX = 144;
/** …or this far from home… */
const LEASH_PX = 160;
/** …once it has lasted this long. */
const FORGET_AFTER_SEC = 2;
/** Eyes and the hero's middle are this far above the feet (for line of sight). */
const EYE_HEIGHT_PX = 4;
/** The hero's body counts as a circle this big for contact. */
const HERO_RADIUS_PX = 5;
/** Monster bodies count a bit smaller than their hit radius for contact (be kind). */
const CONTACT_SHRINK = 0.8;
/** Two monsters may overlap up to this share of their summed radii. */
const SEPARATION_GAP = 0.9;
/** A small hop of surprise when noticing the hero. */
const NOTICE_STRETCH = 0.25;

function sees(m: Monster, world: MonsterWorld): boolean {
  return world.canSee(m.x, m.y - EYE_HEIGHT_PX, world.hero.x, world.hero.y - EYE_HEIGHT_PX);
}

function engage(m: Monster, world: MonsterWorld): void {
  m.engaged = true;
  m.provoked = false;
  m.sleepy = false;
  m.lostSightFor = 0;
  m.alert = ALERT_SEC;
  m.stretch = NOTICE_STRETCH;
  m.brain.onNotice?.(m, world);
}

/** Noticing and forgetting. `heroActive` is false while the hero lies fainted. */
export function updateEngagement(monsters: readonly Monster[], world: MonsterWorld, heroActive: boolean, dt: number): void {
  const living = monsters.filter((m) => m.alive);
  let pursuers = living.filter((m) => m.engaged && m.brain.pursues).length;
  let bossFighting = living.some((m) => m.engaged && m.isBoss);

  for (const m of living) {
    if (m.engaged) {
      const lost = !sees(m, world) || m.heroDistance() > FORGET_RADIUS_PX || m.homeDistance() > LEASH_PX;
      m.lostSightFor = lost ? m.lostSightFor + dt : 0;
      if (!heroActive || m.lostSightFor >= FORGET_AFTER_SEC) {
        m.engaged = false;
        m.lostSightFor = 0;
      }
      continue;
    }
    if (!heroActive) continue;
    // A dozing boss waits for its turn even when poked (the hits still count).
    if (m.isBoss && bossFighting) {
      m.provoked = false;
      continue;
    }
    if (!m.provoked) {
      const d = m.heroDistance();
      if (d > m.brain.noticeRadius || !sees(m, world)) continue;
      if (m.brain.pursues && pursuers >= MAX_PURSUERS && d > CLOSE_WAKE_PX) continue;
    }
    engage(m, world);
    if (m.brain.pursues) pursuers++;
    if (m.isBoss) bossFighting = true;
  }

  // A boss waiting for its turn dozes.
  for (const m of living) if (m.isBoss && !m.engaged) m.sleepy = bossFighting;
}

/** Pushes overlapping monsters apart (each moves half the overlap, walls still apply). */
export function separate(monsters: readonly Monster[]): void {
  const bodies = monsters.filter((m) => m.alive && m.targetable);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const d = distance(a.x, a.y, b.x, b.y);
      const min = (a.radius + b.radius) * SEPARATION_GAP;
      if (d >= min) continue;
      // Exactly on top of each other: split them sideways.
      const nx = d > 1e-3 ? (b.x - a.x) / d : 1;
      const ny = d > 1e-3 ? (b.y - a.y) / d : 0;
      const push = (min - d) / 2;
      a.moveBy(-nx * push, -ny * push);
      b.moveBy(nx * push, ny * push);
    }
  }
}

/** Hurts the hero when they touch a harmful monster; the monster bounces back. */
export function applyContactDamage(monsters: readonly Monster[], world: MonsterWorld): void {
  if (!world.mayAttack) return;
  const hero = world.hero;
  for (const m of monsters) {
    if (!m.alive || !m.engaged || m.def.touchDamage <= 0 || !m.brain.harmful(m)) continue;
    if (distance(m.x, m.y, hero.x, hero.y) > m.radius * CONTACT_SHRINK + HERO_RADIUS_PX) continue;
    if (world.hurtHero(m.def.touchDamage, m.x, m.y, m)) m.recoil(hero.x, hero.y);
  }
}
