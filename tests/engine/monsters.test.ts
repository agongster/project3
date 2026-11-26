import { describe, expect, it } from "vitest";
import { coinsForDefeat, heartDropChance, HEART_DROP_CHANCE, LOW_HP_HEART_DROP_CHANCE, LOW_HP_THRESHOLD, LUCKY_BONUS_COINS, spawnsToCreate } from "@/game/entities/monsters/rewards";
import { jitter, StateClock } from "@/game/entities/monsters/stateClock";
import { clearDistance, figureEight, findSpotAround, hasLineOfSight, pickEscapeAngle, type FreeFn } from "@/game/entities/monsters/steering";
import { tagText } from "@/game/entities/monsters/nameTags";
import { mulberry32 } from "@/lib/rng";
import type { MonsterSpawn } from "@/lib/types";

/** Builds an "is this pixel free?" function from a picture of 16 px tiles: "#" = wall. Outside = wall. */
function room(rows: string[]): FreeFn {
  return (px, py) => {
    const tx = Math.floor(px / 16);
    const ty = Math.floor(py / 16);
    return ty >= 0 && tx >= 0 && ty < rows.length && tx < rows[0].length && rows[ty][tx] !== "#";
  };
}

const OPEN_ROOM = room(["##########", "#........#", "#........#", "#........#", "#........#", "#........#", "##########"]);

describe("StateClock", () => {
  it("tracks the state, elapsed time, progress and when it is done", () => {
    const clock = new StateClock<"idle" | "windup">("idle");
    expect(clock.is("idle")).toBe(true);
    expect(clock.done).toBe(false); // endless state
    expect(clock.progress).toBe(0);
    clock.go("windup", 0.5);
    clock.tick(0.2);
    expect(clock.is("idle", "windup")).toBe(true);
    expect(clock.progress).toBeCloseTo(0.4);
    expect(clock.left).toBeCloseTo(0.3);
    expect(clock.done).toBe(false);
    clock.tick(0.3);
    expect(clock.done).toBe(true);
    expect(clock.progress).toBe(1);
  });

  it("restarts the clock on every state change", () => {
    const clock = new StateClock<"a" | "b">("a", 1);
    clock.tick(0.7);
    clock.go("b", 1);
    expect(clock.elapsed).toBe(0);
  });

  it("jitter stays inside its range", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 200; i++) {
      const v = jitter(0.7, 1.3, rng);
      expect(v).toBeGreaterThanOrEqual(0.7);
      expect(v).toBeLessThanOrEqual(1.3);
    }
  });
});

describe("steering", () => {
  it("measures open floor ahead and stops at walls", () => {
    // From the middle of tile (2, 3), heading right: walls start at x = 144.
    expect(clearDistance(40, 56, 0, OPEN_ROOM, 64)).toBe(64);
    expect(clearDistance(120, 56, 0, OPEN_ROOM, 64)).toBeLessThan(24);
  });

  it("flees straight away from the threat in open space", () => {
    const angle = pickEscapeAngle(80, 56, 60, 56, OPEN_ROOM); // threat on the left
    expect(Math.cos(angle)).toBeGreaterThan(0.5); // runs right
  });

  it("slips out of a corner instead of pressing into it", () => {
    // Mite in the bottom-right corner, hero coming from the top-left.
    const x = 136;
    const y = 88;
    const angle = pickEscapeAngle(x, y, 110, 66, OPEN_ROOM);
    expect(clearDistance(x, y, angle, OPEN_ROOM, 64)).toBeGreaterThanOrEqual(20);
  });

  it("always finds a way out of every corner of a room", () => {
    const corners = [
      [20, 20],
      [140, 20],
      [20, 92],
      [140, 92],
    ];
    for (const [x, y] of corners) {
      const angle = pickEscapeAngle(x, y, 80, 56, OPEN_ROOM);
      expect(clearDistance(x, y, angle, OPEN_ROOM, 64)).toBeGreaterThanOrEqual(20);
    }
  });

  it("figure-eight stays inside its box and passes through the centre", () => {
    for (let t = 0; t < Math.PI * 2; t += 0.1) {
      const p = figureEight(t, 36, 18);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(18 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(9 + 1e-9);
    }
    expect(figureEight(0, 36, 18)).toEqual({ x: 0, y: 0 });
  });

  it("line of sight is blocked by walls", () => {
    const split = room(["#######", "#..#..#", "#..#..#", "#######"]);
    expect(hasLineOfSight(20, 20, 40, 40, split)).toBe(true);
    expect(hasLineOfSight(20, 20, 90, 20, split)).toBe(false);
  });

  it("finds a teleport spot in range that passes the test, or gives up", () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 20; i++) {
      const spot = findSpotAround(80, 56, 32, 48, OPEN_ROOM, rng);
      expect(spot).not.toBeNull();
      const d = Math.hypot(spot!.x - 80, spot!.y - 56);
      expect(d).toBeGreaterThanOrEqual(32);
      expect(d).toBeLessThanOrEqual(48);
      expect(OPEN_ROOM(spot!.x, spot!.y)).toBe(true);
    }
    expect(findSpotAround(80, 56, 32, 48, () => false, rng)).toBeNull();
  });
});

describe("rewards", () => {
  const spawn = (findingId: string): MonsterSpawn => ({ findingId, kind: "dustBunny", x: 1, y: 1 });

  it("only spawns monsters whose finding is not defeated yet", () => {
    const spawns = [spawn("a"), spawn("b"), spawn("c")];
    expect(spawnsToCreate(spawns, []).map((s) => s.findingId)).toEqual(["a", "b", "c"]);
    expect(spawnsToCreate(spawns, ["b"]).map((s) => s.findingId)).toEqual(["a", "c"]);
    expect(spawnsToCreate(spawns, ["a", "b", "c", "zzz"])).toEqual([]);
  });

  it("drops coins in the catalog range, plus the lucky pet's bonus", () => {
    const rng = mulberry32(5);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const c = coinsForDefeat({ coins: [2, 4] }, null, rng);
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(4);
      seen.add(c);
      const lucky = coinsForDefeat({ coins: [2, 4] }, "lucky", rng);
      expect(lucky).toBeGreaterThanOrEqual(2 + LUCKY_BONUS_COINS[0]);
      expect(lucky).toBeLessThanOrEqual(4 + LUCKY_BONUS_COINS[1]);
    }
    expect([...seen].sort()).toEqual([2, 3, 4]); // both ends of the range happen
    expect(coinsForDefeat({ coins: [3, 3] }, "fighter", rng)).toBe(3); // other perks add nothing
  });

  it("drops hearts much more often when the hero is low on health", () => {
    expect(heartDropChance(10)).toBe(HEART_DROP_CHANCE);
    expect(heartDropChance(LOW_HP_THRESHOLD + 1)).toBe(HEART_DROP_CHANCE);
    expect(heartDropChance(LOW_HP_THRESHOLD)).toBe(LOW_HP_HEART_DROP_CHANCE);
    expect(heartDropChance(1)).toBe(LOW_HP_HEART_DROP_CHANCE);
  });
});

describe("name tags", () => {
  it("shows the finding title and line", () => {
    expect(tagText({ title: "Unused import", line: 12 })).toBe("Unused import · L12");
  });
});
