import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/rng";
import type { Point } from "@/lib/types";
import { MAX_WALL_SHARE, MAZE_LEVEL_BRANCHES, mazeLevel, planInteriorWalls, roomIsOpen } from "@/lib/worldgen/roomMaze";

const nothingKept = () => false;
const asSet = (w: number, walls: readonly Point[]) => new Set(walls.map((p) => p.y * w + p.x));

describe("mazeLevel", () => {
  it("turns branch counts into levels 0–4", () => {
    expect([0, 1, 2, 4, 5, 8, 9, 14, 15, 50].map(mazeLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(mazeLevel(1000)).toBe(MAZE_LEVEL_BRANCHES.length);
  });
});

describe("roomIsOpen", () => {
  it("accepts an open room and a room with a free-standing pillar", () => {
    expect(roomIsOpen(8, 7, new Set())).toBe(true);
    expect(roomIsOpen(8, 7, asSet(8, [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 4 }, { x: 4, y: 4 }]))).toBe(true);
  });

  it("rejects a 1-tile-wide passage", () => {
    // A wall across the room with a 1-tile gap at the bottom.
    const wall = [0, 1, 2, 3, 4, 5].map((y) => ({ x: 4, y }));
    expect(roomIsOpen(9, 7, asSet(9, wall))).toBe(false);
    expect(roomIsOpen(9, 7, asSet(9, wall.slice(0, 5)))).toBe(true); // 2-tile gap
  });

  it("rejects a room cut in two", () => {
    const wall = [0, 1, 2, 3, 4, 5, 6].map((y) => ({ x: 4, y }));
    expect(roomIsOpen(9, 7, asSet(9, wall))).toBe(false);
  });
});

describe("planInteriorWalls", () => {
  it("leaves straight-line code open", () => {
    expect(planInteriorWalls(16, 9, 0, nothingKept, mulberry32(1))).toEqual([]);
  });

  it("adds more walls for branchier code, and the room always stays open", () => {
    const totals = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 40; seed++) {
      const w = 13 + (seed % 8);
      const h = 7 + (seed % 5);
      for (let level = 0; level <= 4; level++) {
        const walls = planInteriorWalls(w, h, level, nothingKept, mulberry32(seed * 10 + level));
        expect(roomIsOpen(w, h, asSet(w, walls))).toBe(true);
        expect(walls.length).toBeLessThanOrEqual(MAX_WALL_SHARE * w * h);
        if (level > 0) expect(walls.length).toBeGreaterThan(0);
        totals[level] += walls.length;
      }
    }
    // On average every level is more tangled than the one before.
    expect(totals[0]).toBe(0);
    for (let level = 1; level <= 4; level++) expect(totals[level]).toBeGreaterThan(totals[level - 1]);
  });

  it("never builds on tiles the caller keeps clear, and keeps the room's edge columns free", () => {
    const keep = (x: number, y: number) => y === 3 || (x >= 6 && x <= 8);
    for (let seed = 1; seed <= 20; seed++) {
      const walls = planInteriorWalls(18, 9, 4, keep, mulberry32(seed));
      expect(walls.some((p) => keep(p.x, p.y))).toBe(false);
      expect(walls.some((p) => p.x < 2 || p.x > 15)).toBe(false); // corridor mouths stay open
    }
  });

  it("is deterministic and copes with rooms too small for any piece", () => {
    expect(planInteriorWalls(18, 9, 4, nothingKept, mulberry32(7))).toEqual(planInteriorWalls(18, 9, 4, nothingKept, mulberry32(7)));
    expect(planInteriorWalls(5, 5, 4, nothingKept, mulberry32(7))).toEqual([]);
  });
});
