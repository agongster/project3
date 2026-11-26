/**
 * TANK — the Spaghetti Beast (functions too complex to follow).
 *
 *   calm ──► walk ──(close)──► windup (ring on the floor) ──► flail ──► recover ──► walk …
 *
 * Big, slow and hard to push around (it takes only 30% knockback, see
 * monster.ts). When the hero is close it winds up for a long time while a
 * red ring on the floor shows how far its noodles reach, then flails them
 * all around. Stepping out of the ring is all it takes. Every hit knocks a
 * noodle or two loose (pure decoration).
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld, type Pose } from "./brain";
import type { Monster } from "./monster";
import { Wander } from "./moves";
import { StateClock } from "./stateClock";
import { drawWarningRing } from "./telegraphs";

const FLAIL_TRIGGER_PX = 30;
const WINDUP_SEC = 1.3;
const FLAIL_SEC = 0.45;
/** Reach of the flail, measured from its feet to the hero's feet. */
const FLAIL_RADIUS_PX = 30;
const RECOVER_SEC = 1.6;
/** Half-hearts. */
const FLAIL_DAMAGE = 1;
const FLAIL_FPS = 14;
const FLAIL_SHAKE = 0.25;
const CALM_WANDER_SPEED = 0.4;

type State = "calm" | "walk" | "windup" | "flail" | "recover";

export class TankBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<State>("calm");
  private readonly wander = new Wander(CALM_WANDER_SPEED);

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    m.shiver = this.clock.is("windup");
    m.dizzy = this.clock.is("recover");
    if (!m.engaged) {
      if (!this.clock.is("calm")) this.clock.go("calm");
      this.wander.update(m, world, dt);
      return;
    }
    switch (this.clock.state) {
      case "calm":
        this.clock.go("walk");
        break;
      case "walk":
        m.walkToward(world.hero.x, world.hero.y, m.def.speed);
        if (m.heroDistance() <= FLAIL_TRIGGER_PX && world.mayAttack) {
          this.clock.go("windup", WINDUP_SEC);
          m.alert = WINDUP_SEC;
        }
        break;
      case "windup":
        m.stop();
        if (this.clock.done) this.flail(m, world);
        break;
      case "flail":
        if (this.clock.done) this.clock.go("recover", RECOVER_SEC);
        break;
      case "recover":
        if (this.clock.done) this.clock.go("walk");
        break;
    }
  }

  onHit(m: Monster, world: MonsterWorld): void {
    world.fx.noodles(m.x, m.y - 12, 1 + Math.floor(world.random() * 2));
  }

  reset(m: Monster): void {
    this.clock.go("calm");
    this.wander.reset();
    m.shiver = m.dizzy = false;
  }

  harmful(): boolean {
    return this.clock.is("walk", "flail");
  }

  committed(): boolean {
    return this.clock.is("windup", "flail");
  }

  pose(m: Monster): Pose | null {
    return this.clock.is("flail") ? { frame: Math.floor(m.anim * FLAIL_FPS) } : null;
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.clock.is("windup")) drawWarningRing(g, m.x, m.y, FLAIL_RADIUS_PX, this.clock.progress, m.anim);
    else if (this.clock.is("flail")) drawWarningRing(g, m.x, m.y, FLAIL_RADIUS_PX, 1, m.anim);
  }

  /** The whole ring is hit once, at the start of the flail. */
  private flail(m: Monster, world: MonsterWorld): void {
    m.stop();
    this.clock.go("flail", FLAIL_SEC);
    world.fx.sfx("slam", { pitch: 0.8 });
    world.fx.shake(FLAIL_SHAKE);
    world.fx.noodles(m.x, m.y - 10, 3);
    if (m.heroDistance() <= FLAIL_RADIUS_PX) world.hurtHero(FLAIL_DAMAGE, m.x, m.y, m);
  }
}
