/**
 * UNDEFINED NAME — the Phantom is the name that was never defined.
 *
 *   shimmer ──(hero steps on the rune)──────────► defined: reveal + stunned (RUNE_STUN_SEC)
 *      │    ──(NAME_ERRORS_TO_DEFINE hits)──────► defined: short stun
 *      │    ──(SELF_DEFINE_SEC near the hero)───► defined: short stun
 *      └ while a shimmer: barely visible, harmless, and hits only raise "NameError"
 *
 * A glowing rune lies on the floor near it, spelling the missing name from
 * Ruff's message ("Undefined name `PRICES`" → PRICES). Stepping on it
 * defines the name: a white flash, a burst of sparkles, and the phantom
 * turns solid and sees stars for a moment. Ignoring the rune costs only a
 * few seconds, so the trait never makes the fight harder.
 *
 * While it is a shimmer the brain is off (it just hovers at home) and it
 * counts as an "object" for the hero's attacks: no damage numbers, because
 * there is nothing there to damage yet.
 */
import { drawText } from "@/game/art/font";
import type { Light } from "../../../scenes/scene";
import type { MonsterWorld } from "../brain";
import type { Monster } from "../monster";
import type { Trait } from "./trait";

const TILE = 16;
/** Circles on the floor are seen at an angle: their height is this share of their width. */
const FLOOR_SQUASH = 0.6;
/** Shimmer opacity breathes between these values, this many times per second. */
const SHIMMER_ALPHA_MIN = 0.2;
const SHIMMER_ALPHA_MAX = 0.42;
const SHIMMER_HZ = 1.4;
const SHIMMER_SPARKLE_SEC = 0.35;
/** It hovers like the defined phantom does (see blinker.ts), drifting in a small circle around home. */
const HOVER_PX = 3;
const BOB_PX = 2;
const BOB_RATE = 3;
const DRIFT_RADIUS_PX = 5;
const DRIFT_RATE = 0.8;
const DRIFT_SPEED = 10;
/** Ways it gets defined without the rune. */
const NAME_ERRORS_TO_DEFINE = 3;
const SELF_DEFINE_SEC = 8;
/** The hero's feet must come this close to the rune's centre to step on it. */
const RUNE_STEP_PX = 9;
/** Stars after the rune reveal / after defining itself. */
const RUNE_STUN_SEC = 1.8;
const SELF_STUN_SEC = 0.6;
/** It fades from shimmer to solid over this long. */
const REVEAL_FADE_SEC = 0.25;
const REVEAL_STRETCH = 0.45;
const REVEAL_FLASH = { color: "#e9fffa", alpha: 0.45, sec: 0.35 };
const REVEAL_SHAKE = 0.25;
const REVEAL_SPARKLES = 14;
/** The NameError flicker: drawn this opaque for a moment after a hit passes through. */
const FLICKER_ALPHA = 0.7;
const FLICKER_SEC = 0.12;
const NAME_ERROR_BITS = ["#ff6b8a", "#ffffff"];
/** The rune: a ring of dots, a smaller inner ring, both breathing. */
const RUNE_COLOR = "#8affe0";
const RUNE_TEXT_COLOR = "#d9fff5";
const RUNE_OUTLINE = "#0f2a2a";
const RUNE_RADIUS_PX = 9;
const RUNE_INNER_PX = 5;
/** The rune's faint glowing floor disc. */
const RUNE_FILL_ALPHA = 0.18;
const RUNE_PULSE_HZ = 1.2;
/** The rune's brightness breathes between RUNE_PULSE_MIN and 1; the inner ring is a bit dimmer. */
const RUNE_PULSE_MIN = 0.3;
const RUNE_INNER_DIM = 0.8;
/** The outer ring turns slowly one way, the inner one faster the other way (radians per second). */
const RUNE_OUTER_SPIN = 0.5;
const RUNE_INNER_SPIN = -1;
/** A dotted thread ties the rune to its phantom while both are within this distance (px). */
const THREAD_MAX_PX = 80;
const THREAD_GAP_PX = 5;
const THREAD_ALPHA = 0.5;
/** The name floats this far above the rune's centre. */
const NAME_LIFT_PX = 12;
const RUNE_LIGHT: Omit<Light, "x" | "y"> = { radius: 26, color: RUNE_COLOR, strength: 0.75 };

export class UndefinedNameTrait implements Trait {
  private defined = false;
  private engagedFor = 0;
  private nameErrors = 0;
  private stunLeft = 0;
  /** Seconds since it was defined (it fades in to solid over REVEAL_FADE_SEC). */
  private revealAge = REVEAL_FADE_SEC;
  private flicker = 0;
  private sparkleClock = 0;

  /** `rune` is the floor tile spelling `name` (claimed with FloorSpots); null starts it defined. */
  constructor(
    private readonly name: string,
    private readonly rune: { x: number; y: number } | null,
  ) {
    this.defined = rune === null;
  }

  /** The rune's floor tile (null when there was no room for one). */
  get runeTile(): { x: number; y: number } | null {
    return this.rune;
  }

  /** True once the name is defined (the phantom is solid and fights normally). */
  get isDefined(): boolean {
    return this.defined;
  }

  holdsBrain(): boolean {
    return !this.defined || this.stunLeft > 0;
  }

  passesThrough(): boolean {
    return !this.defined;
  }

  /** A hit on the shimmer: no damage, just "NameError" — and a few of them define the name anyway. */
  absorbsHit(m: Monster, world: MonsterWorld): boolean {
    if (this.defined) return false;
    this.nameErrors++;
    this.flicker = FLICKER_SEC;
    world.fx.sfx("error", { pitch: 1.3, volume: 0.5 });
    world.fx.floatText(m.x, m.y - m.def.size - 6, "NameError", "damage");
    world.fx.bits(m.x, m.y - 8, 4, NAME_ERROR_BITS);
    if (this.nameErrors >= NAME_ERRORS_TO_DEFINE) this.define(m, world, SELF_STUN_SEC);
    return true;
  }

  update(m: Monster, world: MonsterWorld, dt: number): void {
    if (!this.defined) {
      this.shimmer(m, world, dt);
      return;
    }
    if (this.revealAge < REVEAL_FADE_SEC) {
      this.revealAge += dt;
      m.alpha = Math.min(1, this.revealAge / REVEAL_FADE_SEC);
    }
    if (this.stunLeft > 0) {
      this.stunLeft = Math.max(0, this.stunLeft - dt);
      m.dizzy = this.stunLeft > 0;
    }
  }

  reset(m: Monster): void {
    this.engagedFor = 0;
    this.stunLeft = 0;
    m.dizzy = false;
    if (!this.defined) m.alpha = SHIMMER_ALPHA_MIN;
  }

  drawFloor(g: CanvasRenderingContext2D, m: Monster, time: number): void {
    if (this.defined || !this.rune) return;
    const { x, y } = runeCentre(this.rune);
    const pulse = RUNE_PULSE_MIN + (1 - RUNE_PULSE_MIN) * (0.5 + 0.5 * Math.sin(time * RUNE_PULSE_HZ * Math.PI * 2));
    g.save();
    g.fillStyle = RUNE_COLOR;
    g.globalAlpha = RUNE_FILL_ALPHA * pulse;
    fillEllipse(g, x, y, RUNE_RADIUS_PX);
    g.globalAlpha = pulse;
    dotRing(g, x, y, RUNE_RADIUS_PX, 2, time * RUNE_OUTER_SPIN);
    g.globalAlpha = pulse * RUNE_INNER_DIM;
    dotRing(g, x, y, RUNE_INNER_PX, 2, time * RUNE_INNER_SPIN);
    if (Math.hypot(m.x - x, m.y - y) <= THREAD_MAX_PX) {
      g.globalAlpha = THREAD_ALPHA;
      dottedThread(g, x, y, m.x, m.y, time);
    }
    g.restore();
  }

  drawOverlay(g: CanvasRenderingContext2D, _m: Monster, time: number): void {
    if (this.defined || !this.rune) return;
    const { x, y } = runeCentre(this.rune);
    const bob = Math.round(Math.sin(time * 2) * 1);
    drawText(g, this.name, x, y - NAME_LIFT_PX + bob, { color: RUNE_TEXT_COLOR, outline: RUNE_OUTLINE, align: "center" });
  }

  lights(_m: Monster, out: Light[]): void {
    if (this.defined || !this.rune) return;
    out.push({ ...RUNE_LIGHT, ...runeCentre(this.rune) });
  }

  /** Barely there: breathing opacity, a few sparkles, hovering in a small circle at home; the rune waits. */
  private shimmer(m: Monster, world: MonsterWorld, dt: number): void {
    const breath = 0.5 + 0.5 * Math.sin(m.anim * SHIMMER_HZ * Math.PI * 2);
    this.flicker = Math.max(0, this.flicker - dt);
    m.alpha = this.flicker > 0 ? FLICKER_ALPHA : SHIMMER_ALPHA_MIN + (SHIMMER_ALPHA_MAX - SHIMMER_ALPHA_MIN) * breath;
    m.targetable = true;
    m.z = HOVER_PX + Math.sin(m.anim * BOB_RATE) * BOB_PX;
    const a = m.anim * DRIFT_RATE;
    m.walkToward(m.homeX + Math.cos(a) * DRIFT_RADIUS_PX, m.homeY + Math.sin(a) * DRIFT_RADIUS_PX, DRIFT_SPEED);
    this.sparkleClock += dt;
    if (this.sparkleClock >= SHIMMER_SPARKLE_SEC) {
      this.sparkleClock = 0;
      world.fx.sparkles(m.x + (world.random() - 0.5) * 10, m.y - 8 - world.random() * 8, 1);
    }
    if (m.engaged) this.engagedFor += dt;
    if (this.rune && this.heroOnRune(world)) this.define(m, world, RUNE_STUN_SEC, true);
    else if (this.engagedFor >= SELF_DEFINE_SEC) this.define(m, world, SELF_STUN_SEC);
  }

  private heroOnRune(world: MonsterWorld): boolean {
    const { x, y } = runeCentre(this.rune!);
    return Math.hypot(world.hero.x - x, world.hero.y - y) <= RUNE_STEP_PX;
  }

  /** The reveal: the name exists now, so the phantom turns solid (and, by the rune, the big moment). */
  private define(m: Monster, world: MonsterWorld, stun: number, byRune = false): void {
    this.defined = true;
    this.revealAge = 0;
    this.stunLeft = stun;
    m.dizzy = true;
    m.targetable = true;
    m.stretch = REVEAL_STRETCH;
    m.stop();
    const midY = m.y - m.def.size / 2;
    world.fx.ring(m.x, midY);
    world.fx.sparkles(m.x, midY, REVEAL_SPARKLES);
    world.fx.sfx("revealRare", { pitch: byRune ? 1 : 1.3, volume: byRune ? 0.8 : 0.5 });
    if (!byRune || !this.rune) {
      world.fx.floatText(m.x, m.y - m.def.size - 8, `${this.name} defined!`, "good");
      return;
    }
    // By the rune: the name on the floor becomes real right where it was written.
    const rune = runeCentre(this.rune);
    world.fx.floatText(rune.x, rune.y - NAME_LIFT_PX, `${this.name} defined!`, "good");
    world.fx.flash(REVEAL_FLASH.color, REVEAL_FLASH.alpha, REVEAL_FLASH.sec);
    world.fx.shake(REVEAL_SHAKE);
    world.fx.ring(rune.x, rune.y);
    world.fx.sparkles(rune.x, rune.y, REVEAL_SPARKLES);
  }
}

function runeCentre(tile: { x: number; y: number }): { x: number; y: number } {
  return { x: tile.x * TILE + TILE / 2, y: tile.y * TILE + TILE / 2 + 2 };
}

/** A ring of single-pixel dots, `gap` px apart, slowly turning with `spin`. */
function dotRing(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, gap: number, spin: number): void {
  const dots = Math.max(6, Math.round((Math.PI * 2 * r) / gap));
  for (let i = 0; i < dots; i++) {
    const a = spin + (i / dots) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * FLOOR_SQUASH), 1, 1);
  }
}

/** A flattened filled disc made of 1-px rows (the rune's glow on the floor). */
function fillEllipse(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const ry = Math.round(r * FLOOR_SQUASH);
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.round(r * Math.sqrt(1 - (dy / ry) ** 2));
    g.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

/** Dots marching from the rune toward the phantom: "this name belongs to that ghost". */
function dottedThread(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, time: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const offset = (time * 8) % THREAD_GAP_PX;
  for (let d = RUNE_RADIUS_PX + offset; d < len - 4; d += THREAD_GAP_PX) {
    g.fillRect(Math.round(x0 + ((x1 - x0) * d) / len), Math.round(y0 + ((y1 - y0) * d) / len), 1, 1);
  }
}
