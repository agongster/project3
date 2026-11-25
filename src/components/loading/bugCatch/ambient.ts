/**
 * Ambient motes: the theme's drifting particles (pollen, petals, leaves,
 * snow, bubbles or fireflies — see `ThemeDef.ambient` in catalog.ts).
 *
 * Each style is described by plain numbers (how fast it drifts and sways),
 * so adding a style means adding one entry to AMBIENT_MOTION. Motes wrap
 * around the screen edges, so there is always the same number of them.
 */
import type { ThemeDef } from "@/lib/game/catalog";
import { mulberry32, randRange, type Rng } from "@/lib/rng";
import { GAME_H, GAME_W } from "./tuning";

export type AmbientStyle = ThemeDef["ambient"];

interface AmbientMotion {
  /** Constant drift (px/s); negative vy floats upwards. */
  vx: { min: number; max: number };
  vy: { min: number; max: number };
  /** Sideways sway amplitude (px) and speed (cycles/s). */
  sway: number;
  swayFreq: number;
  /** How many motes are on screen. */
  count: number;
}

const AMBIENT_MOTION: Record<AmbientStyle, AmbientMotion> = {
  pollen: { vx: { min: 2, max: 6 }, vy: { min: -6, max: -2 }, sway: 6, swayFreq: 0.3, count: 14 },
  petals: { vx: { min: 8, max: 16 }, vy: { min: 9, max: 15 }, sway: 8, swayFreq: 0.35, count: 14 },
  leaves: { vx: { min: 4, max: 10 }, vy: { min: 11, max: 17 }, sway: 12, swayFreq: 0.3, count: 10 },
  snow: { vx: { min: -3, max: 3 }, vy: { min: 8, max: 14 }, sway: 5, swayFreq: 0.25, count: 24 },
  bubbles: { vx: { min: -2, max: 2 }, vy: { min: -16, max: -9 }, sway: 4, swayFreq: 0.6, count: 10 },
  fireflies: { vx: { min: -5, max: 5 }, vy: { min: -4, max: 4 }, sway: 10, swayFreq: 0.2, count: 12 },
};

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Starting phase (0–1) of its sway, blink and sprite-frame animation. */
  phase: number;
  /** The sway offset is added at draw time so `x` stays the drift position. */
  swayX: number;
}

export interface Ambient {
  style: AmbientStyle;
  rng: Rng;
  motes: Mote[];
  time: number;
}

/** Spare space around the screen where motes wrap, so they never pop in at the edge. */
const WRAP_MARGIN = 8;

export function createAmbient(style: AmbientStyle, seed: number): Ambient {
  const rng = mulberry32(seed);
  const motion = AMBIENT_MOTION[style];
  const motes: Mote[] = [];
  for (let i = 0; i < motion.count; i++) {
    motes.push({
      x: randRange(rng, 0, GAME_W),
      y: randRange(rng, 0, GAME_H),
      vx: randRange(rng, motion.vx.min, motion.vx.max),
      vy: randRange(rng, motion.vy.min, motion.vy.max),
      phase: rng(),
      swayX: 0,
    });
  }
  return { style, rng, motes, time: 0 };
}

/** Wraps a coordinate around [-WRAP_MARGIN, size + WRAP_MARGIN]. */
function wrap(v: number, size: number): number {
  const span = size + WRAP_MARGIN * 2;
  return ((((v + WRAP_MARGIN) % span) + span) % span) - WRAP_MARGIN;
}

export function updateAmbient(amb: Ambient, dt: number): void {
  amb.time += dt;
  const motion = AMBIENT_MOTION[amb.style];
  for (const m of amb.motes) {
    m.x = wrap(m.x + m.vx * dt, GAME_W);
    m.y = wrap(m.y + m.vy * dt, GAME_H);
    m.swayX = motion.sway * Math.sin((amb.time * motion.swayFreq + m.phase) * Math.PI * 2);
  }
}
