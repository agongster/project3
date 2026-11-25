import { describe, expect, it } from "vitest";
import {
  angleBetween,
  AUTO_AIM_EXTRA_PX,
  chooseAimTarget,
  meleeShape,
  shapeHits,
  SLAM_REACH,
  SWING_HALF_ARC,
  type Target,
} from "@/game/combat/geometry";

const monster = (x: number, y: number, radius = 6): Target => ({ x, y, radius, kind: "monster", alive: true });
const bush = (x: number, y: number): Target => ({ x, y, radius: 7, kind: "object", alive: true });

const RIGHT = 0;
const DOWN = Math.PI / 2;

describe("angleBetween", () => {
  it("is the short way round", () => {
    expect(angleBetween(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleBetween(-3, 3)).toBeCloseTo(2 * Math.PI - 6);
    expect(angleBetween(0.2, 2 * Math.PI + 0.2)).toBeCloseTo(0);
  });
});

describe("chooseAimTarget (auto-aim)", () => {
  it("picks the nearest monster in any direction", () => {
    const behind = monster(-20, 0);
    const far = monster(40, 0);
    expect(chooseAimTarget(0, 0, RIGHT, [far, behind], 20)).toBe(behind);
  });

  it("ignores targets beyond range + the auto-aim margin", () => {
    const tooFar = monster(20 + AUTO_AIM_EXTRA_PX + 6 + 1, 0);
    expect(chooseAimTarget(0, 0, RIGHT, [tooFar], 20)).toBeNull();
  });

  it("ignores dead targets", () => {
    expect(chooseAimTarget(0, 0, RIGHT, [{ ...monster(10, 0), alive: false }], 20)).toBeNull();
  });

  it("only aims at objects that are in front", () => {
    const behindBush = bush(-15, 0);
    const frontBush = bush(25, 4);
    expect(chooseAimTarget(0, 0, RIGHT, [behindBush], 20)).toBeNull();
    expect(chooseAimTarget(0, 0, RIGHT, [behindBush, frontBush], 20)).toBe(frontBush);
  });

  it("prefers any monster in reach over a closer object", () => {
    const closeBush = bush(10, 0);
    const m = monster(35, 0);
    expect(chooseAimTarget(0, 0, RIGHT, [closeBush, m], 20)).toBe(m);
  });
});

describe("hit shapes", () => {
  it("swing: a 110° arc in front, reaching `range`", () => {
    const shape = meleeShape("swing", 0, 0, RIGHT, 20)!;
    expect(shapeHits(shape, monster(20, 0, 4))).toBe(true);
    expect(shapeHits(shape, monster(26, 0, 4))).toBe(false); // too far
    const edge = SWING_HALF_ARC - 0.05;
    expect(shapeHits(shape, monster(Math.cos(edge) * 18, Math.sin(edge) * 18, 1))).toBe(true);
    expect(shapeHits(shape, monster(-18, 0, 4))).toBe(false); // behind
    expect(shapeHits(shape, monster(0, 18, 2))).toBe(false); // 90° off: outside the 55° half-arc
  });

  it("swing: point-blank targets are always hit", () => {
    const shape = meleeShape("swing", 0, 0, RIGHT, 20)!;
    expect(shapeHits(shape, monster(-3, 0, 6))).toBe(true);
  });

  it("thrust: a long thin strip that ignores things beside it", () => {
    const shape = meleeShape("thrust", 0, 0, DOWN, 34)!;
    expect(shapeHits(shape, monster(0, 30, 3))).toBe(true);
    expect(shapeHits(shape, monster(4, 12, 3))).toBe(true);
    expect(shapeHits(shape, monster(20, 12, 3))).toBe(false);
    expect(shapeHits(shape, monster(0, -15, 3))).toBe(false);
  });

  it("slam: a disc at arm's length", () => {
    const shape = meleeShape("slam", 0, 0, RIGHT, 22)!;
    expect(shape.type).toBe("circle");
    if (shape.type !== "circle") return;
    expect(shape.cx).toBeCloseTo(22 * SLAM_REACH);
    expect(shapeHits(shape, monster(shape.cx, 10, 2))).toBe(true);
    expect(shapeHits(shape, monster(-25, 0, 2))).toBe(false);
  });

  it("nova: a ring around the hero", () => {
    const ring = { type: "ring" as const, cx: 0, cy: 0, inner: 30, outer: 40 };
    expect(shapeHits(ring, monster(35, 0, 2))).toBe(true);
    expect(shapeHits(ring, monster(0, -10, 2))).toBe(false); // inside the ring
    expect(shapeHits(ring, monster(0, 50, 2))).toBe(false); // outside
    expect(meleeShape("nova", 0, 0, RIGHT, 56)).toMatchObject({ type: "ring", inner: 0, outer: 56 });
  });

  it("projectiles and boomerangs have no melee shape", () => {
    expect(meleeShape("projectile", 0, 0, RIGHT, 100)).toBeNull();
    expect(meleeShape("boomerang", 0, 0, RIGHT, 100)).toBeNull();
  });
});
