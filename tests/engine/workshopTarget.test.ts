/** Where the Workshop opens for the hero's situation (src/game/scenes/workshopTarget.ts) and the dungeon re-form rules. */
import { describe, expect, it } from "vitest";
import { BUILDING_REACH_PX, workshopTargetFor } from "@/game/scenes/workshopTarget";
import { rebuiltCaption, reformCaption, reformOutcome } from "@/game/scenes/dungeonReform";
import { emptyProgress } from "@/lib/game/progress";
import { makeFile, makeFinding } from "../game/helpers";

describe("workshopTargetFor in a dungeon", () => {
  const hero = { x: 100, y: 100 };

  it("opens the file at the line of the nearest living monster", () => {
    const monsters = [
      { x: 300, y: 100, line: 40 },
      { x: 110, y: 96, line: 12 },
      { x: 90, y: 160, line: 7 },
    ];
    expect(workshopTargetFor({ scene: "dungeon", path: "a/b.py", hero, monsters, roomLine: 3 })).toEqual({ path: "a/b.py", line: 12 });
  });

  it("falls back to the room the hero stands in, then to the file alone", () => {
    expect(workshopTargetFor({ scene: "dungeon", path: "a/b.py", hero, monsters: [], roomLine: 21 })).toEqual({ path: "a/b.py", line: 21 });
    expect(workshopTargetFor({ scene: "dungeon", path: "a/b.py", hero, monsters: [], roomLine: null })).toEqual({ path: "a/b.py" });
  });
});

describe("workshopTargetFor in the overworld", () => {
  const hero = { x: 200, y: 200 };
  const building = (path: string, x: number, firstLivingLine: number | null = null) => ({ door: { x, y: 200 }, path, firstLivingLine });

  it("opens the building in front of the hero, at its first living bug when it is cursed", () => {
    const buildings = [building("far.py", 200 + BUILDING_REACH_PX * 3), building("near.py", 210, 9), building("other.py", 230)];
    expect(workshopTargetFor({ scene: "overworld", hero, buildings })).toEqual({ path: "near.py", line: 9 });
  });

  it("opens a clean building at the top", () => {
    expect(workshopTargetFor({ scene: "overworld", hero, buildings: [building("clean.py", 205)] })).toEqual({ path: "clean.py" });
  });

  it("opens no file when no door is within reach", () => {
    const buildings = [building("far.py", 200 + BUILDING_REACH_PX + 1)];
    expect(workshopTargetFor({ scene: "overworld", hero, buildings })).toEqual({ path: null });
    expect(workshopTargetFor({ scene: "overworld", hero, buildings: [] })).toEqual({ path: null });
  });
});

describe("re-forming a dungeon after an edit", () => {
  const a = makeFinding("a.py", 3);
  const b = makeFinding("a.py", 9, "phantom");

  it("purifies on the spot when no monster of the new code is alive", () => {
    expect(reformOutcome(makeFile("a.py"), emptyProgress())).toBe("purify");
    expect(reformOutcome(makeFile("a.py", { findings: [a] }), { ...emptyProgress(), defeated: [a.id] })).toBe("purify");
  });

  it("rebuilds when a monster is still alive", () => {
    expect(reformOutcome(makeFile("a.py", { findings: [a, b] }), { ...emptyProgress(), defeated: [a.id] })).toBe("rebuild");
  });

  it("says why, with the file name only", () => {
    expect(reformCaption("bakery/orders.py", 1)).toBe("1 bug fixed in orders.py: the code is rewritten!");
    expect(reformCaption("bakery/orders.py", 2)).toBe("2 bugs fixed in orders.py: the code is rewritten!");
    expect(reformCaption("main.py", 0)).toBe("main.py was rewritten: the dungeon re-forms!");
    expect(rebuiltCaption(1)).toContain("1 monster still here");
  });
});
