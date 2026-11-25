/**
 * Drifting ambient "motes" for the title backdrop: pollen in the meadow,
 * petals in sakura, leaves in autumn, snow, bubbles at the beach and
 * blinking fireflies at night. The kind comes from the theme's `ambient`
 * field in catalog.ts and the colours from the art module's THEME_COLORS.
 *
 * Motes live in screen space (they do not pan with the village) and wrap
 * around the edges, so a fixed number of them is recycled forever.
 */
import { THEME_COLORS } from "@/game/art";
import { getTheme, type ThemeDef } from "@/lib/game/catalog";
import type { ThemeId } from "@/lib/types";

type AmbientKind = ThemeDef["ambient"];

export interface Mote {
  x: number;
  y: number;
  /** Drift speed, px per second. */
  vx: number;
  vy: number;
  /** Random offset so motes don't sway in sync. */
  phase: number;
  color: string;
}

/** One mote for every this many square pixels of view. */
const AREA_PER_MOTE = 2600;

/** Base drift (px/s) for each kind: [vx min, vx max, vy min, vy max]. Negative vy floats up. */
const DRIFT: Record<AmbientKind, [number, number, number, number]> = {
  pollen: [-3, 3, -5, -2],
  petals: [6, 12, 8, 14],
  leaves: [4, 9, 10, 16],
  snow: [-2, 2, 7, 13],
  bubbles: [-1, 1, -11, -6],
  fireflies: [-4, 4, -4, 4],
};

/** How far (px) and how fast (radians/s) each kind sways side to side. */
const SWAY: Record<AmbientKind, { amount: number; speed: number }> = {
  pollen: { amount: 3, speed: 1.2 },
  petals: { amount: 6, speed: 2.2 },
  leaves: { amount: 9, speed: 1.6 },
  snow: { amount: 4, speed: 1.4 },
  bubbles: { amount: 2, speed: 3 },
  fireflies: { amount: 8, speed: 0.9 },
};

function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function createMotes(theme: ThemeId, viewW: number, viewH: number): Mote[] {
  const kind = getTheme(theme).ambient;
  const colors = THEME_COLORS[theme].ambient;
  const [vxMin, vxMax, vyMin, vyMax] = DRIFT[kind];
  const count = Math.round((viewW * viewH) / AREA_PER_MOTE);
  return Array.from({ length: count }, () => ({
    x: Math.random() * viewW,
    y: Math.random() * viewH,
    vx: between(vxMin, vxMax),
    vy: between(vyMin, vyMax),
    phase: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

/** Moves every mote by `dt` seconds, wrapping around the view's edges. */
export function stepMotes(motes: Mote[], dt: number, viewW: number, viewH: number): void {
  for (const mote of motes) {
    mote.x = (mote.x + mote.vx * dt + viewW) % viewW;
    mote.y = (mote.y + mote.vy * dt + viewH) % viewH;
  }
}

/** Draws the motes as tiny pixel shapes (1–2 px, like the in-game particles). */
export function drawMotes(ctx: CanvasRenderingContext2D, motes: readonly Mote[], theme: ThemeId, timeSec: number): void {
  const kind = getTheme(theme).ambient;
  const sway = SWAY[kind];
  ctx.save();
  for (const mote of motes) {
    const x = Math.round(mote.x + Math.sin(timeSec * sway.speed + mote.phase) * sway.amount);
    const y = Math.round(mote.y);
    ctx.fillStyle = mote.color;
    if (kind === "fireflies") {
      // Fireflies blink: fade in and out, with a soft 3×3 halo when bright.
      const glow = (Math.sin(timeSec * 2 + mote.phase * 3) + 1) / 2;
      ctx.globalAlpha = 0.25 * glow;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = 0.3 + 0.7 * glow;
      ctx.fillRect(x, y, 1, 1);
    } else if (kind === "petals") {
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, 2, 1);
    } else if (kind === "leaves") {
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x, y, 2, 2);
    } else if (kind === "bubbles") {
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = mote.color;
      ctx.strokeRect(x + 0.5, y + 0.5, 2, 2);
    } else {
      // Pollen and snow are single pixels; about half the snowflakes are chunkier.
      const size = kind === "snow" && mote.phase > Math.PI ? 2 : 1;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.restore();
}
