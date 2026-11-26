/**
 * AMBUSHER — the Mimic (traps that look innocent: mutable defaults,
 * late-binding closures, shadowed builtins).
 *
 *   disguised ──(you come within 1.5 tiles, or hit it)──► spring ──► chase ──► tired ──► chase …
 *
 * It sits perfectly still looking like a treasure chest. When the hero
 * comes close it springs open with a "!" and a chest-creak, chases them in
 * quick hops for a short while, then tires out (tongue out, "zzz") and is
 * easy to hit. If the hero leaves, it waddles home and disguises itself again.
 */
import type { Brain, MonsterWorld, Pose } from "./brain";
import type { Monster } from "./monster";
import { Hop } from "./moves";
import { StateClock } from "./stateClock";

/** Wakes when the hero comes this close (1.5 tiles). */
const WAKE_RADIUS_PX = 24;
const SPRING_SEC = 0.45;
const SPRING_HEIGHT_PX = 8;
const CHASE_SEC = 2.4;
const CHASE_HOP_SEC = 0.28;
/** 60 × 1.4 = 84 px/s while in the air — quick, but it pauses between hops. */
const CHASE_HOP_SPEED_MULT = 1.4;
const CHASE_HOP_HEIGHT_PX = 4;
const HOP_PAUSE_SEC = 0.14;
const TIRED_SEC = 2.6;
/** Walking home (to disguise again) is a slow waddle. */
const HOMEWARD_SPEED_MULT = 0.5;
const HOME_ARRIVE_PX = 3;
/** Chomp animation speed while chasing (frames per second). */
const CHOMP_FPS = 8;

type State = "disguised" | "spring" | "chase" | "tired" | "homeward";

export class AmbusherBrain implements Brain {
  readonly noticeRadius = WAKE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = true;
  private readonly clock = new StateClock<State>("disguised");
  private readonly hop = new Hop();
  private hopPause = 0;

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    m.sleepy = this.clock.is("tired");
    if (!m.engaged && this.clock.is("spring", "chase", "tired")) this.goHome(m);
    switch (this.clock.state) {
      case "disguised":
        m.stop();
        break;
      case "spring":
        m.stop();
        m.z = Math.sin(Math.PI * this.clock.progress) * SPRING_HEIGHT_PX;
        if (this.clock.done) this.clock.go("chase", CHASE_SEC);
        break;
      case "chase":
        this.chase(m, world, dt);
        break;
      case "tired":
        m.stop();
        if (this.clock.done) this.clock.go("chase", CHASE_SEC);
        break;
      case "homeward":
        if (m.walkToward(m.homeX, m.homeY, m.def.speed * HOMEWARD_SPEED_MULT) <= HOME_ARRIVE_PX) this.clock.go("disguised");
        break;
    }
  }

  onNotice(m: Monster, world: MonsterWorld): void {
    if (!this.clock.is("disguised", "homeward")) return;
    this.clock.go("spring", SPRING_SEC);
    m.alert = SPRING_SEC + 0.3;
    m.stretch = 0.4;
    world.fx.sfx("chestOpen", { pitch: 0.7 });
  }

  reset(m: Monster): void {
    this.hop.cancel(m);
    this.clock.go("disguised");
    m.sleepy = false;
  }

  harmful(): boolean {
    return this.clock.is("chase");
  }

  /** The spring out of the disguise always plays to the end. */
  committed(): boolean {
    return this.clock.is("spring");
  }

  pose(m: Monster): Pose {
    if (this.clock.is("disguised")) return { frame: m.idleFrame(), variant: "disguised" };
    if (this.clock.is("tired")) return { frame: 0 };
    return { frame: Math.floor(m.anim * CHOMP_FPS) };
  }

  private goHome(m: Monster): void {
    this.hop.cancel(m);
    m.sleepy = false;
    this.clock.go("homeward");
  }

  /** Quick hops toward the hero, with tiny pauses between them. */
  private chase(m: Monster, world: MonsterWorld, dt: number): void {
    if (this.hop.active) {
      this.hop.update(m, world, dt);
    } else {
      m.stop();
      this.hopPause -= dt;
      if (this.hopPause <= 0) {
        this.hop.start(m, m.heroAngle(), m.def.speed * CHASE_HOP_SPEED_MULT, CHASE_HOP_SEC, CHASE_HOP_HEIGHT_PX);
        this.hopPause = HOP_PAUSE_SEC;
      }
    }
    if (this.clock.done && !this.hop.active) this.clock.go("tired", TIRED_SEC);
  }
}
