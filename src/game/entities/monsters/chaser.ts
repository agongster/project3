/**
 * CHASER — the Gremlin (plain old bugs).
 *
 *   calm ──► chase ──(2 tiles away)──► windup ──► lunge ──► recover ──► chase …
 *
 * It walks toward the hero. About two tiles away it stops, wiggles with a
 * "!" while a red lane shows exactly where it will go, then lunges 2.5
 * tiles in that straight line — and needs a long breather afterwards
 * (dizzy stars), which is the moment to strike back.
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { Wander } from "./moves";
import { StateClock } from "./stateClock";
import { clearDistance } from "./steering";
import { drawWarningLane } from "./telegraphs";

/** Starts winding up when the hero is this close. */
const LUNGE_TRIGGER_PX = 32;
const WINDUP_SEC = 0.75;
const LUNGE_DISTANCE_PX = 40;
const LUNGE_SEC = 0.3;
const LUNGE_HOP_PX = 4;
const RECOVER_SEC = 1.5;
const LANE_WIDTH_PX = 10;
const CALM_WANDER_SPEED = 0.4;

type State = "calm" | "chase" | "windup" | "lunge" | "recover";

export class ChaserBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<State>("calm");
  private readonly wander = new Wander(CALM_WANDER_SPEED);
  private lungeAngle = 0;
  /** How far the lunge can really go (it stops short of walls). */
  private lungeLength = 0;

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    m.shiver = this.clock.is("windup");
    m.dizzy = this.clock.is("recover");
    if (!m.engaged) {
      if (!this.clock.is("calm")) this.calmDown(m);
      this.wander.update(m, world, dt);
      return;
    }
    switch (this.clock.state) {
      case "calm":
        this.clock.go("chase");
        break;
      case "chase":
        m.walkToward(world.hero.x, world.hero.y, m.def.speed);
        if (m.heroDistance() <= LUNGE_TRIGGER_PX && world.mayAttack) this.startWindup(m);
        break;
      case "windup":
        m.stop();
        if (this.clock.done) this.startLunge(world);
        break;
      case "lunge":
        this.lunge(m, world);
        break;
      case "recover":
        m.stop();
        if (this.clock.done) this.clock.go("chase");
        break;
    }
  }

  reset(m: Monster): void {
    this.calmDown(m);
    this.wander.reset();
  }

  harmful(): boolean {
    return this.clock.is("chase", "lunge");
  }

  committed(): boolean {
    return this.clock.is("windup", "lunge");
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster): void {
    if (!this.clock.is("windup")) return;
    const x1 = m.x + Math.cos(this.lungeAngle) * this.lungeLength;
    const y1 = m.y + Math.sin(this.lungeAngle) * this.lungeLength;
    drawWarningLane(g, m.x, m.y - 2, x1, y1 - 2, LANE_WIDTH_PX, this.clock.progress, m.anim);
  }

  private calmDown(m: Monster): void {
    this.clock.go("calm");
    m.z = 0;
    m.shiver = m.dizzy = false;
  }

  /** The direction is locked NOW, so the lane on the floor is exactly where it will go. */
  private startWindup(m: Monster): void {
    this.lungeAngle = m.heroAngle();
    this.lungeLength = clearDistance(m.x, m.y, this.lungeAngle, m.fitsAt, LUNGE_DISTANCE_PX);
    this.clock.go("windup", WINDUP_SEC);
    m.alert = WINDUP_SEC;
    m.stop();
  }

  private startLunge(world: MonsterWorld): void {
    this.clock.go("lunge", LUNGE_SEC);
    world.fx.sfx("swing", { pitch: 0.75 });
  }

  private lunge(m: Monster, world: MonsterWorld): void {
    const speed = LUNGE_DISTANCE_PX / LUNGE_SEC;
    m.vx = Math.cos(this.lungeAngle) * speed;
    m.vy = Math.sin(this.lungeAngle) * speed;
    m.z = Math.sin(Math.PI * this.clock.progress) * LUNGE_HOP_PX;
    if (!this.clock.done) return;
    m.stop();
    m.z = 0;
    m.stretch = -0.3;
    world.fx.dust(m.x, m.y, 3);
    this.clock.go("recover", RECOVER_SEC);
  }
}
