/**
 * Every tunable number of the "Bug Catch" mini-game, in one place.
 *
 * Units: distances are internal canvas pixels (the canvas is GAME_W × GAME_H
 * and scaled up with CSS), times are seconds, speeds are pixels per second.
 * Change a value here and the whole game follows — nothing else hard-codes
 * these numbers.
 */

// ───────────────────────────── Screen ─────────────────────────────

/** Internal resolution of the mini-game canvas (16:9, scaled up by a whole number). */
export const GAME_W = 320;
export const GAME_H = 180;

/** y of the hero's feet. A falling thing that reaches this line was missed and bounces. */
export const GROUND_Y = 160;

/** The simulation always advances in steps of exactly this size (60 updates per second). */
export const STEP_SECONDS = 1 / 60;

// ────────────────────────────── Hero ──────────────────────────────

/** Top running speed. */
export const HERO_MAX_SPEED = 135;
/** How fast the hero speeds up towards the wanted speed (px/s²). */
export const HERO_ACCEL = 950;
/** How fast the hero slows down when there is no input (px/s²); a bit higher than accel so stops feel snappy. */
export const HERO_FRICTION = 1200;
/** The hero's centre never gets closer than this to the left/right edge. */
export const HERO_EDGE_MARGIN = 12;
/** Pointer-follow: wanted speed = distance to the pointer × this gain (per second). */
export const POINTER_GAIN = 7;
/** Pointer-follow: closer than this to the pointer counts as "arrived". */
export const POINTER_DEADZONE = 1.5;
/** Below this speed the hero keeps facing the way it faced before. */
export const FACING_MIN_SPEED = 8;
/** Pixels of running per walk-cycle frame. */
export const STRIDE_PIXELS = 11;

// ───────────────────────────── Catching ─────────────────────────────

/** Half the width of the catch box (net + hero body), centred on the hero. */
export const CATCH_HALF_W = 15;
/** Height of the catch box, measured up from the hero's feet: the top edge is the top of the net's hoop. */
export const CATCH_HEIGHT = 32;
/** "Big net" power-up (from catching a heart): the catch box is this much larger. */
export const BIG_NET_SCALE = 1.6;
/** How long the big net lasts. */
export const BIG_NET_SECONDS = 7;
/** Every falling thing is treated as a square of this half-size for collisions. */
export const FALLER_RADIUS = 6;

/** Points for each kind of catch. The score is what becomes bonus coins. */
export const POINTS = {
  bug: 1,
  golden: 5,
  coin: 1,
  heart: 1,
} as const;

// ───────────────────────────── Intro ─────────────────────────────

/** "READY?" is shown from 0 until this time... */
export const READY_SECONDS = 0.9;
/** ...then "CATCH!" until this time. */
export const INTRO_SECONDS = 1.7;
/**
 * The game opens with a row of bugs already this far down the sky, so even a
 * two-second load has something to catch (and it teaches "run under a row").
 */
export const OPENING_WAVE_Y = 26;
/** The first regular wave follows at this time. */
export const FIRST_WAVE_AT = 1.2;

// ───────────────────────────── Difficulty ─────────────────────────────

/** Difficulty climbs from 0 to 1 over this many seconds, then stays at 1 (a plateau). */
export const RAMP_SECONDS = 60;

/** A value that is `start` at difficulty 0 and `end` at difficulty 1. */
export interface Ramp {
  start: number;
  end: number;
}

/** Seconds between two waves of bugs. */
export const WAVE_INTERVAL: Ramp = { start: 1.5, end: 0.65 };
/** Falling speed of a bug (each bug gets ± FALL_SPEED_JITTER on top). */
export const FALL_SPEED: Ramp = { start: 30, end: 46 };
export const FALL_SPEED_JITTER = 0.15;
/** Chance that a bug zig-zags instead of gently swaying. */
export const ZIGZAG_CHANCE: Ramp = { start: 0, end: 0.45 };
/** Chance that a bug is a golden bug. */
export const GOLDEN_CHANCE = 0.07;

/** Sideways wobble of a gently swaying bug: amplitude (px) and cycles per second. */
export const SWAY_AMP = { min: 4, max: 10 };
export const SWAY_FREQ = { min: 0.3, max: 0.6 };
/** Zig-zag bugs swing wider and a little faster. */
export const ZIGZAG_AMP = { min: 18, max: 30 };
export const ZIGZAG_FREQ = { min: 0.35, max: 0.55 };

/** Bugs spawn this far above the top edge so they glide in instead of popping in. */
export const SPAWN_Y = -12;
/** Bugs never spawn (or sway) closer than this to the left/right edge. */
export const SPAWN_EDGE_MARGIN = 18;
/** Horizontal gap between the bugs of a "pair" / "row" / "stair" wave. */
export const WAVE_SPACING = 26;
/** Vertical gap between the steps of a "stair" wave. */
export const STAIR_STEP_Y = 14;

/** Hard cap on things on screen at once; waves are skipped while it is reached. */
export const MAX_FALLERS = 30;

// ───────────────────────────── Bonuses ─────────────────────────────

/** First bonus (heart or coin shower) arrives at this time... */
export const FIRST_BONUS_AT = 9;
/** ...and later ones this many seconds apart (random in the range). */
export const BONUS_GAP = { min: 13, max: 20 };
/** Chance that a bonus is a heart (big net) rather than a coin shower. */
export const HEART_CHANCE = 0.4;
/** How many coins rain down in a coin shower... */
export const SHOWER_COINS = 12;
/** ...spread over this many pixels above the screen so they arrive one after another. */
export const SHOWER_SPREAD_Y = 110;
/** Coins fall a little faster than bugs; hearts float down slower. */
export const COIN_FALL_SPEED = 52;
export const HEART_FALL_SPEED = 26;

// ───────────────────────────── Missed things ─────────────────────────────

/** Upward speed of the first bounce when something lands. */
export const BOUNCE_SPEED = 100;
/** Each further bounce keeps this fraction of the previous one. */
export const BOUNCE_DAMPING = 0.72;
/** Sideways speed of a missed thing hopping away. */
export const HOP_SPEED_X = 75;
/** Gravity while hopping. */
export const HOP_GRAVITY = 340;
/** A thing is removed once it is this far outside the screen... */
export const DESPAWN_MARGIN = 24;
/** ...or once it has existed this long (a safety net; normally never reached). */
export const MAX_FALLER_AGE = 30;

// ───────────────────────────── Juice ─────────────────────────────

/** How fast the catch squash and the net swish fade (fraction per second). */
export const SQUASH_DECAY = 7;
export const NET_SWISH_DECAY = 4;
/** Squash strength when the hero turns around (a catch is 1). */
export const TURN_SQUASH = 0.45;
