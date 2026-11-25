/**
 * The rules of Bug Catch — a pure simulation with no DOM, canvas or audio.
 *
 *   const sim = createSim(seed);
 *   const events = stepSim(sim, input, STEP_SECONDS);   // 60 times per second
 *
 * `stepSim` advances the game by one fixed step (mutating `sim` in place, like
 * most game loops) and returns what happened during that step as a list of
 * events. The React component turns events into sounds, particles and the
 * `onScore` callback; the drawing code only reads the state. Because all
 * randomness comes from a seeded RNG, the same seed + the same inputs always
 * give exactly the same game (that is what the unit tests check).
 */
import { mulberry32, type Rng } from "@/lib/rng";
import { isBug, isGone, moveFaller, type Faller, type FallerKind } from "./fallers";
import { catchBox, celebrateCatch, createHero, updateHero, type Box, type Hero, type SimInput } from "./hero";
import { BIG_NET_SECONDS, FALLER_RADIUS, FIRST_BONUS_AT, FIRST_WAVE_AT, INTRO_SECONDS, OPENING_WAVE_Y, POINTS } from "./tuning";
import { difficultyAt, nextBonusGap, spawnBonus, spawnWave, type BonusKind } from "./waves";

export { NO_INPUT, type SimInput } from "./hero";

export interface SimState {
  /** Seconds since the game started. */
  time: number;
  rng: Rng;
  hero: Hero;
  /** Everything currently falling or hopping away. */
  fallers: Faller[];
  /** Points (golden bug = 5). Only ever goes up. */
  score: number;
  /** Number of things caught (any kind). */
  caught: number;
  /** Catches in a row without letting a bug land. Never costs points — it only drives the "x6!" and sound pitch. */
  streak: number;
  bestStreak: number;
  /** `time` of the most recent catch (-Infinity before the first); the score counter "pops" after it. */
  lastCatchAt: number;
  /** True once the "READY? CATCH!" intro is over. */
  started: boolean;
  nextWaveAt: number;
  nextBonusAt: number;
  /** Id for the next faller that spawns. */
  nextId: number;
}

/** Things that happened during one step, for sounds, particles and callbacks. */
export type SimEvent =
  /** The intro just finished ("CATCH!" has been on screen and play begins). */
  | { type: "go" }
  /** Something was caught. `streak` is the streak including this catch. */
  | { type: "catch"; kind: FallerKind; golden: boolean; x: number; y: number; points: number; streak: number }
  /** A missed thing touched the ground (a tiny "boing"). `first` is true for its first landing. */
  | { type: "bounce"; kind: FallerKind; x: number; y: number; first: boolean }
  /** A bonus started falling. */
  | { type: "bonus"; bonus: BonusKind };

export function createSim(seed: number): SimState {
  const sim: SimState = {
    time: 0,
    rng: mulberry32(seed),
    hero: createHero(),
    fallers: [],
    score: 0,
    caught: 0,
    streak: 0,
    bestStreak: 0,
    lastCatchAt: -Infinity,
    started: false,
    nextWaveAt: FIRST_WAVE_AT,
    nextBonusAt: FIRST_BONUS_AT,
    nextId: 1,
  };
  spawnWave(sim, difficultyAt(0), { pattern: "row", y: OPENING_WAVE_Y });
  return sim;
}

/** Advances the game by `dt` seconds (always STEP_SECONDS in the real game). */
export function stepSim(sim: SimState, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  sim.time += dt;
  if (!sim.started && sim.time >= INTRO_SECONDS) {
    sim.started = true;
    events.push({ type: "go" });
  }
  updateHero(sim.hero, input, dt);
  spawnThings(sim, events);
  moveFallers(sim, dt, events);
  catchFallers(sim, events);
  sim.fallers = sim.fallers.filter((f) => !isGone(f));
  return events;
}

/** Starts the next wave and/or bonus when their time has come. */
function spawnThings(sim: SimState, events: SimEvent[]): void {
  const difficulty = difficultyAt(sim.time);
  if (sim.time >= sim.nextWaveAt) {
    spawnWave(sim, difficulty);
    sim.nextWaveAt = sim.time + difficulty.waveInterval;
  }
  if (sim.time >= sim.nextBonusAt) {
    events.push({ type: "bonus", bonus: spawnBonus(sim) });
    sim.nextBonusAt = sim.time + nextBonusGap(sim.rng);
  }
}

/** Moves everything; a bug landing uncaught ends the streak (coins and hearts do not). */
function moveFallers(sim: SimState, dt: number, events: SimEvent[]): void {
  for (const f of sim.fallers) {
    const wasFalling = !f.hopping;
    if (!moveFaller(f, dt)) continue;
    events.push({ type: "bounce", kind: f.kind, x: f.x, y: f.y, first: wasFalling });
    if (wasFalling && isBug(f.kind)) sim.streak = 0;
  }
}

/** Removes every faller that touches the catch box and scores it. */
function catchFallers(sim: SimState, events: SimEvent[]): void {
  const box = catchBox(sim.hero);
  const kept: Faller[] = [];
  for (const f of sim.fallers) {
    if (overlapsBox(f, box)) events.push(scoreCatch(sim, f));
    else kept.push(f);
  }
  sim.fallers = kept;
}

/** True when the faller's square (FALLER_RADIUS around its centre) overlaps the box. */
export function overlapsBox(f: Pick<Faller, "x" | "y">, box: Box): boolean {
  return (
    f.x + FALLER_RADIUS > box.left &&
    f.x - FALLER_RADIUS < box.right &&
    f.y + FALLER_RADIUS > box.top &&
    f.y - FALLER_RADIUS < box.bottom
  );
}

/** Points a faller is worth when caught. */
export function pointsFor(f: Pick<Faller, "kind" | "golden">): number {
  if (f.kind === "coin") return POINTS.coin;
  if (f.kind === "heart") return POINTS.heart;
  return f.golden ? POINTS.golden : POINTS.bug;
}

function scoreCatch(sim: SimState, f: Faller): SimEvent {
  const points = pointsFor(f);
  sim.score += points;
  sim.caught += 1;
  sim.streak += 1;
  sim.bestStreak = Math.max(sim.bestStreak, sim.streak);
  sim.lastCatchAt = sim.time;
  celebrateCatch(sim.hero);
  if (f.kind === "heart") sim.hero.bigNetLeft = BIG_NET_SECONDS;
  return { type: "catch", kind: f.kind, golden: f.golden, x: f.x, y: f.y, points, streak: sim.streak };
}
