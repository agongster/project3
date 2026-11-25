/**
 * Difficulty and spawning: WHEN bugs appear, in WHICH friendly formation,
 * and the occasional bonus (a heart or a coin shower).
 *
 * Difficulty is a single number `level` that climbs from 0 to 1 over
 * RAMP_SECONDS and then stays at 1, so the game gets a little busier for
 * about a minute and then plateaus — it never becomes stressful.
 *
 * All randomness comes from the sim's seeded RNG, so a given seed always
 * produces exactly the same sequence of waves.
 */
import { chance, pick, randInt, randRange, weightedIndex, type Rng } from "@/lib/rng";
import { BUG_KINDS, fallSpeedFor, makeFaller, type Faller, type FallerKind, type Motion } from "./fallers";
import {
  BONUS_GAP,
  FALL_SPEED,
  GAME_W,
  GOLDEN_CHANCE,
  HEART_CHANCE,
  MAX_FALLERS,
  RAMP_SECONDS,
  SHOWER_COINS,
  SHOWER_SPREAD_Y,
  SPAWN_EDGE_MARGIN,
  SPAWN_Y,
  STAIR_STEP_Y,
  WAVE_INTERVAL,
  WAVE_SPACING,
  ZIGZAG_CHANCE,
  type Ramp,
} from "./tuning";

/** The numbers that change as the game ramps up. */
export interface Difficulty {
  /** 0 at the start, 1 after RAMP_SECONDS (and forever after). */
  level: number;
  waveInterval: number;
  fallSpeed: number;
  zigzagChance: number;
}

function lerp(ramp: Ramp, t: number): number {
  return ramp.start + (ramp.end - ramp.start) * t;
}

/** Difficulty at a moment of the game (seconds since it started). */
export function difficultyAt(time: number): Difficulty {
  const level = Math.min(1, Math.max(0, time / RAMP_SECONDS));
  return {
    level,
    waveInterval: lerp(WAVE_INTERVAL, level),
    fallSpeed: lerp(FALL_SPEED, level),
    zigzagChance: lerp(ZIGZAG_CHANCE, level),
  };
}

// ───────────────────────────── Waves ─────────────────────────────

/**
 * Wave formations. Bigger formations unlock as the level rises:
 *   single  one bug
 *   pair    two bugs side by side
 *   row     three bugs side by side (run under them for a quick triple!)
 *   stair   four bugs in a diagonal staircase (sweep across to catch them all)
 */
export type WavePattern = "single" | "pair" | "row" | "stair";

interface PatternRule {
  pattern: WavePattern;
  /** Level from which this formation can appear. */
  unlockAt: number;
  weight: number;
}

const PATTERNS: PatternRule[] = [
  { pattern: "single", unlockAt: 0, weight: 5 },
  { pattern: "pair", unlockAt: 0.15, weight: 3 },
  { pattern: "row", unlockAt: 0.35, weight: 2 },
  { pattern: "stair", unlockAt: 0.55, weight: 2 },
];

export function pickPattern(rng: Rng, level: number): WavePattern {
  const open = PATTERNS.filter((p) => level >= p.unlockAt);
  return open[weightedIndex(rng, open.map((p) => p.weight))].pattern;
}

/** Spawn offsets (relative to the wave's left-most bug) for each formation. */
function formationOffsets(pattern: WavePattern): { dx: number; dy: number }[] {
  switch (pattern) {
    case "single":
      return [{ dx: 0, dy: 0 }];
    case "pair":
      return [0, 1].map((i) => ({ dx: i * WAVE_SPACING, dy: 0 }));
    case "row":
      return [0, 1, 2].map((i) => ({ dx: i * WAVE_SPACING, dy: 0 }));
    case "stair":
      return [0, 1, 2, 3].map((i) => ({ dx: i * WAVE_SPACING, dy: -i * STAIR_STEP_Y }));
  }
}

/** Something that wants to add fallers to the sim (the sim owns the id counter). */
export interface Spawner {
  rng: Rng;
  fallers: Faller[];
  nextId: number;
}

function addFaller(sim: Spawner, kind: FallerKind, golden: boolean, x: number, y: number, motion: Motion, speed: number): void {
  sim.fallers.push(makeFaller(sim.rng, { id: sim.nextId, kind, golden, x, y, motion, speed }));
  sim.nextId += 1;
}

/** Optional overrides for `spawnWave` (used for the opening wave). */
export interface WaveOptions {
  pattern?: WavePattern;
  /** Spawn height of the wave's first bug (default: just above the screen). */
  y?: number;
}

/**
 * Spawns one wave of bugs. Every bug in a wave shares the same kind, motion
 * and speed so the formation stays together as it falls. Skipped while the
 * screen already holds MAX_FALLERS things.
 */
export function spawnWave(sim: Spawner, difficulty: Difficulty, opts: WaveOptions = {}): void {
  const offsets = formationOffsets(opts.pattern ?? pickPattern(sim.rng, difficulty.level));
  if (sim.fallers.length + offsets.length > MAX_FALLERS) return;
  const width = offsets[offsets.length - 1].dx;
  const left = randRange(sim.rng, SPAWN_EDGE_MARGIN, GAME_W - SPAWN_EDGE_MARGIN - width);
  const kind = pick(sim.rng, BUG_KINDS);
  const motion: Motion = chance(sim.rng, difficulty.zigzagChance) ? "zigzag" : "sway";
  const top = opts.y ?? SPAWN_Y;
  for (const { dx, dy } of offsets) {
    const golden = chance(sim.rng, GOLDEN_CHANCE);
    addFaller(sim, kind, golden, left + dx, top + dy, motion, difficulty.fallSpeed);
  }
}

// ───────────────────────────── Bonuses ─────────────────────────────

export type BonusKind = "heart" | "coinShower";

/** Seconds until the next bonus after one has just happened. */
export function nextBonusGap(rng: Rng): number {
  return randRange(rng, BONUS_GAP.min, BONUS_GAP.max);
}

/**
 * Drops a bonus: either one slowly floating heart (catch it for a big net)
 * or a coin shower spread across the whole width. Bonuses ignore MAX_FALLERS
 * on purpose — they are rare, short and the best part of the game.
 */
export function spawnBonus(sim: Spawner): BonusKind {
  if (chance(sim.rng, HEART_CHANCE)) {
    const x = randRange(sim.rng, SPAWN_EDGE_MARGIN * 2, GAME_W - SPAWN_EDGE_MARGIN * 2);
    addFaller(sim, "heart", false, x, SPAWN_Y, "sway", fallSpeedFor("heart", 0));
    return "heart";
  }
  for (let i = 0; i < SHOWER_COINS; i++) {
    // Evenly spread columns (with a little jitter) so the shower covers the screen.
    const column = (i + randRange(sim.rng, 0.2, 0.8)) / SHOWER_COINS;
    const x = SPAWN_EDGE_MARGIN + column * (GAME_W - SPAWN_EDGE_MARGIN * 2);
    const y = SPAWN_Y - randInt(sim.rng, 0, SHOWER_SPREAD_Y);
    addFaller(sim, "coin", false, x, y, "straight", fallSpeedFor("coin", 0));
  }
  return "coinShower";
}
