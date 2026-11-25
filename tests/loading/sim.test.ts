import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/rng";
import { makeFaller, type FallerKind } from "@/components/loading/bugCatch/fallers";
import { catchBox, createHero, updateHero } from "@/components/loading/bugCatch/hero";
import {
  createSim,
  NO_INPUT,
  overlapsBox,
  pointsFor,
  stepSim,
  type SimEvent,
  type SimInput,
  type SimState,
} from "@/components/loading/bugCatch/sim";
import {
  BIG_NET_SECONDS,
  FALLER_RADIUS,
  GAME_W,
  GROUND_Y,
  HERO_EDGE_MARGIN,
  INTRO_SECONDS,
  MAX_FALLERS,
  POINTS,
  RAMP_SECONDS,
  SHOWER_COINS,
  SPAWN_EDGE_MARGIN,
  STEP_SECONDS,
} from "@/components/loading/bugCatch/tuning";
import { difficultyAt } from "@/components/loading/bugCatch/waves";

const STEPS_PER_SECOND = Math.round(1 / STEP_SECONDS);

/** Runs `seconds` of game time; `inputFor` may steer based on the current state. */
function run(sim: SimState, seconds: number, inputFor: (s: SimState) => SimInput = () => NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i++) events.push(...stepSim(sim, inputFor(sim), STEP_SECONDS));
  return events;
}

/** A simple "player": points the pointer at the lowest thing still falling. */
function chaser(s: SimState): SimInput {
  const falling = s.fallers.filter((f) => !f.hopping);
  if (falling.length === 0) return NO_INPUT;
  const lowest = falling.reduce((a, b) => (b.y > a.y ? b : a));
  return { dir: 0, pointerX: lowest.x };
}

/** A scripted key pattern that does not depend on the state (for determinism checks). */
function zigzagKeys(s: SimState): SimInput {
  return { dir: Math.floor(s.time / 1.3) % 2 === 0 ? 1 : -1, pointerX: null };
}

/** Puts a non-wobbling faller at (x, y), falling slowly unless a speed is given. */
function place(sim: SimState, x: number, y: number, kind: FallerKind = "dustBunny", golden = false, speed = 1): void {
  sim.fallers.push(makeFaller(mulberry32(1), { id: sim.nextId++, kind, golden, x, y, motion: "straight", speed }));
}

/** A sim with the intro over, no bugs, and nothing scheduled to spawn (for hand-placed tests). */
function quietSim(): SimState {
  const sim = createSim(7);
  sim.fallers = [];
  sim.started = true;
  sim.nextWaveAt = Infinity;
  sim.nextBonusAt = Infinity;
  return sim;
}

/** Everything in the state except the RNG function, for equality checks. */
function snapshot(sim: SimState): string {
  const { rng: _rng, ...rest } = sim;
  void _rng;
  return JSON.stringify(rest);
}

describe("determinism", () => {
  it("gives the exact same game for the same seed and inputs", () => {
    const a = createSim(1234);
    const b = createSim(1234);
    const eventsA = run(a, 90, zigzagKeys);
    const eventsB = run(b, 90, zigzagKeys);
    expect(snapshot(a)).toBe(snapshot(b));
    expect(JSON.stringify(eventsA)).toBe(JSON.stringify(eventsB));
  });

  it("gives a different game for a different seed", () => {
    const a = createSim(1);
    const b = createSim(2);
    run(a, 20);
    run(b, 20);
    expect(snapshot(a)).not.toBe(snapshot(b));
  });
});

describe("scoring", () => {
  it("only ever increases, and matches the sum of catch events", () => {
    const sim = createSim(99);
    let last = 0;
    let fromEvents = 0;
    for (let i = 0; i < 120 * STEPS_PER_SECOND; i++) {
      for (const e of stepSim(sim, chaser(sim), STEP_SECONDS)) if (e.type === "catch") fromEvents += e.points;
      expect(sim.score).toBeGreaterThanOrEqual(last);
      last = sim.score;
    }
    expect(sim.score).toBe(fromEvents);
    expect(sim.caught).toBeGreaterThan(20); // a simple bot catches plenty: the game is easy
  });

  it("is worth 1 per bug, 5 per golden bug, 1 per coin and heart", () => {
    expect(pointsFor({ kind: "todoMite", golden: false })).toBe(POINTS.bug);
    expect(pointsFor({ kind: "echoBat", golden: true })).toBe(5);
    expect(pointsFor({ kind: "coin", golden: false })).toBe(POINTS.coin);
    expect(pointsFor({ kind: "heart", golden: false })).toBe(POINTS.heart);
  });

  it("adds 5 when a golden bug is caught", () => {
    const sim = quietSim();
    place(sim, sim.hero.x, GROUND_Y - 20, "echoBat", true);
    const events = stepSim(sim, NO_INPUT, STEP_SECONDS);
    expect(sim.score).toBe(5);
    expect(events).toContainEqual(expect.objectContaining({ type: "catch", golden: true, points: 5 }));
  });
});

describe("catching", () => {
  it("catches a bug that overlaps the net and removes it", () => {
    const sim = quietSim();
    place(sim, sim.hero.x + 5, GROUND_Y - 30);
    stepSim(sim, NO_INPUT, STEP_SECONDS);
    expect(sim.score).toBe(1);
    expect(sim.fallers).toHaveLength(0);
  });

  it("does not catch a bug that is far away", () => {
    const sim = quietSim();
    place(sim, 20, GROUND_Y - 30);
    place(sim, sim.hero.x, 20); // right above the hero, but still high in the sky
    run(sim, 0.5);
    expect(sim.score).toBe(0);
    expect(sim.fallers).toHaveLength(2);
  });

  it("needs a real overlap: just outside the box is a miss, just inside is a catch", () => {
    const box = catchBox(createHero());
    const y = (box.top + box.bottom) / 2;
    expect(overlapsBox({ x: box.right + FALLER_RADIUS, y }, box)).toBe(false);
    expect(overlapsBox({ x: box.right + FALLER_RADIUS - 0.5, y }, box)).toBe(true);
    expect(overlapsBox({ x: box.left - FALLER_RADIUS, y }, box)).toBe(false);
    expect(overlapsBox({ x: box.left - FALLER_RADIUS + 0.5, y }, box)).toBe(true);
    expect(overlapsBox({ x: box.left + 1, y: box.top - FALLER_RADIUS }, box)).toBe(false);
  });

  it("a heart gives the big net, which catches from further away", () => {
    const sim = quietSim();
    const normal = catchBox(sim.hero);
    place(sim, sim.hero.x, GROUND_Y - 20, "heart");
    stepSim(sim, NO_INPUT, STEP_SECONDS);
    const big = catchBox(sim.hero);
    expect(sim.hero.bigNetLeft).toBeCloseTo(BIG_NET_SECONDS, 1);
    expect(big.right - big.left).toBeGreaterThan(normal.right - normal.left);
    run(sim, BIG_NET_SECONDS + 0.1);
    expect(sim.hero.bigNetLeft).toBe(0);
  });

  it("counts a streak of catches and resets it when a bug lands uncaught", () => {
    const sim = quietSim();
    for (let i = 0; i < 3; i++) {
      place(sim, sim.hero.x, GROUND_Y - 20);
      run(sim, 0.5);
    }
    expect(sim.streak).toBe(3);
    place(sim, 20, GROUND_Y - 1, "coin", false, 60);
    run(sim, 0.2);
    expect(sim.streak).toBe(3); // a missed coin is not a missed bug
    place(sim, 20, GROUND_Y - 1, "todoMite", false, 60);
    run(sim, 0.2);
    expect(sim.streak).toBe(0);
    expect(sim.bestStreak).toBe(3);
    expect(sim.score).toBe(3); // the streak never costs points
  });
});

describe("missed things and limits", () => {
  it("a missed bug bounces (with a bounce event) and is removed once it hops off-screen", () => {
    const sim = quietSim();
    place(sim, 30, GROUND_Y - 2, "dustBunny", false, 40);
    const events = run(sim, 0.2);
    expect(events.some((e) => e.type === "bounce")).toBe(true);
    expect(sim.score).toBe(0);
    run(sim, 5);
    expect(sim.fallers).toHaveLength(0);
  });

  it("never piles up: ten idle minutes stay under the cap", () => {
    const sim = createSim(5);
    const cap = MAX_FALLERS + SHOWER_COINS + 1;
    let most = 0;
    for (let i = 0; i < 600 * STEPS_PER_SECOND; i++) {
      stepSim(sim, NO_INPUT, STEP_SECONDS);
      most = Math.max(most, sim.fallers.length);
    }
    expect(most).toBeGreaterThan(5); // things do spawn...
    expect(most).toBeLessThanOrEqual(cap); // ...but never without bound
  });

  it("keeps falling things inside the play area, and they reach the ground", () => {
    const sim = createSim(11);
    let landed = 0;
    for (let i = 0; i < 120 * STEPS_PER_SECOND; i++) {
      for (const e of stepSim(sim, NO_INPUT, STEP_SECONDS)) if (e.type === "bounce" && e.first) landed++;
      for (const f of sim.fallers.filter((f) => !f.hopping)) {
        expect(f.x).toBeGreaterThanOrEqual(SPAWN_EDGE_MARGIN);
        expect(f.x).toBeLessThanOrEqual(GAME_W - SPAWN_EDGE_MARGIN);
      }
    }
    expect(landed).toBeGreaterThan(50);
  });

  it("keeps the hero inside the screen", () => {
    const hero = createHero();
    for (let i = 0; i < 5 * STEPS_PER_SECOND; i++) updateHero(hero, { dir: 1, pointerX: null }, STEP_SECONDS);
    expect(hero.x).toBe(GAME_W - HERO_EDGE_MARGIN);
    for (let i = 0; i < 5 * STEPS_PER_SECOND; i++) updateHero(hero, { dir: -1, pointerX: null }, STEP_SECONDS);
    expect(hero.x).toBe(HERO_EDGE_MARGIN);
    expect(hero.facing).toBe(-1);
  });

  it("follows the pointer and settles on it", () => {
    const hero = createHero();
    for (let i = 0; i < 3 * STEPS_PER_SECOND; i++) updateHero(hero, { dir: 0, pointerX: 60 }, STEP_SECONDS);
    expect(Math.abs(hero.x - 60)).toBeLessThan(2);
    expect(Math.abs(hero.vx)).toBeLessThan(15);
  });
});

describe("intro and difficulty", () => {
  it("opens with a row of three bugs already in the sky", () => {
    const sim = createSim(8);
    expect(sim.fallers).toHaveLength(3);
    expect(sim.fallers.every((f) => f.y > 0 && f.y < GROUND_Y / 2)).toBe(true);
  });

  it("announces 'go' exactly once, when the intro ends", () => {
    const sim = createSim(3);
    const before = run(sim, INTRO_SECONDS - 0.05);
    expect(before.some((e) => e.type === "go")).toBe(false);
    const after = run(sim, 5);
    expect(after.filter((e) => e.type === "go")).toHaveLength(1);
  });

  it("drops golden bugs and both kinds of bonus over a few minutes", () => {
    const sim = createSim(21);
    const bonuses = new Set<string>();
    let golden = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 300 * STEPS_PER_SECOND; i++) {
      for (const e of stepSim(sim, NO_INPUT, STEP_SECONDS)) if (e.type === "bonus") bonuses.add(e.bonus);
      for (const f of sim.fallers) {
        if (f.golden && !seen.has(f.id)) golden++;
        seen.add(f.id);
      }
    }
    expect(bonuses).toEqual(new Set(["heart", "coinShower"]));
    expect(golden).toBeGreaterThan(3);
  });

  it("starts gentle, ramps up, and plateaus", () => {
    const start = difficultyAt(0);
    const mid = difficultyAt(RAMP_SECONDS / 2);
    const end = difficultyAt(RAMP_SECONDS);
    expect(start.level).toBe(0);
    expect(mid.fallSpeed).toBeGreaterThan(start.fallSpeed);
    expect(mid.waveInterval).toBeLessThan(start.waveInterval);
    expect(end.level).toBe(1);
    expect(difficultyAt(RAMP_SECONDS * 100)).toEqual(end);
    expect(difficultyAt(1e9)).toEqual(end);
  });

  it("speeds up monotonically during the ramp", () => {
    let prev = difficultyAt(0);
    for (let t = 1; t <= RAMP_SECONDS + 10; t++) {
      const d = difficultyAt(t);
      expect(d.fallSpeed).toBeGreaterThanOrEqual(prev.fallSpeed);
      expect(d.waveInterval).toBeLessThanOrEqual(prev.waveInterval);
      prev = d;
    }
  });
});
