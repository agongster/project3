/**
 * NOODLES — the Spaghetti Beast waves one noodle for every branch of its
 * function (`definitionAt(outline, line).branches`; for "too many
 * arguments", one per argument). A tidy function is a calm little beast; a
 * tangle of ifs and loops is a frenzy of noodles.
 *
 * The noodles wriggle faster while it winds up and flails, and droop while
 * it is dazed. Pure decoration, drawn behind the body.
 */
import type { Monster } from "../monster";
import type { Trait } from "./trait";

/** Fewest and most noodles drawn (a 40-branch monster would just be a blur). */
export const MIN_NOODLES = 3;
export const MAX_NOODLES = 12;
/** Each noodle is this many 1-px steps long (plus a little per noodle so they differ). */
const NOODLE_STEPS = 11;
/** Every third noodle is NOODLE_LENGTH_STEP px longer than the one before, so they don't look combed. */
const NOODLE_LENGTH_STEP = 2;
/** Neighbouring noodles wiggle this far out of step (radians). */
const NOODLE_PHASE_STEP = 1.7;
/** Seen from above at an angle: vertical reach is squashed to this share. */
const DEPTH_SQUASH = 0.8;
/** Noodles leave the body from this high above its feet. */
const ROOT_LIFT_PX = 11;
/** Roots sit on an ellipse this wide and tall around the body's middle. */
const ROOT_RX = 7;
const ROOT_RY = 5;
/** Sideways wiggle (px) at the tip, how much each step bends, and wiggles per second: calm / winding up or flailing. */
const WIGGLE_PX = 3.5;
const BEND_PER_STEP = 0.75;
const CALM_RATE = 3;
const FRENZY_RATE = 11;
/** Noodles are soft: they sag this much (px) at the tip, and hang straight down when it is dazed. */
const SAG_PX = 3;
const DAZED_SAG_PX = 8;
const NOODLE = "#f6d36b";
const NOODLE_SHADE = "#b07a2a";

export class NoodlesTrait implements Trait {
  readonly count: number;

  constructor(count: number) {
    this.count = Math.max(MIN_NOODLES, Math.min(MAX_NOODLES, Math.round(count)));
  }

  drawBehind(g: CanvasRenderingContext2D, m: Monster, time: number): void {
    const frenzy = m.shiver || (m.brain.committed?.(m) ?? false);
    const rate = frenzy ? FRENZY_RATE : CALM_RATE;
    const cx = m.x;
    const cy = m.y - m.z - ROOT_LIFT_PX * m.scale;
    for (let i = 0; i < this.count; i++) {
      // Spread around the body, starting at the top, so every noodle sticks out somewhere.
      const angle = -Math.PI / 2 + (i / this.count) * Math.PI * 2;
      const steps = NOODLE_STEPS + (i % 3) * NOODLE_LENGTH_STEP;
      drawNoodle(g, cx + Math.cos(angle) * ROOT_RX, cy + Math.sin(angle) * ROOT_RY, angle, steps, time * rate + i * NOODLE_PHASE_STEP, m.dazed);
    }
  }
}

/** One wavy noodle from its root outward along `angle`, wiggling more toward the tip. */
function drawNoodle(g: CanvasRenderingContext2D, x0: number, y0: number, angle: number, steps: number, phase: number, droop: boolean): void {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const wiggle = droop ? 0 : Math.sin(phase + s * BEND_PER_STEP) * WIGGLE_PX * t;
    const sag = t * t * (droop ? DAZED_SAG_PX : SAG_PX);
    const x = Math.round(x0 + dirX * s - dirY * wiggle);
    const y = Math.round(y0 + dirY * s * DEPTH_SQUASH + dirX * wiggle + sag);
    g.fillStyle = NOODLE_SHADE;
    g.fillRect(x, y + 1, 1, 1);
    g.fillStyle = NOODLE;
    g.fillRect(x, y, 1, 1);
  }
}
