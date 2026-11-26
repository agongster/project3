/**
 * Small movement building blocks that several brains share:
 *
 *  - `Wander`: calm pottering about near home while the hero is away
 *    (and walking back home after the hero ran off or fainted).
 *  - `Hop`: a short jump with an arc and squash & stretch (Dust Bunny,
 *    Mimic, Swallow Toad).
 */
import type { MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { jitter, StateClock } from "./stateClock";
import { clearDistance } from "./steering";

/** Calm monsters stay within this distance of home (px); further away they walk back. */
const HOME_LEASH_PX = 24;
/** Walking home is a little brisker than pottering about. */
const RETURN_SPEED_MULT = 0.8;
const WANDER_PAUSE_SEC: [number, number] = [1.2, 2.8];
const WANDER_WALK_SEC: [number, number] = [0.35, 0.8];
/** A wander step is skipped when a wall is closer than this in that direction. */
const WANDER_MIN_CLEAR_PX = 12;

/** Stretch on take-off and squash on landing (see Monster.stretch). */
const TAKEOFF_STRETCH = 0.3;
const LANDING_SQUASH = -0.35;
const LANDING_DUST = 2;

export class Wander {
  private readonly clock = new StateClock<"pause" | "walk">("pause", 1);
  private angle = 0;

  /** `speedMult` scales the monster's catalog speed while pottering about. */
  constructor(private readonly speedMult: number) {}

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    if (m.homeDistance() > HOME_LEASH_PX) {
      m.walkToward(m.homeX, m.homeY, m.def.speed * RETURN_SPEED_MULT);
      return;
    }
    if (this.clock.is("pause")) {
      m.stop();
      if (this.clock.done) this.startWalk(m, world);
      return;
    }
    const speed = m.def.speed * this.speedMult;
    m.vx = Math.cos(this.angle) * speed;
    m.vy = Math.sin(this.angle) * speed;
    if (this.clock.done) this.clock.go("pause", jitter(...WANDER_PAUSE_SEC, world.random));
  }

  reset(): void {
    this.clock.go("pause", 1);
  }

  private startWalk(m: Monster, world: MonsterWorld): void {
    this.angle = world.random() * Math.PI * 2;
    const clear = clearDistance(m.x, m.y, this.angle, m.fitsAt, WANDER_MIN_CLEAR_PX);
    if (clear < WANDER_MIN_CLEAR_PX) {
      this.clock.go("pause", jitter(...WANDER_PAUSE_SEC, world.random));
      return;
    }
    this.clock.go("walk", jitter(...WANDER_WALK_SEC, world.random));
  }
}

export class Hop {
  /** True while in the air. */
  active = false;
  private elapsed = 0;
  private duration = 0;
  private height = 0;
  private dirX = 0;
  private dirY = 0;
  private speed = 0;

  /** Jumps along `angle` at `speed` px/s for `duration` seconds, peaking `height` px up. */
  start(m: Monster, angle: number, speed: number, duration: number, height: number): void {
    this.active = true;
    this.elapsed = 0;
    this.duration = duration;
    this.height = height;
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.speed = speed;
    m.stretch = TAKEOFF_STRETCH;
  }

  /** Advances the hop. Returns true on the step it lands. */
  update(m: Monster, world: MonsterWorld, dt: number): boolean {
    if (!this.active) return false;
    this.elapsed += dt;
    const k = Math.min(1, this.elapsed / this.duration);
    m.vx = this.dirX * this.speed;
    m.vy = this.dirY * this.speed;
    m.z = Math.sin(Math.PI * k) * this.height;
    if (k < 1) return false;
    this.land(m, world);
    return true;
  }

  /** Stops the hop at once (the hero fainted, the monster died…). */
  cancel(m: Monster): void {
    this.active = false;
    m.z = 0;
    m.stop();
  }

  private land(m: Monster, world: MonsterWorld): void {
    this.active = false;
    m.z = 0;
    m.stop();
    m.stretch = LANDING_SQUASH;
    world.fx.dust(m.x, m.y, LANDING_DUST);
  }
}
