/**
 * BLINKER — the Phantom (undefined names: things that are not really there).
 *
 *   approach ──► fadeOut ──► hidden ──► shimmer ──► fadeIn ──► approach …
 *
 * It floats slowly toward the hero, then fades away (it cannot be hit while
 * invisible). A shimmer of sparkles shows where it will come back — 2 to 4
 * tiles from the hero — and it fades in there and floats toward them again.
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { Wander } from "./moves";
import { StateClock } from "./stateClock";
import { findSpotAround } from "./steering";

const APPROACH_SEC = 1.8;
const FADE_OUT_SEC = 0.45;
const HIDDEN_SEC = 0.7;
const SHIMMER_SEC = 0.65;
const FADE_IN_SEC = 0.35;
/** Reappears this far from the hero (2–4 tiles). */
const REAPPEAR_MIN_PX = 32;
const REAPPEAR_MAX_PX = 64;
/** Hittable (and visible to auto-aim) only while at least this opaque. */
const TARGETABLE_ALPHA = 0.35;
/** It hovers: base height plus a gentle bob. */
const HOVER_PX = 3;
const BOB_PX = 2;
const BOB_RATE = 3;
const SHIMMER_SPARKLE_SEC = 0.09;
const CALM_WANDER_SPEED = 0.5;

type State = "calm" | "approach" | "fadeOut" | "hidden" | "shimmer" | "fadeIn";

export class BlinkerBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<State>("calm");
  private readonly wander = new Wander(CALM_WANDER_SPEED);
  private sparkleClock = 0;

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    m.z = HOVER_PX + Math.sin(m.anim * BOB_RATE) * BOB_PX;
    if (!m.engaged) {
      if (!this.clock.is("calm")) this.becomeVisible(m);
      this.wander.update(m, world, dt);
      return;
    }
    switch (this.clock.state) {
      case "calm":
        this.clock.go("approach", APPROACH_SEC);
        break;
      case "approach":
        m.walkToward(world.hero.x, world.hero.y, m.def.speed);
        if (this.clock.done && world.mayAttack) this.clock.go("fadeOut", FADE_OUT_SEC);
        break;
      case "fadeOut":
        m.stop();
        this.setAlpha(m, 1 - this.clock.progress);
        if (this.clock.done) this.clock.go("hidden", HIDDEN_SEC);
        break;
      case "hidden":
        if (this.clock.done) this.startShimmer(m, world);
        break;
      case "shimmer":
        this.shimmer(m, world, dt);
        break;
      case "fadeIn":
        this.setAlpha(m, this.clock.progress);
        if (this.clock.done) this.clock.go("approach", APPROACH_SEC);
        break;
    }
  }

  reset(m: Monster): void {
    this.becomeVisible(m);
    this.wander.reset();
  }

  harmful(m: Monster): boolean {
    return this.clock.is("approach") && m.alpha > 0.9;
  }

  /** Once it starts to fade it always finishes the blink. */
  committed(): boolean {
    return this.clock.is("fadeOut", "hidden", "shimmer", "fadeIn");
  }

  private becomeVisible(m: Monster): void {
    this.clock.go("calm");
    this.setAlpha(m, 1);
  }

  private setAlpha(m: Monster, alpha: number): void {
    m.alpha = alpha;
    m.targetable = alpha >= TARGETABLE_ALPHA;
  }

  /** Picks the comeback spot (in sight of the hero) and starts sparkling there. */
  private startShimmer(m: Monster, world: MonsterWorld): void {
    const hero = world.hero;
    const good = (x: number, y: number) => m.fitsAt(x, y) && world.canSee(x, y, hero.x, hero.y);
    const spot = findSpotAround(hero.x, hero.y, REAPPEAR_MIN_PX, REAPPEAR_MAX_PX, good, world.random);
    if (spot) m.teleport(spot.x, spot.y);
    this.sparkleClock = 0;
    this.clock.go("shimmer", SHIMMER_SEC);
    world.fx.sfx("dash", { pitch: 2, volume: 0.35 });
  }

  private shimmer(m: Monster, world: MonsterWorld, dt: number): void {
    this.sparkleClock += dt;
    if (this.sparkleClock >= SHIMMER_SPARKLE_SEC) {
      this.sparkleClock = 0;
      world.fx.sparkles(m.x, m.y - 8, 1);
    }
    if (this.clock.done) this.clock.go("fadeIn", FADE_IN_SEC);
  }
}
