/**
 * The two interfaces every monster behaviour is written against.
 *
 *  - `Brain`: one archetype's AI (hopper, chaser, boss …). Each step the
 *    monster asks its brain what to do; the brain sets the monster's
 *    velocity, starts attacks and draws its own telegraphs.
 *  - `MonsterWorld`: everything a brain may look at or poke — the hero's
 *    position, the map, effects, hostile projectiles, landing hazards.
 *
 * Brains never touch the scene directly, only this small world facade. The
 * real game passes an adapter over the dungeon scene (sceneWorld.ts); the
 * unit tests pass a plain fake with no canvas, which is how the "monsters
 * never end up inside a wall" simulation runs headless.
 */
import type { MonsterVariant } from "@/game/art/monsters";
import type { ProjectileName } from "@/game/art/weapons";
import type { SfxName } from "../../bridge";
import type { FloatStyle } from "../../engine/juice";
import type { Hazards } from "./hazards";
import type { Monster } from "./monster";

/** Most monsters notice the hero within 5 tiles (and only with a clear line of sight). */
export const NOTICE_RADIUS_PX = 80;

/** Which picture of the monster to draw. */
export interface Pose {
  frame: number;
  variant?: MonsterVariant;
}

export interface Brain {
  /** The hero must come this close (px, with a clear line of sight) before the monster notices. */
  readonly noticeRadius: number;
  /** Counts toward the "at most ~3 pursuers at once" rule (the fleeing Todo Mite does not). */
  readonly pursues: boolean;
  /** Faces the way it moves instead of always looking at the hero. */
  readonly facesMovement: boolean;
  /** One AI step. Not called while the monster is hit-stunned or dying. */
  update(m: Monster, world: MonsterWorld, dt: number): void;
  /** Back to the calm starting state (the hero fainted and is starting over). */
  reset(m: Monster): void;
  /** True while bumping into the monster hurts the hero. */
  harmful(m: Monster): boolean;
  /**
   * True while it is committed to an attack (wind-up or the attack itself):
   * hits still hurt it but no longer pause it, so a telegraphed attack always
   * happens and standing still in front of it is not a free win.
   */
  committed?(m: Monster): boolean;
  /** The step the monster notices the hero. */
  onNotice?(m: Monster, world: MonsterWorld): void;
  /** The monster was hit (after its HP went down). */
  onHit?(m: Monster, world: MonsterWorld): void;
  /** Overrides the idle animation frame / variant. */
  pose?(m: Monster): Pose | null;
  /** True while it hides in plain sight (the Mimic's disguise). */
  disguised?(m: Monster): boolean;
  /** Floor telegraphs (rings, dash lanes), drawn under every body. */
  drawFloor?(g: CanvasRenderingContext2D, m: Monster): void;
  /** Effects drawn just before the body (after-images). */
  drawBehind?(g: CanvasRenderingContext2D, m: Monster): void;
}

/** A hostile projectile as brains describe it (the world turns the name into a sprite). */
export interface HostileShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Half-hearts. */
  damage: number;
  sprite: ProjectileName;
  radius?: number;
  life?: number;
}

/** Game-feel effects a brain can trigger. All are pure decoration. */
export interface MonsterFx {
  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void;
  /** Little dust puffs at the feet (hops, landings, dashes). */
  dust(x: number, y: number, count: number): void;
  /** Twinkling sparkles (phantom shimmer). */
  sparkles(x: number, y: number, count: number): void;
  /** A smoke poof. */
  poof(x: number, y: number): void;
  /** Small coloured drops thrown up (sweat, splashes, glitch pixels). */
  bits(x: number, y: number, count: number, colors: readonly string[]): void;
  /** Loose noodles flying off the Spaghetti Beast. */
  noodles(x: number, y: number, count: number): void;
  shake(amount: number): void;
  /** Floating words over the action ("NameError", "BURP!", "ECHO BROKEN!"). */
  floatText(x: number, y: number, text: string, style?: FloatStyle): void;
  /** A quick full-screen flash (big reveals). */
  flash(color: string, alpha: number, sec: number): void;
  /** Bubbles rising from a spot (a burp). */
  bubbles(x: number, y: number, count: number): void;
  /** Harmless copies of a hero projectile popping up and falling away (the toad burping your shots back up). */
  spitOut(x: number, y: number, sprite: ProjectileName, count: number): void;
  /** An expanding ring on the spot (a reveal). */
  ring(x: number, y: number): void;
}

export interface MonsterWorld {
  /** Seconds since the dungeon scene started (animation clock). */
  readonly time: number;
  /** The hero's feet. */
  readonly hero: { readonly x: number; readonly y: number };
  /**
   * False while monsters must hold back: the first second after the hero
   * walks in (or respawns), while the hero stands in the entrance safe zone,
   * and while the hero lies fainted. Brains check it before starting attacks.
   */
  readonly mayAttack: boolean;
  readonly random: () => number;
  readonly fx: MonsterFx;
  readonly hazards: Hazards;
  /** Is tile (tx, ty) closed to a monster? Walls always; props only for walkers; the entrance safe zone always. */
  blockedTile(tx: number, ty: number, flying: boolean): boolean;
  /** True when no wall stands between the two points. */
  canSee(ax: number, ay: number, bx: number, by: number): boolean;
  /** Hurts the hero (returns false when it was shrugged off: invulnerable, dashing, safe zone…). */
  hurtHero(damage: number, fromX: number, fromY: number, attacker: Monster): boolean;
  fireHostile(shot: HostileShot, owner: Monster): void;
}
