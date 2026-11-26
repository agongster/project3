/**
 * SKITTER — the Todo Mite (TODO comments, commented-out code).
 *
 *   calm ──(notices you)──► flee ──► breather ──(you come close)──► flee …
 *
 * It never deals damage: it is a chase, not a fight. It runs AWAY in short
 * panicky bursts (a bit slower than the hero) and then has to stop and
 * catch its breath, sweating — that is when you catch it.
 *
 * Escape directions come from `pickEscapeAngle`, which prefers open floor,
 * so the mite runs into the room instead of pressing into a corner forever.
 * It also stays within MITE_LEASH_PX of home, so it never leaves its room.
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { Wander } from "./moves";
import { jitter, StateClock } from "./stateClock";
import { clearDistance, distance, pickEscapeAngle, type FreeFn } from "./steering";

const FLEE_SEC = 0.55;
/** 48 × 1.3 ≈ 62 px/s, while the hero walks at 80 px/s. */
const FLEE_SPEED_MULT = 1.3;
const BREATHER_SEC: [number, number] = [1.1, 1.5];
/** After a breather it only runs again if the hero is this close. */
const PANIC_RADIUS_PX = 64;
/** The mite treats this circle around home as the edge of its world. */
const MITE_LEASH_PX = 88;
/** Mid-burst, a wall closer than this makes it pick a new direction. */
const REROUTE_CLEAR_PX = 8;
const CALM_WANDER_SPEED = 0.35;
const SWEAT_EVERY_SEC = 0.35;
const SWEAT_COLORS = ["#8fd3ff", "#ffffff"];

type State = "calm" | "flee" | "breather";

export class SkitterBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = false;
  readonly facesMovement = true;
  private readonly clock = new StateClock<State>("calm");
  private readonly wander = new Wander(CALM_WANDER_SPEED);
  private angle = 0;
  private sweatClock = 0;

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    if (!m.engaged) {
      if (!this.clock.is("calm")) this.clock.go("calm");
      this.wander.update(m, world, dt);
      return;
    }
    switch (this.clock.state) {
      case "calm":
        this.startFleeing(m, world);
        break;
      case "flee":
        this.flee(m, world);
        break;
      case "breather":
        this.catchBreath(m, world, dt);
        break;
    }
  }

  reset(): void {
    this.clock.go("calm");
    this.wander.reset();
  }

  harmful(): boolean {
    return false;
  }

  /** Open floor within the leash around home. */
  private canRunTo(m: Monster): FreeFn {
    return (px, py) => m.fitsAt(px, py) && distance(px, py, m.homeX, m.homeY) <= MITE_LEASH_PX;
  }

  private startFleeing(m: Monster, world: MonsterWorld): void {
    this.angle = pickEscapeAngle(m.x, m.y, world.hero.x, world.hero.y, this.canRunTo(m));
    this.clock.go("flee", FLEE_SEC);
    world.fx.dust(m.x, m.y, 2);
  }

  private flee(m: Monster, world: MonsterWorld): void {
    if (this.clock.done) {
      m.stop();
      this.clock.go("breather", jitter(...BREATHER_SEC, world.random));
      return;
    }
    if (clearDistance(m.x, m.y, this.angle, this.canRunTo(m), REROUTE_CLEAR_PX) < REROUTE_CLEAR_PX) {
      this.angle = pickEscapeAngle(m.x, m.y, world.hero.x, world.hero.y, this.canRunTo(m));
    }
    const speed = m.def.speed * FLEE_SPEED_MULT;
    m.vx = Math.cos(this.angle) * speed;
    m.vy = Math.sin(this.angle) * speed;
  }

  private catchBreath(m: Monster, world: MonsterWorld, dt: number): void {
    m.stop();
    this.sweatClock += dt;
    if (this.sweatClock >= SWEAT_EVERY_SEC) {
      this.sweatClock = 0;
      world.fx.bits(m.x, m.y - 12, 1, SWEAT_COLORS);
    }
    if (this.clock.done && m.heroDistance() < PANIC_RADIUS_PX) this.startFleeing(m, world);
  }
}
