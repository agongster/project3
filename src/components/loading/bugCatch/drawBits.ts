/**
 * Small drawing helpers for draw.ts: shadows, coins and hearts, the bug
 * net, catch particles and the theme's ambient motes. Every sprite comes
 * from the art module (src/game/art); this file only decides where and how
 * they are placed.
 */
import { drawSprite, glowSprite, THEME_COLORS, type Sprite } from "@/game/art";
import { uiSprite, type UiSpriteName } from "@/game/art/ui";
import { weaponSprite } from "@/game/art/weapons";
import type { ThemeId } from "@/lib/types";
import type { Ambient, AmbientStyle } from "./ambient";
import type { Effects, Particle } from "./effects";
import type { Faller } from "./fallers";
import type { Hero } from "./hero";
import { GROUND_Y } from "./tuning";

// ───────────────────────────── shadows ─────────────────────────────

/** A faller's shadow appears on the ground once it is this close to landing. */
const SHADOW_RANGE = 70;

export function drawFallerShadow(ctx: CanvasRenderingContext2D, f: Faller): void {
  const height = GROUND_Y - f.y;
  if (height > SHADOW_RANGE) return;
  const alpha = 1 - Math.max(0, height) / SHADOW_RANGE;
  drawSprite(ctx, uiSprite("shadowSmall"), f.x, GROUND_Y, { alpha });
}

export function drawHeroShadow(ctx: CanvasRenderingContext2D, hero: Hero): void {
  drawSprite(ctx, uiSprite("shadowMedium"), hero.x, GROUND_Y);
}

// ───────────────────────────── coins & hearts ─────────────────────────────

/** Seconds per frame of the coin's spin. */
const COIN_FRAME_SECONDS = 0.1;
/** Hearts bob gently as they float down. */
const HEART_BOB_PX = 1.5;

/** Draws a sprite centred on (x, y), whatever its anchor is. */
function drawCentered(ctx: CanvasRenderingContext2D, sprite: Sprite, x: number, y: number): void {
  drawSprite(ctx, sprite, x - sprite.w / 2 + sprite.ax, y - sprite.h / 2 + sprite.ay);
}

export function drawPickup(ctx: CanvasRenderingContext2D, f: Faller, time: number): void {
  if (f.kind === "coin") {
    drawCentered(ctx, uiSprite("coin", Math.floor(time / COIN_FRAME_SECONDS) + f.id), f.x, f.y);
  } else {
    drawCentered(ctx, uiSprite("heartPickup"), f.x, f.y + HEART_BOB_PX * Math.sin(time * 4 + f.id));
  }
}

// ───────────────────────────── the net ─────────────────────────────

/** The net is held high, tilted a little forward (radians; 0 = pointing straight ahead, negative = up). */
const NET_REST_ANGLE = -1.3;
/** On a catch it scoops up and back over the head by up to this much, then returns. */
const NET_SWISH_ARC = -0.9;
/** Little bob while running, per walk-cycle step. */
const NET_STEP_BOB = 0.08;
/** Where the hand holding the net is, relative to the hero's feet. */
const HAND_FORWARD = 4;
const HAND_HEIGHT = 12;
/** The big-net power-up draws the net this much larger. */
const BIG_NET_DRAW_SCALE = 1.5;

export function drawNet(ctx: CanvasRenderingContext2D, hero: Hero, step: number): void {
  const swing = NET_SWISH_ARC * Math.sin(hero.swish * Math.PI);
  const angle = NET_REST_ANGLE + swing + (step === 0 ? 0 : NET_STEP_BOB);
  const facingLeft = hero.facing === -1;
  drawSprite(ctx, weaponSprite("bugNet"), hero.x + hero.facing * HAND_FORWARD, GROUND_Y - HAND_HEIGHT, {
    flipX: facingLeft,
    // A left-facing (mirrored) net must also rotate the mirrored way.
    rotation: facingLeft ? -angle : angle,
    scale: hero.bigNetLeft > 0 ? BIG_NET_DRAW_SCALE : 1,
  });
}

// ───────────────────────────── particles ─────────────────────────────

/** Animation speed of sprite particles (seconds per frame). */
const PARTICLE_FRAME_SECONDS = 0.08;

const PARTICLE_SPRITE: Record<Exclude<Particle["kind"], "pixel">, UiSpriteName> = {
  sparkle: "sparkle",
  star: "star",
  dust: "dust",
  heart: "heartTiny",
};

export function drawParticles(ctx: CanvasRenderingContext2D, fx: Effects): void {
  for (const p of fx.particles) {
    const t = p.age / p.life;
    const alpha = 1 - t * t; // stays bright, then fades out quickly at the end
    if (p.kind === "pixel") {
      const size = t < 0.5 ? 2 : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
      ctx.globalAlpha = 1;
      continue;
    }
    const sprite = uiSprite(PARTICLE_SPRITE[p.kind], Math.floor(p.age / PARTICLE_FRAME_SECONDS));
    drawCentered(ctx, sprite, p.x, p.y);
  }
}

// ───────────────────────────── ambient motes ─────────────────────────────

const AMBIENT_SPRITE: Record<AmbientStyle, UiSpriteName> = {
  pollen: "pollen",
  petals: "petal",
  leaves: "leaf",
  snow: "snowflake",
  bubbles: "bubble",
  fireflies: "firefly",
};
/** Fireflies blink at this rate (cycles per second). */
const FIREFLY_BLINK = 0.7;
const FIREFLY_GLOW_RADIUS = 6;
/** Sprite-frame speed of animated motes (spinning petals, flapping leaves). */
const MOTE_FRAME_SECONDS = 0.25;

export function drawAmbient(ctx: CanvasRenderingContext2D, ambient: Ambient, theme: ThemeId): void {
  const name = AMBIENT_SPRITE[ambient.style];
  const fireflies = ambient.style === "fireflies";
  for (const [i, m] of ambient.motes.entries()) {
    const x = m.x + m.swayX;
    const frame = Math.floor(ambient.time / MOTE_FRAME_SECONDS + m.phase * 8);
    if (!fireflies) {
      drawCentered(ctx, uiSprite(name, frame + i), x, m.y);
      continue;
    }
    const blink = 0.5 + 0.5 * Math.sin((ambient.time * FIREFLY_BLINK + m.phase) * Math.PI * 2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawSprite(ctx, glowSprite(FIREFLY_GLOW_RADIUS, THEME_COLORS[theme].glow), x, m.y, { alpha: blink });
    ctx.restore();
    drawCentered(ctx, uiSprite(name, frame), x, m.y);
  }
}
