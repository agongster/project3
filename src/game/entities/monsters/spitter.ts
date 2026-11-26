/**
 * SPITTER — the Swallow Toad (swallowed exceptions).
 *
 *   watch ──► (a hop to keep ~4 tiles away) ──► watch …
 *   watch ──► puff (cheeks swell) ──► spit ──► recover ──► watch …
 *
 * It keeps its distance, hopping away when the hero gets close and sideways
 * otherwise. Every few seconds it puffs its cheeks (the telegraph) and lobs
 * a slow glob at the spot where the hero WAS. The landing spot is marked on
 * the floor (see hazards.ts), so one step aside is enough. A champion lobs
 * a fan of three (one either side of the hero), so step back or forward.
 */
import type { Brain, MonsterWorld, Pose } from "./brain";
import type { Monster } from "./monster";
import { Hop } from "./moves";
import { jitter, StateClock } from "./stateClock";
import { clearDistance } from "./steering";

/** It has a ranged attack, so it notices from a little further (6 tiles). */
const NOTICE_PX = 96;
/** Preferred distance band from the hero. */
const KEEP_MIN_PX = 52;
const KEEP_MAX_PX = 84;
const HOP_EVERY_SEC: [number, number] = [1, 1.4];
const HOP_SEC = 0.32;
/** 20 × 3 = 60 px/s in the air, so one hop ≈ 19 px. */
const HOP_SPEED_MULT = 3;
const HOP_HEIGHT_PX = 5;
const MIN_HOP_CLEAR_PX = 12;
const PUFF_SEC = 0.9;
const SPIT_SEC = 0.3;
const RECOVER_SEC = 1;
const ATTACK_EVERY_SEC: [number, number] = [2.4, 3.2];
const FIRST_ATTACK_DELAY_SEC = 1.2;
const SPIT_RANGE_PX = 120;
/** Glob speed over the ground (the brief caps hostile projectiles at 70 px/s). */
const GLOB_SPEED = 60;
const MIN_FLIGHT_SEC = 0.6;
const MAX_FLIGHT_SEC = 1.6;
/** The glob leaves from the toad's mouth, a little in front of its feet. */
const MOUTH_OFFSET_PX = 6;
/** Calm toads further than this from home hop back. */
const HOME_RANGE_PX = 20;
const BREATHE_SEC = 0.5;
/** A champion's two extra globs land this far either side of the hero, across the line of fire. */
const CHAMPION_FAN_PX = 22;

type State = "calm" | "watch" | "puff" | "spit" | "recover";

export class SpitterBrain implements Brain {
  readonly noticeRadius = NOTICE_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<State>("calm");
  private readonly hop = new Hop();
  private hopTimer = 0;
  private attackTimer = FIRST_ATTACK_DELAY_SEC;

  constructor(private readonly champion = false) {}

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    this.hopTimer -= dt;
    this.attackTimer -= dt;
    if (this.hop.active) {
      this.hop.update(m, world, dt);
      return;
    }
    if (!m.engaged && !this.clock.is("calm")) this.clock.go("calm");
    switch (this.clock.state) {
      case "calm":
        m.stop();
        if (m.engaged) this.clock.go("watch");
        else if (m.homeDistance() > HOME_RANGE_PX && this.hopTimer <= 0) this.hopToward(m, world, Math.atan2(m.homeY - m.y, m.homeX - m.x));
        break;
      case "watch":
        this.watch(m, world);
        break;
      case "puff":
        m.stop();
        if (this.clock.done) this.spit(m, world);
        break;
      case "spit":
        if (this.clock.done) this.clock.go("recover", RECOVER_SEC);
        break;
      case "recover":
        if (this.clock.done) this.clock.go("watch");
        break;
    }
  }

  onNotice(): void {
    this.attackTimer = Math.max(this.attackTimer, FIRST_ATTACK_DELAY_SEC);
  }

  reset(m: Monster): void {
    this.hop.cancel(m);
    this.clock.go("calm");
    this.attackTimer = FIRST_ATTACK_DELAY_SEC;
  }

  harmful(): boolean {
    return !this.clock.is("calm");
  }

  committed(): boolean {
    return this.clock.is("puff", "spit");
  }

  pose(m: Monster): Pose {
    if (this.clock.is("puff")) return { frame: this.clock.progress < 0.5 ? 1 : 2 };
    if (this.clock.is("spit")) return { frame: 3 };
    if (this.hop.active) return { frame: 0 };
    return { frame: Math.floor(m.anim / BREATHE_SEC) % 2 };
  }

  /** Between hops: maybe start an attack, otherwise reposition now and then. */
  private watch(m: Monster, world: MonsterWorld): void {
    m.stop();
    const d = m.heroDistance();
    const canSpit = world.mayAttack && d <= SPIT_RANGE_PX && world.canSee(m.x, m.y, world.hero.x, world.hero.y);
    if (this.attackTimer <= 0 && canSpit) {
      this.clock.go("puff", PUFF_SEC);
      m.alert = PUFF_SEC;
      return;
    }
    if (this.hopTimer > 0) return;
    const toHero = m.heroAngle();
    if (d < KEEP_MIN_PX) this.hopToward(m, world, toHero + Math.PI);
    else if (d > KEEP_MAX_PX) this.hopToward(m, world, toHero);
    else this.hopToward(m, world, toHero + (world.random() < 0.5 ? 1 : -1) * (Math.PI / 2));
  }

  /** Hops roughly along `angle`, trying a few nearby directions if a wall is in the way. */
  private hopToward(m: Monster, world: MonsterWorld, angle: number): void {
    this.hopTimer = jitter(...HOP_EVERY_SEC, world.random);
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2]) {
      const a = angle + turn;
      if (clearDistance(m.x, m.y, a, m.fitsAt, MIN_HOP_CLEAR_PX) < MIN_HOP_CLEAR_PX) continue;
      this.hop.start(m, a, m.def.speed * HOP_SPEED_MULT, HOP_SEC, HOP_HEIGHT_PX);
      return;
    }
  }

  /** Lobs the glob at where the hero stands right now (a champion: a fan of three). */
  private spit(m: Monster, world: MonsterWorld): void {
    const hero = world.hero;
    const fromX = m.x + (m.facingLeft ? -MOUTH_OFFSET_PX : MOUTH_OFFSET_PX);
    const flight = Math.max(MIN_FLIGHT_SEC, Math.min(MAX_FLIGHT_SEC, Math.hypot(hero.x - fromX, hero.y - m.y) / GLOB_SPEED));
    world.hazards.lob(m, fromX, m.y, hero.x, hero.y, flight);
    if (this.champion) {
      // Across the line of fire: the direction to the hero turned a quarter.
      const across = m.heroAngle() + Math.PI / 2;
      for (const side of [-1, 1]) {
        world.hazards.lob(m, fromX, m.y, hero.x + Math.cos(across) * CHAMPION_FAN_PX * side, hero.y + Math.sin(across) * CHAMPION_FAN_PX * side, flight);
      }
    }
    world.fx.sfx("shoot", { pitch: 0.55 });
    this.clock.go("spit", SPIT_SEC);
    this.attackTimer = jitter(...ATTACK_EVERY_SEC, world.random);
  }
}
