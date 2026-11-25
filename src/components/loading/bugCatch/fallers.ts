/**
 * Everything that falls from the sky: bugs, golden bugs, coins and hearts.
 *
 * A faller has two phases:
 *   1. FALLING — it glides straight down while wobbling sideways around a
 *      centre line (`baseX`), either a gentle sine "sway" or a wider "zigzag".
 *   2. HOPPING — if it reaches the ground uncaught it does not "fail" the
 *      player: it bounces and hops away off-screen (and can still be caught
 *      on the way out — a free second chance).
 *
 * Pure data + pure functions: no DOM, no randomness of its own (the caller
 * passes in already-rolled numbers or the seeded RNG).
 */
import { randRange, type Rng } from "@/lib/rng";
import {
  BOUNCE_DAMPING,
  BOUNCE_SPEED,
  COIN_FALL_SPEED,
  DESPAWN_MARGIN,
  FALL_SPEED_JITTER,
  GAME_H,
  GAME_W,
  GROUND_Y,
  HEART_FALL_SPEED,
  HOP_GRAVITY,
  HOP_SPEED_X,
  MAX_FALLER_AGE,
  SPAWN_EDGE_MARGIN,
  SWAY_AMP,
  SWAY_FREQ,
  ZIGZAG_AMP,
  ZIGZAG_FREQ,
} from "./tuning";

/** The three friendly minion monsters that play the falling bugs. */
export const BUG_KINDS = ["dustBunny", "todoMite", "echoBat"] as const;
export type BugKind = (typeof BUG_KINDS)[number];
export type FallerKind = BugKind | "coin" | "heart";

/** How a faller wobbles sideways while it falls. */
export type Motion = "sway" | "zigzag" | "straight";

export interface Faller {
  /** Unique per sim, handy for keys and for the drawing code's per-bug animation offset. */
  id: number;
  kind: FallerKind;
  /** Golden bugs sparkle and are worth more. Always false for coins and hearts. */
  golden: boolean;
  /** Centre of the faller. */
  x: number;
  y: number;
  /** The line the sideways wobble swings around (falling phase only). */
  baseX: number;
  /** Speed in px/s; vy > 0 is downwards. vx is only used while hopping. */
  vx: number;
  vy: number;
  motion: Motion;
  /** Wobble amplitude (px), frequency (cycles/s) and starting phase (0–1). */
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  /** True once it has hit the ground and is hopping away. */
  hopping: boolean;
  /** How many times it has bounced (makes each bounce lower than the last). */
  bounces: number;
  /** Seconds since it spawned. */
  age: number;
}

export interface NewFaller {
  id: number;
  kind: FallerKind;
  golden: boolean;
  x: number;
  y: number;
  motion: Motion;
  /** Falling speed before jitter. */
  speed: number;
}

/** Builds a faller, rolling its wobble shape and a little speed variation from the RNG. */
export function makeFaller(rng: Rng, spec: NewFaller): Faller {
  const amp = spec.motion === "zigzag" ? ZIGZAG_AMP : SWAY_AMP;
  const freq = spec.motion === "zigzag" ? ZIGZAG_FREQ : SWAY_FREQ;
  const x = clampToLane(spec.x);
  return {
    id: spec.id,
    kind: spec.kind,
    golden: spec.golden,
    x,
    y: spec.y,
    baseX: x,
    vx: 0,
    vy: spec.speed * randRange(rng, 1 - FALL_SPEED_JITTER, 1 + FALL_SPEED_JITTER),
    motion: spec.motion,
    wobbleAmp: spec.motion === "straight" ? 0 : randRange(rng, amp.min, amp.max),
    wobbleFreq: randRange(rng, freq.min, freq.max),
    wobblePhase: rng(),
    hopping: false,
    bounces: 0,
    age: 0,
  };
}

/** Coins fall fast and straight; hearts float down slowly; bugs use the difficulty's speed. */
export function fallSpeedFor(kind: FallerKind, bugSpeed: number): number {
  if (kind === "coin") return COIN_FALL_SPEED;
  if (kind === "heart") return HEART_FALL_SPEED;
  return bugSpeed;
}

export function isBug(kind: FallerKind): kind is BugKind {
  return kind !== "coin" && kind !== "heart";
}

/** Keeps an x position inside the area where things are allowed to fall. */
export function clampToLane(x: number): number {
  return Math.min(GAME_W - SPAWN_EDGE_MARGIN, Math.max(SPAWN_EDGE_MARGIN, x));
}

/** A triangle wave in [-1, 1] — the zig-zag shape (straight diagonal runs, sharp turns). */
function triangleWave(t: number): number {
  const p = t - Math.floor(t);
  return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

/** Sideways offset from `baseX` at the faller's current age. */
function wobbleOffset(f: Faller): number {
  const t = f.age * f.wobbleFreq + f.wobblePhase;
  if (f.motion === "zigzag") return f.wobbleAmp * triangleWave(t);
  return f.wobbleAmp * Math.sin(t * Math.PI * 2);
}

/**
 * Moves a faller by `dt` seconds. Returns true on the frame it touches the
 * ground (the first landing and every later bounce), so the game can play a
 * tiny "boing".
 */
export function moveFaller(f: Faller, dt: number): boolean {
  f.age += dt;
  if (!f.hopping) {
    f.y += f.vy * dt;
    f.x = clampToLane(f.baseX + wobbleOffset(f));
    if (f.y < GROUND_Y) return false;
    startHopping(f);
    return true;
  }
  f.vy += HOP_GRAVITY * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.y < GROUND_Y || f.vy < 0) return false;
  f.y = GROUND_Y;
  f.bounces += 1;
  f.vy = -BOUNCE_SPEED * Math.pow(BOUNCE_DAMPING, f.bounces);
  return true;
}

/** First landing: bounce up and hop towards the nearer screen edge. */
function startHopping(f: Faller): void {
  f.hopping = true;
  f.y = GROUND_Y;
  f.bounces = 0;
  f.vy = -BOUNCE_SPEED;
  f.vx = f.x < GAME_W / 2 ? -HOP_SPEED_X : HOP_SPEED_X;
}

/** True once a faller has left the screen for good (or is too old) and can be removed. */
export function isGone(f: Faller): boolean {
  const outside = f.x < -DESPAWN_MARGIN || f.x > GAME_W + DESPAWN_MARGIN || f.y > GAME_H + DESPAWN_MARGIN;
  return outside || f.age > MAX_FALLER_AGE;
}
