/**
 * BOSS — the shared frame of the three bosses (Key Thief, Eval Serpent,
 * Glitch King). Each boss only supplies its list of MOVES; this file runs
 * the fight around them:
 *
 *   asleep ──(notices you)──► intro (roar, name banner) ──► approach
 *     ──► windup (telegraph) ──► act (the move) ──► rest (dizzy: free hits!)
 *     ──► approach ──► next move …
 *
 * Moves take turns in a fixed order, so a fight is easy to learn. In the
 * last 30% of its HP the boss gets "enraged": it roars again, telegraphs
 * and rests are 20% shorter and it walks a bit faster (moves may also throw
 * a few extra projectiles).
 */
import type { Brain, MonsterWorld } from "./brain";
import type { Monster } from "./monster";
import { jitter, StateClock } from "./stateClock";

/** Bosses notice the hero a bit further away (7 tiles). */
const BOSS_NOTICE_PX = 112;
/** Length of the intro (roar + banner); the director eases the camera toward the boss meanwhile. */
export const BOSS_INTRO_SEC = 1.8;
const APPROACH_SEC: [number, number] = [1, 1.4];
const APPROACH_SPEED_MULT = 0.6;
/** Backing off (to get room for a ranged move) is a little quicker. */
const BACK_OFF_SPEED_MULT = 1;
/** "Close enough" band around a move's preferred range (px). */
const RANGE_SLACK_PX = 8;
/** Enraged below this share of max HP. */
const ENRAGE_AT = 0.3;
const ENRAGED_TIME_MULT = 0.8;
const ENRAGED_SPEED_MULT = 1.25;
const ROAR_SHAKE = 0.4;
const ENRAGE_FLASH_SEC = 0.8;

export type MovePhase = "windup" | "act";

/** One boss attack: telegraph → action → safe rest. */
export interface BossMove {
  /**
   * Distance from the hero (px) it likes to start this move from. During the
   * approach the boss walks in — or backs off — toward it, so a ranged move
   * is never fired point-blank and bosses never just body-slam you.
   */
  readonly range: number;
  /** Seconds of warning before the move happens. */
  readonly windup: number;
  /** Longest the action lasts (`step` may end it sooner). */
  readonly act: number;
  /** Safe seconds afterwards (dizzy stars). */
  readonly rest: number;
  /** Start of the wind-up: lock the aim, play a warning sound. */
  begin(m: Monster, world: MonsterWorld, enraged: boolean): void;
  /** The moment the move happens: fire projectiles, start a dash… */
  release(m: Monster, world: MonsterWorld, enraged: boolean): void;
  /** Every step, whatever the boss is doing (the move's own little animations). */
  tick?(m: Monster): void;
  /** Each step of the action; return true to end it early. */
  step?(m: Monster, world: MonsterWorld, dt: number): boolean;
  /** Floor telegraph during the wind-up and the action. */
  drawFloor?(g: CanvasRenderingContext2D, m: Monster, phase: MovePhase, progress: number): void;
  /** Effects drawn just before the body (after-images). */
  drawBehind?(g: CanvasRenderingContext2D, m: Monster): void;
  /** Called when the hero faints, so nothing half-done lingers. */
  reset?(): void;
}

type State = "asleep" | "intro" | "approach" | "windup" | "act" | "rest";

export class BossBrain implements Brain {
  readonly noticeRadius = BOSS_NOTICE_PX;
  readonly pursues = true;
  readonly facesMovement = false;
  private readonly clock = new StateClock<State>("asleep");
  private moveIndex = 0;
  private wasEnraged = false;

  constructor(private readonly moves: readonly BossMove[]) {}

  private get move(): BossMove {
    return this.moves[this.moveIndex % this.moves.length];
  }

  /** True in the last 30% of HP. */
  enraged(m: Monster): boolean {
    return m.hp <= m.maxHp * ENRAGE_AT;
  }

  private timeMult(m: Monster): number {
    return this.enraged(m) ? ENRAGED_TIME_MULT : 1;
  }

  update(m: Monster, world: MonsterWorld, dt: number): void {
    this.clock.tick(dt);
    for (const move of this.moves) move.tick?.(m);
    m.shiver = this.clock.is("windup");
    m.dizzy = this.clock.is("rest");
    if (!m.engaged) {
      if (!this.clock.is("asleep")) this.clock.go("asleep");
      m.walkToward(m.homeX, m.homeY, m.def.speed * APPROACH_SPEED_MULT);
      return;
    }
    this.checkEnrage(m, world);
    switch (this.clock.state) {
      case "asleep":
        this.clock.go("intro", BOSS_INTRO_SEC);
        break;
      case "intro":
        m.stop();
        if (this.clock.done) this.startApproach(m, world);
        break;
      case "approach":
        this.approach(m, world);
        break;
      case "windup":
        m.stop();
        if (this.clock.done) this.release(m, world);
        break;
      case "act":
        if (this.move.step?.(m, world, dt) || this.clock.done) this.startRest(m);
        break;
      case "rest":
        m.stop();
        if (this.clock.done) this.startApproach(m, world);
        break;
    }
  }

  onNotice(m: Monster, world: MonsterWorld): void {
    this.clock.go("intro", BOSS_INTRO_SEC);
    m.alert = BOSS_INTRO_SEC;
    m.stretch = 0.3;
    world.fx.sfx("bossRoar");
    world.fx.shake(ROAR_SHAKE);
  }

  reset(m: Monster): void {
    this.clock.go("asleep");
    this.moveIndex = 0;
    for (const move of this.moves) move.reset?.();
    m.shiver = m.dizzy = false;
  }

  /** Only the action itself hurts on contact (the Key Thief's dash); walking up to a boss is safe. */
  harmful(): boolean {
    return this.clock.is("act");
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster): void {
    if (this.clock.is("windup", "act")) this.move.drawFloor?.(g, m, this.clock.state as MovePhase, this.clock.progress);
  }

  drawBehind(g: CanvasRenderingContext2D, m: Monster): void {
    for (const move of this.moves) move.drawBehind?.(g, m);
  }

  /** The second wind: a roar and a red flash the first time HP drops into the last 30%. */
  private checkEnrage(m: Monster, world: MonsterWorld): void {
    const enraged = this.enraged(m);
    if (enraged && !this.wasEnraged) {
      m.alert = ENRAGE_FLASH_SEC;
      m.stretch = 0.35;
      world.fx.sfx("bossRoar", { pitch: 1.25 });
      world.fx.shake(ROAR_SHAKE);
    }
    this.wasEnraged = enraged;
  }

  private startApproach(m: Monster, world: MonsterWorld): void {
    this.clock.go("approach", jitter(...APPROACH_SEC, world.random) * this.timeMult(m));
  }

  /** Walks in (or backs off) toward the next move's preferred range, then starts it. */
  private approach(m: Monster, world: MonsterWorld): void {
    const hurry = this.enraged(m) ? ENRAGED_SPEED_MULT : 1;
    const d = m.heroDistance();
    if (d > this.move.range + RANGE_SLACK_PX) {
      m.walkToward(world.hero.x, world.hero.y, m.def.speed * APPROACH_SPEED_MULT * hurry);
    } else if (d < this.move.range - RANGE_SLACK_PX) {
      const away = Math.atan2(m.y - world.hero.y, m.x - world.hero.x);
      m.vx = Math.cos(away) * m.def.speed * BACK_OFF_SPEED_MULT * hurry;
      m.vy = Math.sin(away) * m.def.speed * BACK_OFF_SPEED_MULT * hurry;
    } else {
      m.stop();
    }
    if (!this.clock.done || !world.mayAttack) return;
    m.stop();
    this.clock.go("windup", this.move.windup * this.timeMult(m));
    this.move.begin(m, world, this.enraged(m));
  }

  private release(m: Monster, world: MonsterWorld): void {
    this.clock.go("act", this.move.act);
    this.move.release(m, world, this.enraged(m));
  }

  private startRest(m: Monster): void {
    m.stop();
    this.clock.go("rest", this.move.rest * this.timeMult(m));
    this.moveIndex++;
  }
}
