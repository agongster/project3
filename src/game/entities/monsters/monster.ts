/**
 * One monster = one static-analysis finding.
 *
 * The Monster owns everything all monsters share: position and tile
 * collision, HP, getting hit (white flash, knockback, a short hit-stun),
 * squash & stretch, facing, and the "noticed the hero" flags. WHAT it does
 * each step is decided by its `Brain` (one per archetype: hopper.ts,
 * chaser.ts, boss.ts …), which only sets velocities and starts attacks.
 *
 * Position (x, y) is the point under the monster's feet, like the hero's.
 * It is also the `Hittable` position, so the hero's attacks aim there.
 */
import { MONSTERS, type MonsterArchetype, type MonsterDef } from "@/lib/game/catalog";
import { hasFinisher } from "@/lib/game/finisher";
import type { Finding, MonsterKind, MonsterSpawn } from "@/lib/types";
import type { HitInfo, HitSource, Hittable } from "../../combat/hittable";
import { boxHitsSolid, moveBox, TILE_PX, type Box } from "../../engine/collision";
import type { Brain, MonsterWorld } from "./brain";
import { directionTo, distance } from "./steering";
import type { IncomingShot, Trait } from "./traits/trait";

type Size = MonsterDef["size"];

/** Collision box around the feet, per sprite size (bigger monsters are wider). */
const FEET: Record<Size, { w: number; h: number }> = { 16: { w: 10, h: 6 }, 24: { w: 14, h: 8 }, 32: { w: 18, h: 10 } };
/** Hit radius used by the hero's attacks, per sprite size. */
const HIT_RADIUS: Record<Size, number> = { 16: 7, 24: 10, 32: 13 };
/** Feet sit this far below the top of their spawn tile. */
const SPAWN_FEET_DY = 12;
/** Flyers ignore pots and crates (but never walls). */
const FLYERS: ReadonlySet<MonsterKind> = new Set<MonsterKind>(["echoBat", "phantom"]);

/** White flash after a hit (it fades out over this time, see monsterDraw.ts). */
export const HIT_FLASH_SEC = 0.12;
/** The AI pauses this long after a hit, so hits feel like they land. Bosses shrug it off. */
const HIT_STUN_SEC = 0.15;
/** Knockback velocity lost per second (the total push equals the weapon's knockback in px). */
const KNOCKBACK_DECAY = 12;
/** How much of a weapon's knockback each archetype actually takes. */
const KNOCKBACK_TAKEN: Partial<Record<MonsterArchetype, number>> = { tank: 0.3, boss: 0.15 };
/** Squash & stretch springs back to normal at this rate (per second). */
const STRETCH_RECOVERY = 9;
/** A little squish when hit. */
const HIT_SQUISH = -0.25;
/**
 * BREAKAWAY: an elite that takes BREAKAWAY_HITS hits within BREAKAWAY_WINDOW_SEC
 * springs BREAKAWAY_PX away from the hero. It stops fights from being a
 * stand-still slugfest: the monster gets room to show its attack again,
 * and the hero gets to read the telegraph and dodge. (Tanks shrug it off.)
 */
const BREAKAWAY_HITS = 3;
const BREAKAWAY_WINDOW_SEC = 1.2;
const BREAKAWAY_PX = 30;
const BREAKAWAY_STRETCH = 0.35;
/** After bumping into the hero, a monster bounces back at this speed (so it never "sticks"). */
const RECOIL_SPEED = 90;
/**
 * DAZED: the would-be killing blow on an elite or boss leaves it wobbling
 * for DAZE_SEC instead, harmless, so the hero can walk up and finish it
 * with a fix (see dazed.ts). For the first DAZE_GRACE_SEC it cannot be hit,
 * so a swing that was already in the air doesn't skip the moment; after
 * that the hero's next hit finishes it the ordinary way.
 */
export const DAZE_SEC = 3;
const DAZE_GRACE_SEC = 0.5;
/** Only the hero's own blows end a daze: the pet's pecks don't steal the finishing move. */
const HERO_HIT_SOURCES: ReadonlySet<HitSource> = new Set<HitSource>(["weapon", "projectile"]);
/** How long the "!" shows when a monster notices the hero. */
export const ALERT_SEC = 0.8;
/** Idle animation: one frame every ~180 ms (see art/monsters.ts). */
const FRAME_SEC = 0.18;
/** `walkToward` stops when this close to its target. */
const ARRIVE_PX = 2;
/** Hero-facing has a small dead zone so monsters don't flicker left/right when directly above you. */
const FACING_DEADZONE_PX = 3;

/** A body's own settings beyond the catalog (an echo bat's echo has half the HP and never hurts). */
export interface MonsterOptions {
  /** How it behaves like its bug (traits/), or null for the plain fight. */
  trait?: Trait | null;
  hp?: number;
  touchDamage?: number;
}

export class Monster implements Hittable {
  readonly species: MonsterKind;
  readonly def: MonsterDef;
  readonly trait: Trait | null;
  /** Hit radius at normal size; contact damage always uses this one, so a grown monster never hurts from further away. */
  readonly bodyRadius: number;
  /** Half-hearts lost when the hero bumps into it. */
  readonly touchDamage: number;
  readonly flying: boolean;
  readonly isBoss: boolean;
  /** Where it spawned; calm monsters potter about here and return here after the hero faints. */
  readonly homeX: number;
  readonly homeY: number;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  alive = true;

  /** Velocity the brain wants this step (px/s). */
  vx = 0;
  vy = 0;
  /** Height above the ground (hops, springs); purely visual. */
  z = 0;
  /** Squash & stretch: > 0 taller and thinner, < 0 flatter and wider. */
  stretch = 0;
  alpha = 1;
  /** Trembles in place (wind-up telegraph). */
  shiver = false;
  facingLeft = false;

  /** Noticed the hero and is part of the fight. */
  engaged = false;
  /** Was hit while calm: wakes up no matter what. */
  provoked = false;
  /** Seconds the engaged monster has lost the hero (out of sight or too far). */
  lostSightFor = 0;
  /** Seconds left showing the "!" above its head. */
  alert = 0;
  /** Shows circling stars: it is resting after an attack, safe to hit. */
  dizzy = false;
  /** Shows "zzz" (a tired mimic, a boss waiting its turn). */
  sleepy = false;
  /** Can the hero's attacks hit it right now (false while a phantom is invisible). */
  targetable = true;
  flash = 0;
  stun = 0;
  /** Seconds since it was dazed (see DAZE_SEC), or -1 if it never was. */
  dazedFor = -1;
  /** The finisher overlay was opened for it (a boss then skips its bug card). */
  finisherOpened = false;
  /** It went down to the right fix in the finisher: an extra-juicy death and double rewards. */
  criticalFix = false;
  /** Seconds since it started dying, or -1 while alive. */
  dyingFor = -1;
  /** Drawn and hit at this size (a mutable default grows with every hit, see traits/growth.ts). */
  scale = 1;
  /** Its brain's speed is multiplied by this (bigger is slower). */
  speedScale = 1;
  /** Animation clock (random start so neighbours don't bob in sync). */
  anim: number;

  private knockX = 0;
  private knockY = 0;
  /** `anim` times of recent hits (for the breakaway). */
  private recentHits: number[] = [];

  constructor(
    spawn: MonsterSpawn,
    readonly finding: Finding,
    readonly brain: Brain,
    private readonly world: MonsterWorld,
    options: MonsterOptions = {},
  ) {
    this.species = spawn.kind;
    this.def = MONSTERS[spawn.kind];
    this.trait = options.trait ?? null;
    this.bodyRadius = HIT_RADIUS[this.def.size];
    this.touchDamage = options.touchDamage ?? this.def.touchDamage;
    this.flying = FLYERS.has(spawn.kind);
    this.isBoss = this.def.archetype === "boss";
    this.homeX = this.x = spawn.x * TILE_PX + TILE_PX / 2;
    this.homeY = this.y = spawn.y * TILE_PX + SPAWN_FEET_DY;
    this.hp = this.maxHp = options.hp ?? this.def.hp;
    this.anim = world.random() * 10;
  }

  /** "object" while a trait says hits pass through it (no damage numbers, no pet pecks), else "monster". */
  get kind(): Hittable["kind"] {
    return this.trait?.passesThrough?.(this) ? "object" : "monster";
  }

  /** Hit radius used by the hero's attacks (grows with `scale`). */
  get radius(): number {
    return this.bodyRadius * this.scale;
  }

  // ───────────── position & collision ─────────────

  feetBox(x = this.x, y = this.y): Box {
    const { w, h } = FEET[this.def.size];
    return { x: x - w / 2, y: y - h, w, h };
  }

  private readonly solid = (tx: number, ty: number): boolean => this.world.blockedTile(tx, ty, this.flying);

  /** Could this monster stand with its feet at (px, py)? */
  readonly fitsAt = (px: number, py: number): boolean => {
    const b = this.feetBox(px, py);
    return !boxHitsSolid(b.x, b.y, b.w, b.h, this.solid);
  };

  /** Moves with wall sliding; returns which axes were blocked. */
  moveBy(dx: number, dy: number): { blockedX: boolean; blockedY: boolean } {
    const box = this.feetBox();
    const r = moveBox(box, dx, dy, this.solid);
    this.x += r.x - box.x;
    this.y += r.y - box.y;
    return { blockedX: r.blockedX, blockedY: r.blockedY };
  }

  teleport(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  /** Sets the velocity toward a point (stops on arrival). Returns the remaining distance. */
  walkToward(tx: number, ty: number, speed: number): number {
    const d = distance(this.x, this.y, tx, ty);
    if (d <= ARRIVE_PX) {
      this.stop();
      return d;
    }
    const dir = directionTo(this.x, this.y, tx, ty);
    this.vx = dir.x * speed;
    this.vy = dir.y * speed;
    return d;
  }

  stop(): void {
    this.vx = 0;
    this.vy = 0;
  }

  heroDistance(): number {
    return distance(this.x, this.y, this.world.hero.x, this.world.hero.y);
  }

  heroAngle(): number {
    return Math.atan2(this.world.hero.y - this.y, this.world.hero.x - this.x);
  }

  homeDistance(): number {
    return distance(this.x, this.y, this.homeX, this.homeY);
  }

  // ───────────── getting hit ─────────────

  takeHit(hit: HitInfo): void {
    if (!this.alive || !this.targetable) return;
    if (this.dazed && !HERO_HIT_SOURCES.has(hit.source)) return;
    if (!this.dazed && this.trait?.absorbsHit?.(this, this.world)) return;
    this.hp = Math.max(0, this.hp - hit.damage);
    this.flash = HIT_FLASH_SEC;
    this.stun = this.isBoss ? 0 : HIT_STUN_SEC;
    const taken = KNOCKBACK_TAKEN[this.def.archetype] ?? 1;
    this.knockX += hit.knockbackX * KNOCKBACK_DECAY * taken;
    this.knockY += hit.knockbackY * KNOCKBACK_DECAY * taken;
    this.stretch = HIT_SQUISH;
    this.provoked = true;
    if (this.hp > 0) {
      this.checkBreakaway();
      this.brain.onHit?.(this, this.world);
      this.trait?.onHit?.(this, this.world);
      return;
    }
    if (!this.dazed && hasFinisher(this.def.severity)) this.daze();
    else this.collapse();
  }

  /** A hero projectile reached it: true when its trait swallowed the shot (never while dazed). */
  catchShot(shot: IncomingShot): boolean {
    return this.alive && !this.dazed && (this.trait?.catchShot?.(this, this.world, shot) ?? false);
  }

  /** True while it wobbles at 0 HP, waiting to be finished (see DAZE_SEC). */
  get dazed(): boolean {
    return this.alive && this.dazedFor >= 0;
  }

  /** The would-be killing blow on an elite or boss: it stops, leaves the fight, and sees stars. */
  private daze(): void {
    this.dazedFor = 0;
    this.targetable = false;
    this.engaged = false;
    this.dizzy = true;
    this.shiver = this.sleepy = false;
    this.alert = 0;
    this.alpha = 1;
    this.z = 0;
    this.stop();
    // Its spit globs and falling blocks fizzle: a dazed monster hurts no one.
    this.world.hazards.removeOwnedBy(this);
  }

  /**
   * HP is gone for good: the death animation starts (deaths.ts). Every way a
   * monster dies goes through here, and a second call changes nothing, so a
   * monster is always defeated exactly once.
   */
  collapse(criticalFix = false): void {
    if (!this.alive) return;
    this.alive = false;
    this.targetable = false;
    this.dizzy = false;
    this.criticalFix = criticalFix;
    this.dyingFor = 0;
    this.stop();
  }

  /**
   * Gets back up from a daze with `hp` left: the player chose to fix its bug
   * in the code instead of finishing it (dazed.ts, `spareFinisher`).
   */
  recover(hp: number): void {
    if (!this.dazed) return;
    this.dazedFor = -1;
    this.finisherOpened = false;
    this.dizzy = false;
    this.targetable = true;
    this.hp = Math.max(1, Math.min(this.maxHp, hp));
  }

  /** Elites spring away from the hero after a quick flurry of hits (see BREAKAWAY_HITS). */
  private checkBreakaway(): void {
    if (this.def.severity !== "elite" || this.def.archetype === "tank") return;
    this.recentHits = this.recentHits.filter((t) => this.anim - t < BREAKAWAY_WINDOW_SEC);
    this.recentHits.push(this.anim);
    if (this.recentHits.length < BREAKAWAY_HITS) return;
    this.recentHits = [];
    const away = directionTo(this.world.hero.x, this.world.hero.y, this.x, this.y);
    this.knockX = away.x * BREAKAWAY_PX * KNOCKBACK_DECAY;
    this.knockY = away.y * BREAKAWAY_PX * KNOCKBACK_DECAY;
    this.stretch = BREAKAWAY_STRETCH;
    this.world.fx.dust(this.x, this.y, 3);
  }

  /** Bounces back after bumping into the hero. */
  recoil(fromX: number, fromY: number): void {
    const dir = directionTo(fromX, fromY, this.x, this.y);
    this.knockX += dir.x * RECOIL_SPEED;
    this.knockY += dir.y * RECOIL_SPEED;
  }

  // ───────────── simulation ─────────────

  update(dt: number): void {
    this.anim += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.alert = Math.max(0, this.alert - dt);
    this.stretch *= Math.exp(-STRETCH_RECOVERY * dt);
    this.stun = Math.max(0, this.stun - dt);
    if (this.dazed) this.updateDazed(dt);
    else if (this.trait?.holdsBrain?.(this)) this.stop();
    else if (this.stun > 0 && !this.brain.committed?.(this)) this.stop();
    else this.brain.update(this, this.world, dt);
    if (this.alive && !this.dazed) this.trait?.update?.(this, this.world, dt);
    this.applyMotion(dt);
    this.updateFacing();
  }

  /** The brain is switched off while dazed; the moment ends by itself after DAZE_SEC. */
  private updateDazed(dt: number): void {
    this.dazedFor += dt;
    this.stop();
    if (this.dazedFor >= DAZE_GRACE_SEC) this.targetable = true;
    if (this.dazedFor >= DAZE_SEC) this.collapse();
  }

  /** The death animation plays on: only the killing blow's knockback still moves it. */
  updateDying(dt: number): void {
    this.dyingFor += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.stop();
    this.applyMotion(dt);
  }

  private applyMotion(dt: number): void {
    const moved = this.moveBy((this.vx * this.speedScale + this.knockX) * dt, (this.vy * this.speedScale + this.knockY) * dt);
    const keep = Math.exp(-KNOCKBACK_DECAY * dt);
    this.knockX = moved.blockedX ? 0 : this.knockX * keep;
    this.knockY = moved.blockedY ? 0 : this.knockY * keep;
  }

  private updateFacing(): void {
    if (this.brain.facesMovement) {
      if (Math.abs(this.vx) > 4) this.facingLeft = this.vx < 0;
      return;
    }
    const dx = this.world.hero.x - this.x;
    if (Math.abs(dx) > FACING_DEADZONE_PX) this.facingLeft = dx < 0;
  }

  /** The hero fainted: back home, calm, same HP (the bugs didn't move). */
  resetForRetry(): void {
    this.teleport(this.homeX, this.homeY);
    this.stop();
    this.knockX = this.knockY = 0;
    this.z = 0;
    this.stretch = 0;
    this.alpha = 1;
    this.shiver = this.dizzy = this.sleepy = false;
    this.engaged = this.provoked = false;
    this.lostSightFor = 0;
    this.alert = 0;
    this.targetable = true;
    this.brain.reset(this);
    this.trait?.reset?.(this);
  }

  /** Animation frame to draw (the brain may override it, e.g. the toad puffing its cheeks). */
  idleFrame(): number {
    return Math.floor(this.anim / FRAME_SEC);
  }
}
