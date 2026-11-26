/**
 * SHY FLIGHT: a Shy monster (src/lib/game/monsterModifiers.ts) runs off for
 * a moment the first time a hit brings its health down to FLEE_AT_SHARE,
 * then comes back and fights on. It is the hero's cue that the monster is
 * nearly beaten, and a breather for both.
 *
 *   hit to low health ──► (waits until its attack, if any, is over)
 *     ──► runs away for FLEE_SEC, harmless ──► its brain starts afresh
 *
 * It runs once per fight: after the hero faints it may run again.
 */
import type { MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { pickEscapeAngle } from "./steering";

/** Runs when its health drops to this share of the maximum or below. */
const FLEE_AT_SHARE = 0.4;
const FLEE_SEC = 1.2;
/** Its walking speed while running away is multiplied by this. */
const FLEE_SPEED_MULT = 1.5;

export class ShyFlight {
  /** Seconds of running left (0 = not running). */
  private left = 0;
  private angle = 0;
  /** It wants to run but waits for its committed attack to end. */
  private pending = false;
  private used = false;

  get fleeing(): boolean {
    return this.left > 0;
  }

  /** After a hit that left it standing. */
  onHurt(m: Monster): void {
    if (!this.used && m.hp <= m.maxHp * FLEE_AT_SHARE) this.pending = true;
  }

  /**
   * Each step before its brain thinks: true while it runs away (the brain is
   * switched off meanwhile). A telegraphed attack is never cut short.
   */
  update(m: Monster, world: MonsterWorld, dt: number): boolean {
    if (this.pending && !m.brain.committed?.(m)) this.start(m, world);
    if (this.left <= 0) return false;
    this.left -= dt;
    const speed = m.def.speed * FLEE_SPEED_MULT;
    m.vx = Math.cos(this.angle) * speed;
    m.vy = Math.sin(this.angle) * speed;
    if (this.left <= 0) m.stop();
    return true;
  }

  /** The hero fainted: calm again, and it may run once more in the next fight. */
  reset(): void {
    this.left = 0;
    this.pending = false;
    this.used = false;
  }

  private start(m: Monster, world: MonsterWorld): void {
    this.pending = false;
    this.used = true;
    this.left = FLEE_SEC;
    this.angle = pickEscapeAngle(m.x, m.y, world.hero.x, world.hero.y, m.fitsAt);
    // Its brain drops whatever it was doing, so it comes back with a fresh plan.
    m.brain.reset(m);
    m.shiver = m.dizzy = false;
    m.stretch = 0.3;
    world.fx.dust(m.x, m.y, 2);
    world.fx.floatText(m.x, m.y - m.def.size, "Eek!", "info");
  }
}
