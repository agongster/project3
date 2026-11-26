/**
 * The EVAL SERPENT's moves (eval / exec / shell injection). See boss.ts.
 *
 *   orbs  – it rears up, then spits a slow fan of orbs at the hero
 *           (3, or 5 when enraged). Walking sideways slips between them.
 *   sweep – a red ring grows on the floor around it, then its tail sweeps
 *           the whole ring. Step outside the ring and you are safe.
 */
import type { MonsterWorld } from "./brain";
import type { BossMove, MovePhase } from "./boss";
import type { Monster } from "./monster";
import { drawWarningRing } from "./telegraphs";

const ORB_COUNT = 3;
const ENRAGED_ORB_COUNT = 5;
/** Angle between neighbouring orbs (radians). */
const ORB_SPREAD = 0.32;
const ORB_SPEED = 55;
const ORB_LIFE_SEC = 3.5;
/** Half-hearts. */
const ORB_DAMAGE = 1;
const REAR_UP_STRETCH = 0.25;

const SWEEP_RADIUS_PX = 40;
/** Half-hearts. */
const SWEEP_DAMAGE = 1;
const SWEEP_SHAKE = 0.3;

export class OrbFanMove implements BossMove {
  /** Backs off first: the fan spreads out with distance, leaving gaps to step into. */
  readonly range = 72;
  readonly windup = 0.9;
  readonly act = 0.3;
  readonly rest = 1.3;

  begin(m: Monster, world: MonsterWorld): void {
    m.stretch = REAR_UP_STRETCH;
    m.alert = this.windup;
    world.fx.sfx("shoot", { pitch: 0.5, volume: 0.4 });
  }

  release(m: Monster, world: MonsterWorld, enraged: boolean): void {
    const count = enraged ? ENRAGED_ORB_COUNT : ORB_COUNT;
    const aim = m.heroAngle();
    for (let i = 0; i < count; i++) {
      const a = aim + (i - (count - 1) / 2) * ORB_SPREAD;
      world.fireHostile({ x: m.x, y: m.y - 2, vx: Math.cos(a) * ORB_SPEED, vy: Math.sin(a) * ORB_SPEED, damage: ORB_DAMAGE, sprite: "orb", radius: 5, life: ORB_LIFE_SEC }, m);
    }
    world.fx.sfx("shoot", { pitch: 0.7 });
  }
}

export class TailSweepMove implements BossMove {
  readonly range = 28;
  readonly windup = 1;
  readonly act = 0.35;
  readonly rest = 1.4;

  begin(_m: Monster, world: MonsterWorld): void {
    world.fx.sfx("swing", { pitch: 0.4, volume: 0.5 });
  }

  release(m: Monster, world: MonsterWorld): void {
    world.fx.sfx("swing", { pitch: 0.55 });
    world.fx.shake(SWEEP_SHAKE);
    world.fx.dust(m.x, m.y, 8);
    if (m.heroDistance() <= SWEEP_RADIUS_PX) world.hurtHero(SWEEP_DAMAGE, m.x, m.y, m);
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster, phase: MovePhase, progress: number): void {
    drawWarningRing(g, m.x, m.y, SWEEP_RADIUS_PX, phase === "act" ? 1 : progress, m.anim);
  }
}
