/**
 * FLUTTER — the Echo Bat (redundant / repeated code).
 *
 *   drift ──► telegraph ("!", trembling) ──► swoop ──► rest ──► drift …
 *
 * It drifts in wobbly figure-eights (around home when calm, beside the hero
 * when fighting). Every few seconds it trembles for a moment, then swoops
 * in a straight line THROUGH the spot where the hero was standing, and has
 * to rest afterwards (dizzy stars: free hits). It flies, so it ignores pots
 * and crates, but never walls. A champion swoops twice (each swoop
 * telegraphed) before it rests.
 */
import { NOTICE_RADIUS_PX, type Brain, type MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { jitter, StateClock } from "./stateClock";
import { clearDistance, figureEight } from "./steering";

/** Figure-eight: phase speed (rad/s) and size (px). */
const DRIFT_RATE = 1.3;
const LOOP_W = 36;
const LOOP_H = 18;
/** While fighting, the loop is centred this far from the hero, on the bat's side. */
const HOVER_DISTANCE_PX = 40;
const SWOOP_EVERY_SEC: [number, number] = [3, 4.2];
/** Only swoops when the hero is this close. */
const SWOOP_RANGE_PX = 80;
const TELEGRAPH_SEC = 0.75;
const SWOOP_SPEED = 110;
/** Keeps going this far past the hero's old spot. */
const SWOOP_OVERSHOOT_PX = 24;
const REST_SEC = 1.3;
const REST_SPEED_MULT = 0.3;
/** A swoop ends early when a wall is this close ahead. */
const WALL_STOP_PX = 4;
/** Seconds between noticing the hero and the first swoop. */
const FIRST_SWOOP_DELAY_SEC = 1.5;
/** Swoops per attack for a champion (each one telegraphed); an ordinary bat swoops once. */
const CHAMPION_SWOOPS = 2;

type State = "drift" | "telegraph" | "swoop" | "rest";

export class FlutterBrain implements Brain {
  readonly noticeRadius = NOTICE_RADIUS_PX;
  readonly pursues = true;
  readonly facesMovement = true;
  private readonly clock = new StateClock<State>("drift");
  private phase = 0;
  private cooldown = 0;
  private swoopAngle = 0;
  private swoopLeft = 0;
  /** Swoops left in the current attack. */
  private swoopsLeft = 0;

  constructor(private readonly champion = false) {}

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    m.shiver = this.clock.is("telegraph");
    m.dizzy = this.clock.is("rest");
    if (!m.engaged && !this.clock.is("drift")) this.clock.go("drift");
    switch (this.clock.state) {
      case "drift":
        this.drift(m, world, dt, m.def.speed);
        if (this.readyToSwoop(m, world)) {
          this.swoopsLeft = this.champion ? CHAMPION_SWOOPS : 1;
          this.startTelegraph(m);
        }
        break;
      case "telegraph":
        m.stop();
        if (this.clock.done) this.startSwoop(m, world);
        break;
      case "swoop":
        this.swoop(m, world, dt);
        break;
      case "rest":
        this.drift(m, world, dt, m.def.speed * REST_SPEED_MULT);
        if (this.clock.done) this.clock.go("drift");
        break;
    }
  }

  reset(m: Monster): void {
    this.clock.go("drift");
    m.shiver = m.dizzy = false;
  }

  onNotice(): void {
    this.cooldown = FIRST_SWOOP_DELAY_SEC;
  }

  harmful(m: Monster): boolean {
    return m.engaged && !this.clock.is("rest");
  }

  committed(): boolean {
    return this.clock.is("telegraph", "swoop");
  }

  /** Follows a figure-eight around home (calm) or beside the hero (fighting). */
  private drift(m: Monster, world: MonsterWorld, dt: number, speed: number): void {
    this.phase += DRIFT_RATE * dt;
    let cx = m.homeX;
    let cy = m.homeY;
    if (m.engaged) {
      const away = Math.atan2(m.y - world.hero.y, m.x - world.hero.x);
      cx = world.hero.x + Math.cos(away) * HOVER_DISTANCE_PX;
      cy = world.hero.y + Math.sin(away) * HOVER_DISTANCE_PX;
    }
    const loop = figureEight(this.phase, LOOP_W, LOOP_H);
    m.walkToward(cx + loop.x, cy + loop.y, speed);
  }

  private readyToSwoop(m: Monster, world: MonsterWorld): boolean {
    return m.engaged && world.mayAttack && this.cooldown <= 0 && m.heroDistance() < SWOOP_RANGE_PX && world.canSee(m.x, m.y, world.hero.x, world.hero.y);
  }

  private startTelegraph(m: Monster): void {
    this.clock.go("telegraph", TELEGRAPH_SEC);
    m.alert = TELEGRAPH_SEC;
  }

  /** Aims at where the hero is NOW and commits to that straight line. */
  private startSwoop(m: Monster, world: MonsterWorld): void {
    this.swoopAngle = m.heroAngle();
    this.swoopLeft = m.heroDistance() + SWOOP_OVERSHOOT_PX;
    this.clock.go("swoop");
    world.fx.sfx("dash", { pitch: 1.5, volume: 0.6 });
  }

  private swoop(m: Monster, world: MonsterWorld, dt: number): void {
    const blocked = clearDistance(m.x, m.y, this.swoopAngle, m.fitsAt, WALL_STOP_PX) < WALL_STOP_PX;
    if (this.swoopLeft <= 0 || blocked) {
      m.stop();
      this.swoopsLeft--;
      if (this.swoopsLeft > 0 && world.mayAttack) {
        this.startTelegraph(m);
        return;
      }
      this.clock.go("rest", REST_SEC);
      this.cooldown = jitter(...SWOOP_EVERY_SEC, world.random);
      return;
    }
    m.vx = Math.cos(this.swoopAngle) * SWOOP_SPEED;
    m.vy = Math.sin(this.swoopAngle) * SWOOP_SPEED;
    this.swoopLeft -= SWOOP_SPEED * dt;
  }
}
