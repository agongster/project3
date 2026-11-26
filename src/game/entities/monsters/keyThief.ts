/**
 * The KEY THIEF's moves (hardcoded secrets). See boss.ts for the fight frame.
 *
 *   dash  – a red lane appears on the floor, then it dashes along it in a
 *           straight line (only touching it hurts).
 *   keys  – it jangles its key ring, then scatters a ring of slow spinning
 *           keys outward. Gaps between the keys are wide enough to walk through.
 */
import type { MonsterWorld } from "./brain";
import type { BossMove, MovePhase } from "./boss";
import type { Monster } from "./monster";
import { clearDistance } from "./steering";
import { drawWarningLane } from "./telegraphs";

const DASH_SPEED = 220;
const DASH_MAX_PX = 96;
const DASH_LANE_WIDTH_PX = 18;
const DASH_DUST_EVERY_PX = 12;
const DASH_STOP_SHAKE = 0.2;

const KEY_COUNT = 6;
const ENRAGED_KEY_COUNT = 8;
const KEY_SPEED = 55;
const KEY_LIFE_SEC = 3.2;
/** Half-hearts. */
const KEY_DAMAGE = 1;

export class DashMove implements BossMove {
  readonly range = 56;
  readonly windup = 0.9;
  readonly act = DASH_MAX_PX / DASH_SPEED + 0.1;
  readonly rest = 1.4;
  private angle = 0;
  private length = 0;
  private traveled = 0;
  private dustAt = 0;

  /** The lane is locked when the wind-up starts: it shows exactly where the dash goes. */
  begin(m: Monster, world: MonsterWorld): void {
    this.angle = m.heroAngle();
    this.length = clearDistance(m.x, m.y, this.angle, m.fitsAt, DASH_MAX_PX);
    world.fx.sfx("dash", { pitch: 0.6, volume: 0.5 });
  }

  release(m: Monster, world: MonsterWorld): void {
    this.traveled = 0;
    this.dustAt = 0;
    world.fx.sfx("dash", { pitch: 0.8 });
    world.fx.dust(m.x, m.y, 4);
  }

  step(m: Monster, world: MonsterWorld, dt: number): boolean {
    if (this.traveled >= this.length) {
      m.stop();
      world.fx.dust(m.x, m.y, 5);
      world.fx.shake(DASH_STOP_SHAKE);
      return true;
    }
    m.vx = Math.cos(this.angle) * DASH_SPEED;
    m.vy = Math.sin(this.angle) * DASH_SPEED;
    this.traveled += DASH_SPEED * dt;
    if (this.traveled >= this.dustAt) {
      this.dustAt += DASH_DUST_EVERY_PX;
      world.fx.dust(m.x, m.y, 1);
    }
    return false;
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster, phase: MovePhase, progress: number): void {
    if (phase !== "windup") return;
    const x1 = m.x + Math.cos(this.angle) * this.length;
    const y1 = m.y + Math.sin(this.angle) * this.length;
    drawWarningLane(g, m.x, m.y - 3, x1, y1 - 3, DASH_LANE_WIDTH_PX, progress, m.anim);
  }
}

export class KeyScatterMove implements BossMove {
  readonly range = 44;
  readonly windup = 0.8;
  readonly act = 0.3;
  readonly rest = 1.3;

  begin(m: Monster, world: MonsterWorld): void {
    world.fx.sfx("coin", { pitch: 0.6 });
    m.alert = this.windup;
  }

  /** A ring of keys flying outward, turned randomly so the gaps move around. */
  release(m: Monster, world: MonsterWorld, enraged: boolean): void {
    const count = enraged ? ENRAGED_KEY_COUNT : KEY_COUNT;
    const turn = world.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = turn + (i / count) * Math.PI * 2;
      world.fireHostile({ x: m.x, y: m.y - 2, vx: Math.cos(a) * KEY_SPEED, vy: Math.sin(a) * KEY_SPEED, damage: KEY_DAMAGE, sprite: "key", life: KEY_LIFE_SEC }, m);
    }
    world.fx.sfx("shoot", { pitch: 0.8 });
  }
}
