/**
 * The dungeon's END DOOR: a second way out, in the east wall of the last
 * room (placed by src/lib/worldgen/dungeonDoorSpot.ts), so a hero who has
 * fought through every room need not walk all the way back.
 *
 *   shut      while anything in the dungeon is left to fight: barred, a
 *             dim purple seal. Walking into it or pressing E rattles it and
 *             says, kindly, why it is shut. Never just a silent wall.
 *   waiting   the dungeon has just gone QUIET (SPEC F1: every monster
 *             subdued or fixed). A short beat first, so the last monster's
 *             defeat has its own moment.
 *   swinging  the seal shatters, the leaves swing open with a creak and a
 *             flare of warm light (and a shake and sparkles if it is on
 *             screen). Off screen, an arrow at the screen edge points the
 *             way until the hero has seen the door (unless the entrance's
 *             doormat is nearer: then a line just says the door is open).
 *   open      a warm-lit doorway. Stepping in, or E in front of it, leaves
 *             the dungeon exactly like the entrance doormat.
 *
 * Quiet is `isDungeonQuiet` (src/lib/game/progress.ts), asked of the
 * dungeon's file as the scene knows it now. A dungeon already quiet when the
 * hero walks in has its door open from the start; a dungeon rebuilt after an
 * edit is a new scene, so its door starts shut again if new monsters came. The scene owns one door and only calls into it: `update`, the
 * sprite, light and arrow, and the "Press E" spot. The rules (when it opens,
 * when the hero bumps or steps through, where the arrow goes) are pure
 * functions below, unit-tested in tests/engine/endDoor.test.ts.
 */
import { getAtlas } from "@/game/art/atlas";
import { END_DOOR_FRAMES, END_DOOR_OPEN_FRAME } from "@/game/art/dungeonProps";
import { drawSprite } from "@/game/art/engine";
import { uiSprite } from "@/game/art/ui";
import { getProgress, isDungeonQuiet } from "@/lib/game";
import type { AnalyzedFile, Dungeon, Point } from "@/lib/types";
import { VIEW_H, VIEW_W } from "../bridge";
import { TILE_PX } from "../engine/collision";
import type { SceneContext } from "./context";
import type { Interactable } from "./interactions";
import type { Drawable, Light } from "./scene";

// ───────────────────────────── tuning ─────────────────────────────

/** After the dungeon goes quiet, the door waits this long before it opens. */
export const OPEN_DELAY_SEC = 0.9;
/** The leaves take this long to swing open. */
export const SWING_SEC = 0.45;
/** Seconds per animation frame of the seal's pulse and the doorway's motes. */
const FRAME_SEC = 0.18;
/** The dim glow of the seal on the shut door. */
const SHUT_LIGHT = { radius: 16, color: "#9a6cff", strength: 0.6 };
/** The warm light of the open door, which flickers this many px… */
const OPEN_LIGHT = { radius: 34, color: "#ffd98a" };
const OPEN_FLICKER_PX = 2;
const OPEN_FLICKER_SPEED = 3;
/** …and flares up to FLARE_RADIUS when it opens, settling over FLARE_SEC. */
const FLARE_RADIUS = 80;
const FLARE_SEC = 1.2;
/** The seal shatters into this many purple shards; it sits this high above the door's base. */
const SEAL_SHARDS = 10;
const SEAL_HEIGHT_PX = 14;
const SHARD_SPEED = 40;
const SHARD_COLOR = "#b48cff";
/** The opening moment on screen: a shake and a burst of sparkles. */
const OPEN_SHAKE = 0.3;
const OPEN_SPARKLES = 18;
const SPARKLE_SPEED = 55;
/** The hero bumps the shut door when their feet come this close (px) to it, walking into it. */
const BUMP_REACH_PX = 7;
/** While the hero keeps pushing, the friendly line repeats at most this often. */
const BUMP_COOLDOWN_SEC = 2.5;
/** A bumped door rattles this long, this many px. */
const RATTLE_SEC = 0.25;
const RATTLE_PX = 1;
/** The rattling door jumps from side to side this many times a second. */
const RATTLE_FLIPS_PER_SEC = 30;
/** The off-screen arrow stays this far inside the screen edge and bobs this many px toward the door. */
export const EDGE_MARGIN_PX = 14;
const ARROW_BOB_PX = 2;
const ARROW_BOB_SPEED = 6;
/** A fainter second arrow trails this far behind the first. */
const ARROW_TRAIL_PX = 6;
const ARROW_TRAIL_ALPHA = 0.55;
/** The door counts as seen (and the arrow goes away) after this long on screen, open. */
const SEEN_SEC = 0.4;
/** The arrow sprite points down: rotating it by (angle − this) points it at the door. */
const ARROW_POINTS = Math.PI / 2;

/** What the shut door says when bumped or tried. */
export const SHUT_LINE = "The way out opens when the dungeon is quiet.";
/** What the door says when it opens out of sight… */
export const OPENED_LINE = "The end door is open: follow the arrow!";
/** …or, with the entrance's doormat nearer to the hero, without an arrow. */
export const OPENED_NEAR_ENTRANCE_LINE = "The end door in the last room is open too.";

// ───────────────────────────── rules ─────────────────────────────

export type DoorState = "shut" | "waiting" | "swinging" | "open";

/** Where the door is in its life, and for how long it has been there (seconds). */
export interface DoorClock {
  state: DoorState;
  age: number;
}

/**
 * One step of the door's life: shut until the dungeon is quiet, then a beat
 * of waiting, then the swing, then open. Whenever the dungeon is not quiet
 * (new monsters came with an edit), it is shut again at once.
 */
export function stepDoor(clock: DoorClock, quiet: boolean, dt: number): DoorClock {
  if (!quiet) return { state: "shut", age: 0 };
  const age = clock.age + dt;
  if (clock.state === "shut") return { state: "waiting", age: 0 };
  if (clock.state === "waiting" && age >= OPEN_DELAY_SEC) return { state: "swinging", age: 0 };
  if (clock.state === "swinging" && age >= SWING_SEC) return { state: "open", age: 0 };
  return { state: clock.state, age };
}

/** True while the door blocks the way (it opens up as soon as it starts to swing). */
export function isBarred(state: DoorState): boolean {
  return state === "shut" || state === "waiting";
}

/** Which art frame to draw: 0 shut … END_DOOR_OPEN_FRAME open, the frames between while it swings. */
export function doorOpenness(clock: DoorClock): number {
  if (isBarred(clock.state)) return 0;
  if (clock.state === "open") return END_DOOR_OPEN_FRAME;
  const swingFrames = END_DOOR_OPEN_FRAME - 1;
  return 1 + Math.min(swingFrames - 1, Math.floor((clock.age / SWING_SEC) * swingFrames));
}

/** The row of tiles the hero's feet are in (as the entrance doormat counts it). */
const feetRow = (hero: Point) => Math.floor((hero.y - 3) / TILE_PX);

/** True when the hero stands right in front of the door (tile `door`), walking into it. */
export function isPushingDoor(door: Point, hero: Point, walkingIn: boolean): boolean {
  const gap = door.x * TILE_PX - hero.x;
  return walkingIn && feetRow(hero) === door.y && gap >= 0 && gap <= BUMP_REACH_PX;
}

/**
 * True when the arrow to the end door is worth showing: the hero (feet, px)
 * is nearer to it than to the entrance's doormat, the other way out.
 */
export function endDoorIsNearer(hero: Point, door: Point, exit: Point): boolean {
  const tiles = (t: Point) => Math.hypot(hero.x - (t.x + 0.5) * TILE_PX, hero.y - (t.y + 0.5) * TILE_PX);
  return tiles(door) < tiles(exit);
}

/** True when the hero's feet are in the doorway tile. */
export function isInDoorway(door: Point, hero: Point): boolean {
  return Math.floor(hero.x / TILE_PX) === door.x && feetRow(hero) === door.y;
}

/** The part of the world on screen (world px). */
export interface View {
  left: number;
  top: number;
  w: number;
  h: number;
}

/**
 * Where the "this way" arrow goes for a target off screen: where the line
 * from the screen's centre to the target leaves the screen, pulled
 * EDGE_MARGIN_PX inside it, with the angle (radians) pointing at the target.
 * Null when the target is on screen.
 */
export function edgeArrow(target: Point, view: View): { x: number; y: number; angle: number } | null {
  const inside = target.x >= view.left && target.x <= view.left + view.w && target.y >= view.top && target.y <= view.top + view.h;
  if (inside) return null;
  const cx = view.left + view.w / 2;
  const cy = view.top + view.h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const reachX = view.w / 2 - EDGE_MARGIN_PX;
  const reachY = view.h / 2 - EDGE_MARGIN_PX;
  // Shrink the centre→target line until it fits inside the margin box.
  const k = Math.min(dx === 0 ? Infinity : reachX / Math.abs(dx), dy === 0 ? Infinity : reachY / Math.abs(dy));
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx) };
}

// ───────────────────────────── the door ─────────────────────────────

/** What the door needs from its scene. */
export interface EndDoorHooks {
  /** The dungeon's file as the scene knows it now (it can change when the code is edited). */
  file(): AnalyzedFile;
  /** Leave the dungeon the way the entrance doormat does. */
  leave(): void;
  /** Show a line of text to the player. */
  say(text: string): void;
}

export class EndDoor {
  private clock: DoorClock;
  /** Seconds the open door has been on screen (the arrow stops once it is seen). */
  private seenFor = 0;
  /** True when the door opened out of sight and the hero needs the arrow to find it. */
  private pointTheWay = false;
  private flareAge = Infinity;
  private rattleAge = Infinity;
  private bumpCooldown = 0;

  /** The end door's tile, and the entrance's doormat (the other way out). */
  private readonly door: Point;
  private readonly exit: Point;

  constructor(
    private readonly ctx: SceneContext,
    dungeon: Pick<Dungeon, "endDoor" | "exit">,
    private readonly hooks: EndDoorHooks,
  ) {
    this.door = dungeon.endDoor;
    this.exit = dungeon.exit;
    this.clock = this.isQuiet() ? { state: "open", age: 0 } : { state: "shut", age: 0 };
    ctx.setBlocked(this.door.x, this.door.y, isBarred(this.clock.state));
  }

  update(dt: number): void {
    const { ctx, door, hooks } = this;
    const before = this.clock.state;
    this.clock = stepDoor(this.clock, this.isQuiet(), dt);
    if (before !== this.clock.state) ctx.setBlocked(door.x, door.y, isBarred(this.clock.state));
    if (before === "waiting" && this.clock.state === "swinging") this.openingMoment();
    this.flareAge += dt;
    this.rattleAge += dt;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    if (!isBarred(this.clock.state) && this.onScreen()) this.seenFor += dt;

    const hero = ctx.game.player;
    if (hero.fainted) return;
    if (!isBarred(this.clock.state) && isInDoorway(door, hero)) hooks.leave();
    else if (isBarred(this.clock.state) && this.bumpCooldown === 0 && isPushingDoor(door, hero, ctx.game.input.held("right"))) this.rattle();
  }

  /**
   * The door's sprite. It is sorted by the top of its tile, like the wall it
   * is cut into, so a hero standing on its row is drawn in front of it.
   */
  drawables(out: Drawable[]): void {
    const x = this.door.x * TILE_PX + TILE_PX / 2;
    const base = (this.door.y + 1) * TILE_PX;
    const shake = this.rattleAge < RATTLE_SEC ? (Math.floor(this.rattleAge * RATTLE_FLIPS_PER_SEC) % 2 ? RATTLE_PX : -RATTLE_PX) : 0;
    const sprite = getAtlas(this.ctx.game.theme()).endDoor(doorOpenness(this.clock), Math.floor(this.ctx.time / FRAME_SEC) % END_DOOR_FRAMES);
    out.push({ y: this.door.y * TILE_PX, draw: (g) => drawSprite(g, sprite, x + shake, base) });
  }

  lights(out: Light[]): void {
    const x = this.door.x * TILE_PX + TILE_PX / 2;
    const y = this.door.y * TILE_PX + TILE_PX / 2;
    if (isBarred(this.clock.state)) {
      out.push({ ...SHUT_LIGHT, x, y: y - TILE_PX / 4 });
      return;
    }
    const flare = Math.max(0, 1 - this.flareAge / FLARE_SEC);
    const radius = OPEN_LIGHT.radius + (FLARE_RADIUS - OPEN_LIGHT.radius) * flare + Math.sin(this.ctx.time * OPEN_FLICKER_SPEED) * OPEN_FLICKER_PX;
    out.push({ ...OPEN_LIGHT, x, y, radius });
  }

  /** The "this way" arrow at the screen edge, drawn above the darkness (world space). */
  drawArrow(g: CanvasRenderingContext2D): void {
    if (!this.pointTheWay || this.seenFor >= SEEN_SEC || isBarred(this.clock.state)) return;
    const cam = this.ctx.camera;
    const target = { x: this.door.x * TILE_PX + TILE_PX / 2, y: this.door.y * TILE_PX };
    const arrow = edgeArrow(target, { left: cam.left, top: cam.top, w: VIEW_W, h: VIEW_H });
    if (!arrow) return;
    const bob = Math.round(Math.sin(this.ctx.time * ARROW_BOB_SPEED) * ARROW_BOB_PX);
    const dx = Math.cos(arrow.angle);
    const dy = Math.sin(arrow.angle);
    const sprite = uiSprite("arrowDown", 0);
    const rotation = arrow.angle - ARROW_POINTS;
    // A double chevron: a fainter arrow trailing behind the first one.
    drawSprite(g, sprite, arrow.x + dx * (bob - ARROW_TRAIL_PX), arrow.y + dy * (bob - ARROW_TRAIL_PX), { rotation, alpha: ARROW_TRAIL_ALPHA });
    drawSprite(g, sprite, arrow.x + dx * bob, arrow.y + dy * bob, { rotation });
  }

  /** "Press E" in front of the door: try it while it is shut, leave once it is open. */
  interactable(): Interactable {
    return {
      x: (this.door.x - 1) * TILE_PX + TILE_PX / 2,
      y: this.door.y * TILE_PX + TILE_PX / 2,
      radius: 14,
      prompt: () => (isBarred(this.clock.state) ? "Try the end door" : "Leave through the end door"),
      activate: () => (isBarred(this.clock.state) ? this.rattle() : this.hooks.leave()),
    };
  }

  /** Nothing left to fight: every finding still in the code is subdued (SPEC F1). */
  private isQuiet(): boolean {
    return isDungeonQuiet(this.hooks.file(), getProgress(this.ctx.save.get(), this.ctx.repoKey));
  }

  private onScreen(): boolean {
    return this.ctx.camera.sees(this.door.x * TILE_PX, this.door.y * TILE_PX - TILE_PX, TILE_PX, 2 * TILE_PX);
  }

  /** The door shakes in its frame and says why it is shut. */
  private rattle(): void {
    this.rattleAge = 0;
    this.bumpCooldown = BUMP_COOLDOWN_SEC;
    this.ctx.audio.sfx("door", { pitch: 1.7, volume: 0.35 });
    this.hooks.say(SHUT_LINE);
  }

  /** The seal shatters and the door swings open: sound and light, and sparkles or an arrow. */
  private openingMoment(): void {
    const { ctx } = this;
    this.flareAge = 0;
    ctx.audio.sfx("break", { pitch: 1.3, volume: 0.6 });
    ctx.audio.sfx("door", { pitch: 0.75 });
    ctx.audio.sfx("revealRare", { volume: 0.8 });
    const x = this.door.x * TILE_PX + TILE_PX / 2;
    const y = this.door.y * TILE_PX + TILE_PX / 2;
    const baseY = (this.door.y + 1) * TILE_PX;
    ctx.particles.burst(SEAL_SHARDS, x, baseY, SHARD_SPEED, { z: SEAL_HEIGHT_PX, life: 0.6, color: SHARD_COLOR, size: 1, gravity: 160, drag: 1 });
    if (!this.onScreen()) {
      this.pointTheWay = endDoorIsNearer(ctx.game.player, this.door, this.exit);
      this.hooks.say(this.pointTheWay ? OPENED_LINE : OPENED_NEAR_ENTRANCE_LINE);
      return;
    }
    ctx.shake(OPEN_SHAKE);
    ctx.particles.burst(OPEN_SPARKLES, x, y, SPARKLE_SPEED, { life: 0.9, sprite: uiSprite("sparkle", 0), drag: 2.5 });
  }
}
