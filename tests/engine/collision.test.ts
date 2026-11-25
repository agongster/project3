import { describe, expect, it } from "vitest";
import { boxHitsSolid, findNudge, moveBox, TILE_PX, type Box, type SolidTileFn } from "@/game/engine/collision";
import { mulberry32 } from "@/lib/rng";

/** Builds a solid-tile function from a picture: "#" = solid, "." = free. Outside = solid. */
function grid(rows: string[]): SolidTileFn {
  return (tx, ty) => ty < 0 || tx < 0 || ty >= rows.length || tx >= rows[0].length || rows[ty][tx] === "#";
}

const feet = (x: number, y: number): Box => ({ x, y, w: 10, h: 6 });

describe("moveBox", () => {
  const open = grid(["....", "....", "....", "...."]);

  it("moves freely when nothing is in the way", () => {
    const r = moveBox(feet(20, 20), 3, -2, open);
    expect(r).toMatchObject({ x: 23, y: 18, blockedX: false, blockedY: false });
  });

  it("stops flush against a wall", () => {
    const walls = grid(["....", "..#.", "....", "...."]);
    // box spans x 20..30 in row 1 (y 18..24); the wall tile starts at x = 32
    const r = moveBox(feet(20, 18), 5, 0, walls);
    expect(r.x).toBe(2 * TILE_PX - 10);
    expect(r.blockedX).toBe(true);
    expect(boxHitsSolid(r.x, r.y, 10, 6, walls)).toBe(false);
  });

  it("slides along a wall when pushing diagonally into it", () => {
    const walls = grid(["....", "....", "####", "...."]);
    // standing just above the wall row (y = 32), pushing down-right
    const start = feet(10, 32 - 6);
    const r = moveBox(start, 2, 2, walls);
    expect(r.blockedY).toBe(true);
    expect(r.y).toBe(start.y);
    expect(r.x).toBe(12);
  });

  it("nudges around a corner that blocks by only a few pixels", () => {
    // a solid tile at column 2, row 1 (y 16..32). Walking right with the box's
    // bottom 3 px overlapping row 1 → it should be pushed up, out of the way.
    const walls = grid(["....", "..#.", "....", "...."]);
    const start = feet(22, 16 - 6 + 3); // bottom edge at y = 19 (3 px into row 1)
    const before = start.y;
    let box = { ...start };
    for (let i = 0; i < 10; i++) {
      const r = moveBox(box, 1.5, 0, walls);
      box = { ...box, x: r.x, y: r.y };
    }
    expect(box.y).toBeLessThan(before);
    expect(box.x).toBeGreaterThan(start.x + 4); // it got past the corner
    expect(boxHitsSolid(box.x, box.y, box.w, box.h, walls)).toBe(false);
  });

  it("does not nudge when the wall is genuinely in the way", () => {
    const walls = grid(["..#.", "..#.", "..#.", "...."]);
    const r = moveBox(feet(20, 20), 4, 0, walls);
    expect(r.blockedX).toBe(true);
    expect(r.y).toBe(20);
  });

  it("can't tunnel through a thin wall with a big move", () => {
    const walls = grid(["....", "..#.", "....", "...."]);
    const r = moveBox(feet(5, 18), 60, 0, walls);
    expect(r.x).toBe(2 * TILE_PX - 10);
  });

  it("never ends inside a solid tile across a fuzz of random moves", () => {
    const rng = mulberry32(12345);
    const rows = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => (x === 0 || y === 0 || x === 11 || y === 11 || rng() < 0.22 ? "#" : ".")).join(""),
    );
    rows[5] = rows[5].slice(0, 5) + "." + rows[5].slice(6); // make sure the start tile is free
    const solid = grid(rows);
    let box: Box = { x: 5 * TILE_PX + 3, y: 5 * TILE_PX + 5, w: 10, h: 6 };
    for (let i = 0; i < 5000; i++) {
      const dx = (rng() - 0.5) * 14;
      const dy = (rng() - 0.5) * 14;
      // Some moves are purely horizontal so corner nudging gets exercised too.
      const horizontalOnly = rng() < 0.4;
      const r = moveBox(box, dx, horizontalOnly ? 0 : dy, solid);
      box = { ...box, x: r.x, y: r.y };
      expect(boxHitsSolid(box.x, box.y, box.w, box.h, solid)).toBe(false);
    }
  });
});

describe("findNudge", () => {
  it("prefers the smallest shift", () => {
    const walls = grid(["....", "..#.", "....", "...."]);
    // bottom edge 2 px into the blocked row: a shift of -2 frees it
    expect(findNudge(feet(22, 12), "x", 1, walls, 5)).toBe(-2);
  });

  it("returns 0 when no shift within the limit helps", () => {
    const walls = grid(["..#.", "..#.", "..#.", "...."]);
    expect(findNudge(feet(22, 20), "x", 1, walls, 5)).toBe(0);
  });
});
