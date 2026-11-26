/**
 * REWRITTEN: what a monster does when its bug is fixed for real in the
 * Workshop instead of being beaten in a fight. It is not a death (no squash,
 * no coins: the forge already paid). The code it was made of is rewritten
 * under it:
 *
 *   a bright scan line sweeps down the body, top to bottom (REWRITE_SEC);
 *   above the line the body is gone, turned into little glyphs of code
 *   ({ } ( ) = ; …) that float up and fade from cyan to gold;
 *   below it the body flickers under a cyan silhouette;
 *   "FIXED!" floats up, and a few sparkles pop when the line reaches the feet.
 *
 * The director hands a monster over with `start` (it leaves the fight at
 * once); this class only draws the effect until it is over.
 */
import { uiSprite } from "@/game/art/ui";
import { drawText } from "@/game/art/font";
import type { Sprite } from "@/game/art";
import type { SceneContext } from "../../scenes/context";
import type { Drawable, Light } from "../../scenes/scene";
import type { Monster } from "./monster";
import { currentSprite, tinted } from "./monsterDraw";

/** How long the scan line takes to sweep the body away. */
export const REWRITE_SEC = 0.9;
const SCAN_COLOR = "#bffcff";
const GHOST_COLOR = "#6fe7ff";
/** The silhouette over the body flickers between these opacities. */
const GHOST_ALPHA_LOW = 0.25;
const GHOST_ALPHA_HIGH = 0.7;
const GHOST_FLICKER_HZ = 14;
/** The scan line reaches this far past the body on each side (px). */
const SCAN_OVERHANG_PX = 2;
/** The code characters the body turns into. */
const GLYPHS = "{}()[]=;:+<>/#*";
const GLYPH_COLORS = ["#8affff", "#c8fff7", "#ffe7a0"];
/** Glyphs released over the whole sweep, at most (bigger monsters get more, up to this). */
const MAX_GLYPHS = 16;
/** One glyph per this many pixels of body width, per sweep. */
const GLYPH_EVERY_PX = 1.5;
const GLYPH_LIFE_SEC = 0.9;
/** Glyphs rise this fast (px/s), with this much sideways drift either way. */
const GLYPH_RISE = 24;
const GLYPH_DRIFT = 10;
const GLYPH_OUTLINE = "#0f2a3a";
/** Sparkles popping when the line reaches the feet. */
const END_SPARKLES = 10;
const END_SPARKLE_SPEED = 40;
const LIGHT: Omit<Light, "x" | "y"> = { radius: 26, color: "#8affff", strength: 0.8 };
/** "FIXED!" starts this far above the head. */
const LABEL_LIFT_PX = 6;

interface Glyph {
  x: number;
  y: number;
  vx: number;
  char: string;
  color: string;
  age: number;
}

/** A monster being rewritten: a snapshot of how it looked, and the sweep's progress. */
interface Body {
  sprite: Sprite;
  x: number;
  y: number;
  scale: number;
  facingLeft: boolean;
  age: number;
  glyphsDue: number;
  glyphsOut: number;
}

/** A random element of `list` (a string is a list of characters). */
function randomItem(list: string | readonly string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

/** How far down the body the scan line is (0 = top, 1 = feet), easing in so the start reads. */
function sweep(age: number): number {
  const k = Math.min(1, age / REWRITE_SEC);
  return k * k * (3 - 2 * k);
}

export class Rewrites {
  private bodies: Body[] = [];
  private glyphs: Glyph[] = [];

  constructor(private readonly ctx: SceneContext) {}

  /** True while any body or glyph is still on screen. */
  get active(): boolean {
    return this.bodies.length > 0 || this.glyphs.length > 0;
  }

  /** Starts rewriting `m` (the caller has already taken it out of the fight). */
  start(m: Monster): void {
    const sprite = currentSprite(m);
    const width = sprite.w * m.scale;
    this.bodies.push({ sprite, x: m.x, y: m.y - m.z, scale: m.scale, facingLeft: m.facingLeft, age: 0, glyphsDue: Math.min(MAX_GLYPHS, Math.ceil(width / GLYPH_EVERY_PX)), glyphsOut: 0 });
    this.ctx.floatText(m.x, m.y - m.z - sprite.ay * m.scale - LABEL_LIFT_PX, "FIXED!", "good");
  }

  update(dt: number): void {
    for (const body of this.bodies) {
      const before = body.age;
      body.age += dt;
      this.releaseGlyphs(body);
      if (before < REWRITE_SEC && body.age >= REWRITE_SEC) this.sparkle(body);
    }
    this.bodies = this.bodies.filter((body) => body.age < REWRITE_SEC);
    for (const glyph of this.glyphs) {
      glyph.age += dt;
      glyph.x += glyph.vx * dt;
      glyph.y -= GLYPH_RISE * dt;
    }
    this.glyphs = this.glyphs.filter((glyph) => glyph.age < GLYPH_LIFE_SEC);
  }

  /** The part of each body the scan line has not reached yet, in the y-sorted world layer. */
  drawables(out: Drawable[]): void {
    for (const body of this.bodies) out.push({ y: body.y, draw: (g) => this.drawBody(g, body) });
  }

  /** The glyphs, drawn above the dungeon's darkness so they always read. */
  overlay(g: CanvasRenderingContext2D): void {
    for (const glyph of this.glyphs) {
      const alpha = 1 - glyph.age / GLYPH_LIFE_SEC;
      drawText(g, glyph.char, Math.round(glyph.x), Math.round(glyph.y), { color: glyph.color, outline: GLYPH_OUTLINE, alpha });
    }
  }

  lights(out: Light[]): void {
    for (const body of this.bodies) out.push({ ...LIGHT, x: body.x, y: this.scanY(body) });
  }

  clear(): void {
    this.bodies = [];
    this.glyphs = [];
  }

  // ───────────── internals ─────────────

  private top(body: Body): number {
    return body.y - body.sprite.ay * body.scale;
  }

  private scanY(body: Body): number {
    return this.top(body) + body.sprite.h * body.scale * sweep(body.age);
  }

  /** Glyphs come off the body where the scan line is, spread evenly over the sweep. */
  private releaseGlyphs(body: Body): void {
    const due = Math.floor(body.glyphsDue * sweep(body.age));
    const half = (body.sprite.w * body.scale) / 2;
    for (; body.glyphsOut < due; body.glyphsOut++) {
      this.glyphs.push({
        x: body.x - half + Math.random() * half * 2,
        y: this.scanY(body) - 4,
        vx: (Math.random() - 0.5) * 2 * GLYPH_DRIFT,
        char: randomItem(GLYPHS),
        color: randomItem(GLYPH_COLORS),
        age: 0,
      });
    }
  }

  private sparkle(body: Body): void {
    this.ctx.particles.burst(END_SPARKLES, body.x, body.y, END_SPARKLE_SPEED, { life: 0.6, sprite: uiSprite("sparkle", 0), drag: 2.5 });
  }

  private drawBody(g: CanvasRenderingContext2D, body: Body): void {
    const { sprite, scale } = body;
    const scan = this.scanY(body);
    const half = (sprite.w * scale) / 2;
    const bottom = this.top(body) + sprite.h * scale;
    g.save();
    g.beginPath();
    g.rect(body.x - half - 1, scan, half * 2 + 2, bottom - scan + 1);
    g.clip();
    g.translate(Math.round(body.x), Math.round(body.y));
    g.scale(body.facingLeft ? -scale : scale, scale);
    g.drawImage(sprite.canvas, -sprite.ax, -sprite.ay);
    const flicker = Math.floor(body.age * GHOST_FLICKER_HZ) % 2 === 0;
    g.globalAlpha = flicker ? GHOST_ALPHA_HIGH : GHOST_ALPHA_LOW;
    g.drawImage(tinted(sprite, GHOST_COLOR).canvas, -sprite.ax, -sprite.ay);
    g.restore();
    g.fillStyle = SCAN_COLOR;
    g.fillRect(Math.round(body.x - half - SCAN_OVERHANG_PX), Math.round(scan), Math.round(half * 2 + SCAN_OVERHANG_PX * 2), 1);
  }
}
