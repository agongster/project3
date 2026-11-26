/**
 * Where the end door goes (dungeonDoorSpot.ts): the rows it prefers on the
 * last room's east wall, its landing, and the reach of the carved lines it
 * keeps away from.
 */
import { describe, expect, it } from "vitest";
import { carvingReach, chooseEndDoor, endDoorLanding, endDoorRows, LANDING_TILES } from "@/lib/worldgen/dungeonDoorSpot";
import { rectContains } from "@/lib/worldgen/grid";

/** A 12×9 room at (10, 4): rows 4..12, east wall at x = 22. */
const ROOM = { x: 10, y: 4, w: 12, h: 9 };
const CHEST_Y = 8;

describe("endDoorLanding", () => {
  it("is the floor tiles west of the door, nearest first", () => {
    expect(endDoorLanding({ x: 22, y: 6 })).toEqual([
      { x: 21, y: 6 },
      { x: 20, y: 6 },
    ]);
    expect(endDoorLanding({ x: 5, y: 5 })).toHaveLength(LANDING_TILES);
  });
});

describe("endDoorRows", () => {
  it("prefers two rows above the chest, then below, then further out; next to the chest last", () => {
    expect(endDoorRows(ROOM, CHEST_Y)).toEqual([6, 10, 5, 11, 7, 9, 8]);
  });

  it("never uses the room's top or bottom row", () => {
    for (let chestY = ROOM.y + 1; chestY < ROOM.y + ROOM.h - 1; chestY++) {
      const rows = endDoorRows(ROOM, chestY);
      expect(rows.every((y) => y > ROOM.y && y < ROOM.y + ROOM.h - 1)).toBe(true);
      expect(new Set(rows).size).toBe(ROOM.h - 2);
    }
  });

  it("still offers every inner row in the smallest room", () => {
    const small = { x: 3, y: 4, w: 6, h: 7 };
    expect(endDoorRows(small, 7).sort((a, b) => a - b)).toEqual([5, 6, 7, 8, 9]);
  });
});

describe("chooseEndDoor", () => {
  it("cuts the door into the east wall, in the first row with a free landing", () => {
    expect(chooseEndDoor(ROOM, CHEST_Y, () => true)).toEqual({ x: 22, y: 6 });
    const rowSixBlocked = (p: { x: number; y: number }) => !(p.y === 6 && p.x === 20);
    expect(chooseEndDoor(ROOM, CHEST_Y, rowSixBlocked)).toEqual({ x: 22, y: 10 });
  });

  it("gives up when no landing is free", () => {
    expect(chooseEndDoor(ROOM, CHEST_Y, () => false)).toBeNull();
  });
});

describe("carvingReach", () => {
  it("covers 7 tiles either side and 3 rows above and below a monster, a row more above a big one", () => {
    const small = carvingReach({ findingId: "a", kind: "gremlin", x: 20, y: 10 });
    expect(small).toEqual({ x: 13, y: 7, w: 15, h: 7 });
    const big = carvingReach({ findingId: "b", kind: "glitchKing", x: 20, y: 10 });
    expect(rectContains(big, 20, 6)).toBe(true);
    expect(rectContains(big, 20, 14)).toBe(false);
  });
});
