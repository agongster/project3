/**
 * The end door's rules (src/game/scenes/dungeonEndDoor.ts): when it opens,
 * when the hero bumps it or steps through, where the off-screen arrow goes,
 * that its lines fit on screen, and that no floor carving lies where the
 * hero stands to use a demo dungeon's door.
 */
import { describe, expect, it } from "vitest";
import { measureText } from "@/game/art/font";
import { END_DOOR_OPEN_FRAME } from "@/game/art/dungeonProps";
import { VIEW_H, VIEW_W } from "@/game/bridge";
import { layoutCarvings } from "@/game/scenes/floorCodeLayout";
import {
  doorOpenness,
  edgeArrow,
  EDGE_MARGIN_PX,
  endDoorIsNearer,
  isBarred,
  isInDoorway,
  isPushingDoor,
  OPEN_DELAY_SEC,
  OPENED_LINE,
  OPENED_NEAR_ENTRANCE_LINE,
  SHUT_LINE,
  stepDoor,
  SWING_SEC,
  type DoorClock,
} from "@/game/scenes/dungeonEndDoor";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import { generateDungeon, generateOverworld } from "@/lib/worldgen";
import { endDoorLanding } from "@/lib/worldgen/dungeonDoorSpot";
import { createNodeLint } from "../analysis/nodeLint";

const STEP = 1 / 60;

/** Steps the door for `seconds` with the dungeon quiet or not. */
function run(clock: DoorClock, quiet: boolean, seconds: number): DoorClock {
  let c = clock;
  for (let t = 0; t < seconds; t += STEP) c = stepDoor(c, quiet, STEP);
  return c;
}

describe("the door's life", () => {
  const shut: DoorClock = { state: "shut", age: 0 };

  it("stays shut while something is left to fight", () => {
    expect(run(shut, false, 10).state).toBe("shut");
  });

  it("waits a beat once the dungeon is quiet, swings open, then stays open", () => {
    expect(run(shut, true, OPEN_DELAY_SEC / 2).state).toBe("waiting");
    expect(run(shut, true, OPEN_DELAY_SEC + SWING_SEC / 2).state).toBe("swinging");
    expect(run(shut, true, OPEN_DELAY_SEC + SWING_SEC + 0.1).state).toBe("open");
    expect(run(shut, true, 30).state).toBe("open");
  });

  it("shuts again at once when new monsters appear", () => {
    expect(stepDoor({ state: "open", age: 3 }, false, STEP)).toEqual({ state: "shut", age: 0 });
    expect(stepDoor({ state: "waiting", age: 0.5 }, false, STEP).state).toBe("shut");
  });

  it("blocks the way only until it starts to swing", () => {
    expect(isBarred("shut")).toBe(true);
    expect(isBarred("waiting")).toBe(true);
    expect(isBarred("swinging")).toBe(false);
    expect(isBarred("open")).toBe(false);
  });

  it("is drawn shut, then through the swing frames in order, then open", () => {
    expect(doorOpenness({ state: "waiting", age: 0.5 })).toBe(0);
    const frames = [0, 0.2, 0.4].map((age) => doorOpenness({ state: "swinging", age: age * SWING_SEC * 2 }));
    expect(frames[0]).toBe(1);
    expect(frames[2]).toBe(END_DOOR_OPEN_FRAME - 1);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(doorOpenness({ state: "open", age: 0 })).toBe(END_DOOR_OPEN_FRAME);
  });
});

describe("the hero at the door", () => {
  const door = { x: 20, y: 6 };
  /** Feet pressed against the door's tile from the west (the hero's feet box is 10 px wide). */
  const pressed = { x: door.x * 16 - 5, y: door.y * 16 + 12 };

  it("bumps the shut door only when walking into it, right in front of it", () => {
    expect(isPushingDoor(door, pressed, true)).toBe(true);
    expect(isPushingDoor(door, pressed, false)).toBe(false);
    expect(isPushingDoor(door, { ...pressed, y: pressed.y + 16 }, true)).toBe(false);
    expect(isPushingDoor(door, { ...pressed, x: pressed.x - 16 }, true)).toBe(false);
  });

  it("is pointed out only when it is the nearer way out", () => {
    const exit = { x: 2, y: 6 };
    expect(endDoorIsNearer({ x: 15 * 16, y: 6 * 16 + 13 }, door, exit)).toBe(true);
    expect(endDoorIsNearer({ x: 5 * 16, y: 6 * 16 + 13 }, door, exit)).toBe(false);
  });

  it("steps through once its feet are in the doorway", () => {
    expect(isInDoorway(door, pressed)).toBe(false);
    expect(isInDoorway(door, { x: door.x * 16 + 2, y: pressed.y })).toBe(true);
  });
});

describe("the off-screen arrow", () => {
  const view = { left: 100, top: 50, w: VIEW_W, h: VIEW_H };

  it("is not needed while the door is on screen", () => {
    expect(edgeArrow({ x: 200, y: 100 }, view)).toBeNull();
  });

  it("points at a door to the right from just inside the right edge", () => {
    const arrow = edgeArrow({ x: 2000, y: view.top + VIEW_H / 2 }, view)!;
    expect(arrow.x).toBeCloseTo(view.left + VIEW_W - EDGE_MARGIN_PX);
    expect(arrow.y).toBeCloseTo(view.top + VIEW_H / 2);
    expect(arrow.angle).toBeCloseTo(0);
  });

  it("stays inside the screen for a door far off in any direction", () => {
    for (const target of [{ x: -900, y: -900 }, { x: 3000, y: 900 }, { x: 300, y: 2000 }, { x: 4000, y: 60 }]) {
      const arrow = edgeArrow(target, view)!;
      expect(arrow.x).toBeGreaterThanOrEqual(view.left + EDGE_MARGIN_PX - 1e-9);
      expect(arrow.x).toBeLessThanOrEqual(view.left + VIEW_W - EDGE_MARGIN_PX + 1e-9);
      expect(arrow.y).toBeGreaterThanOrEqual(view.top + EDGE_MARGIN_PX - 1e-9);
      expect(arrow.y).toBeLessThanOrEqual(view.top + VIEW_H - EDGE_MARGIN_PX + 1e-9);
    }
  });
});

it("says its lines in one caption, without clipping (the caption keeps 16 px from each side)", () => {
  for (const line of [SHUT_LINE, OPENED_LINE, OPENED_NEAR_ENTRANCE_LINE]) expect(measureText(line)).toBeLessThanOrEqual(VIEW_W - 32);
});

/**
 * The generator keeps the door's landing out of reach of the carved lines
 * where it can (dungeonDoorSpot.ts), and the nearest E spot wins, so a line
 * never takes the door's E. In the demo kingdom, the showcase, the tile the
 * hero uses the door from carries no carving at all, and the layout itself
 * keeps every carving off both landing tiles (floorCodeLayout.ts).
 */
it("finds no floor carving where the hero stands to use a demo dungeon's door", () => {
  const demo = analyzeDemoSources(createNodeLint());
  const seed = generateOverworld(demo).seed;
  for (const file of demo.files.filter((f) => f.findings.length > 0)) {
    const d = generateDungeon(file, seed);
    const carvings = layoutCarvings(d, file.findings);
    for (const tile of endDoorLanding(d.endDoor)) {
      const onTile = carvings.filter((c) => c.x < (tile.x + 1) * 16 && tile.x * 16 < c.x + c.w && c.y < (tile.y + 1) * 16 && tile.y * 16 < c.y + c.h);
      expect(onTile).toEqual([]);
    }
  }
});
