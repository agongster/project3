/**
 * The hero: runs left/right along the ground holding a bug net.
 *
 * Movement uses acceleration instead of instant speed changes, which is what
 * makes it feel "weighty but snappy". Two ways to steer:
 *   - keys (←/→ or A/D): run at full speed in that direction;
 *   - pointer: when no key is held, run towards the pointer's x and slow
 *     down smoothly as the hero gets close to it.
 *
 * Also tracks the purely visual "juice" values the drawing code reads:
 * squash (on a catch or a turn) and the net swish.
 */
import {
  BIG_NET_SCALE,
  CATCH_HALF_W,
  CATCH_HEIGHT,
  FACING_MIN_SPEED,
  GAME_W,
  GROUND_Y,
  HERO_ACCEL,
  HERO_EDGE_MARGIN,
  HERO_FRICTION,
  HERO_MAX_SPEED,
  NET_SWISH_DECAY,
  POINTER_DEADZONE,
  POINTER_GAIN,
  SQUASH_DECAY,
  TURN_SQUASH,
} from "./tuning";

/** What the player is asking for this step. */
export interface SimInput {
  /** -1 = left key held, 1 = right key held, 0 = neither (or both). */
  dir: -1 | 0 | 1;
  /** Pointer x in canvas pixels, or null when the pointer is not steering. */
  pointerX: number | null;
}

export const NO_INPUT: SimInput = { dir: 0, pointerX: null };

export interface Hero {
  /** Centre x of the hero; the feet are always on GROUND_Y. */
  x: number;
  vx: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  /** Total pixels run so far — the drawing code turns it into walk-cycle frames. */
  distance: number;
  /** 1 right after a catch (or less after a turn), fading to 0: squash-and-stretch strength. */
  squash: number;
  /** 1 right after a catch, fading to 0: how far through its swoosh the net is. */
  swish: number;
  /** Seconds of "big net" power-up left (0 = normal net). */
  bigNetLeft: number;
}

export function createHero(): Hero {
  return { x: GAME_W / 2, vx: 0, facing: 1, distance: 0, squash: 0, swish: 0, bigNetLeft: 0 };
}

/** The speed the player is asking for, from keys first, then the pointer. */
function wantedSpeed(hero: Hero, input: SimInput): number {
  if (input.dir !== 0) return input.dir * HERO_MAX_SPEED;
  if (input.pointerX === null) return 0;
  const dx = input.pointerX - hero.x;
  if (Math.abs(dx) < POINTER_DEADZONE) return 0;
  return Math.max(-HERO_MAX_SPEED, Math.min(HERO_MAX_SPEED, dx * POINTER_GAIN));
}

/** Moves `value` towards `target` by at most `maxDelta`. */
function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

export function updateHero(hero: Hero, input: SimInput, dt: number): void {
  const target = wantedSpeed(hero, input);
  const rate = target === 0 ? HERO_FRICTION : HERO_ACCEL;
  hero.vx = approach(hero.vx, target, rate * dt);

  const before = hero.x;
  const minX = HERO_EDGE_MARGIN;
  const maxX = GAME_W - HERO_EDGE_MARGIN;
  hero.x = Math.min(maxX, Math.max(minX, hero.x + hero.vx * dt));
  if (hero.x === minX || hero.x === maxX) hero.vx = 0;
  hero.distance += Math.abs(hero.x - before);

  updateFacing(hero, target);
  hero.squash = Math.max(0, hero.squash - SQUASH_DECAY * dt);
  hero.swish = Math.max(0, hero.swish - NET_SWISH_DECAY * dt);
  hero.bigNetLeft = Math.max(0, hero.bigNetLeft - dt);
}

/** Turns the hero to face where it is asked to go, with a little squash on each turn. */
function updateFacing(hero: Hero, target: number): void {
  if (Math.abs(target) < FACING_MIN_SPEED) return;
  const wanted = target > 0 ? 1 : -1;
  if (wanted === hero.facing) return;
  hero.facing = wanted;
  hero.squash = Math.max(hero.squash, TURN_SQUASH);
}

/** Called on every catch: a full squash and a net swoosh. */
export function celebrateCatch(hero: Hero): void {
  hero.squash = 1;
  hero.swish = 1;
}

/** An axis-aligned rectangle (left < right, top < bottom). */
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The area where the net (or the hero's body) catches things. Bigger while the big net is active. */
export function catchBox(hero: Hero): Box {
  const scale = hero.bigNetLeft > 0 ? BIG_NET_SCALE : 1;
  const halfW = CATCH_HALF_W * scale;
  return {
    left: hero.x - halfW,
    right: hero.x + halfW,
    top: GROUND_Y - CATCH_HEIGHT * scale,
    bottom: GROUND_Y,
  };
}
