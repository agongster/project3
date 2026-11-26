/**
 * HOPPER — the Dust Bunny (unused imports and variables).
 *
 *   rest ──(lazy timer)──► hop ──(lands)──► rest …
 *
 * It hops in random directions on a lazy timer. Once it has noticed the
 * hero it drifts only VAGUELY toward them (each hop is aimed at the hero
 * plus a big random wobble), so it is a gentle first enemy.
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld, type Pose } from "./brain";
import type { Monster } from "./monster";
import { Hop } from "./moves";
import { jitter, StateClock } from "./stateClock";
import { clearDistance } from "./steering";

/** Pause between hops while fighting / while calm (seconds). */
const REST_SEC: [number, number] = [0.7, 1.3];
const CALM_REST_SEC: [number, number] = [1.4, 2.6];
const HOP_SEC = 0.36;
/** Hop speed = catalog speed × this (22 × 2.6 ≈ 57 px/s, so one hop ≈ 20 px). */
const HOP_SPEED_MULT = 2.6;
const HOP_HEIGHT_PX = 6;
/** Total random wobble (radians) around "toward the hero". */
const AIM_WOBBLE = 1.4;
/** A champion's hops are aimed: its wobble is this share of the usual one. */
const CHAMPION_WOBBLE_SHARE = 0.35;
/** A calm bunny further than this from home hops back toward it. */
const HOME_RANGE_PX = 20;
/** The squashed "about to hop" frame shows this long before take-off. */
const CROUCH_SEC = 0.2;
/** Slow breathing: switch idle frames this often while resting. */
const BREATHE_SEC = 0.45;
/** Hops need at least this much open floor ahead. */
const MIN_HOP_CLEAR_PX = 10;
const AIM_TRIES = 6;

export class HopperBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<"rest" | "hop">("rest", 1);
  private readonly hop = new Hop();
  /** Random wobble of its hops toward the hero (a champion aims better). */
  private readonly wobble: number;

  constructor(champion = false) {
    this.wobble = champion ? AIM_WOBBLE * CHAMPION_WOBBLE_SHARE : AIM_WOBBLE;
  }

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    if (this.hop.active) {
      if (this.hop.update(m, world, dt)) this.clock.go("rest", jitter(...(m.engaged ? REST_SEC : CALM_REST_SEC), world.random));
      return;
    }
    m.stop();
    if (this.clock.done) this.startHop(m, world);
  }

  reset(m: Monster): void {
    this.hop.cancel(m);
    this.clock.go("rest", 1);
  }

  harmful(m: Monster): boolean {
    return m.engaged;
  }

  pose(m: Monster): Pose {
    if (this.hop.active) return { frame: 0 };
    if (this.clock.left < CROUCH_SEC || m.stretch < -0.1) return { frame: 1 };
    return { frame: Math.floor(m.anim / BREATHE_SEC) };
  }

  private startHop(m: Monster, world: MonsterWorld): void {
    const angle = this.chooseAngle(m, world);
    if (angle === null) {
      this.clock.go("rest", jitter(...REST_SEC, world.random));
      return;
    }
    this.hop.start(m, angle, m.def.speed * HOP_SPEED_MULT, HOP_SEC, HOP_HEIGHT_PX);
    this.clock.go("hop");
  }

  /** Toward the hero (with a wobble), back home, or anywhere — whichever has room. */
  private chooseAngle(m: Monster, world: MonsterWorld): number | null {
    for (let i = 0; i < AIM_TRIES; i++) {
      let angle: number;
      if (m.engaged) angle = m.heroAngle() + (world.random() - 0.5) * this.wobble;
      else if (m.homeDistance() > HOME_RANGE_PX) angle = Math.atan2(m.homeY - m.y, m.homeX - m.x) + (world.random() - 0.5) * AIM_WOBBLE * 0.5;
      else angle = world.random() * Math.PI * 2;
      if (clearDistance(m.x, m.y, angle, m.fitsAt, MIN_HOP_CLEAR_PX) >= MIN_HOP_CLEAR_PX) return angle;
    }
    return null;
  }
}
