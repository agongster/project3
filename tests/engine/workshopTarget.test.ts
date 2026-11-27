/** Where the Workshop opens for the hero's situation (src/game/scenes/workshopTarget.ts) and the dungeon re-form rules. */
import { describe, expect, it } from "vitest";
import { BUILDING_REACH_PX, workshopTargetFor } from "@/game/scenes/workshopTarget";
import { followEdit, nextWaveCaption, rebuiltCaption, reformCaption, reformOutcome, settledCaption } from "@/game/scenes/dungeonReform";
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

  it("purifies on the spot only when the new code has no bug left", () => {
    expect(reformOutcome(makeFile("a.py"), [])).toBe("purify");
    expect(reformOutcome(makeFile("a.py", { findings: [a] }), [a])).toBe("settle");
  });

  it("stays as it is while the room has a bug, and rebuilds only once the room is done", () => {
    // Monsters still fighting: the room is not rebuilt under the hero's feet.
    expect(reformOutcome(makeFile("a.py", { findings: [a, b] }), [a, b])).toBe("settle");
    // A bug new to the room (b) waits while a is still here...
    expect(reformOutcome(makeFile("a.py", { findings: [a, b] }), [a])).toBe("settle");
    // ...and comes out once the room has nothing left.
    expect(reformOutcome(makeFile("a.py", { findings: [b] }), [])).toBe("rebuild");
  });

  it("follows the findings through an edit: moved ones get their new id, gone ones are fixed or ignored", () => {
    const movedB = makeFinding("a.py", 8, "phantom");
    const after = makeFile("a.py", { findings: [movedB] });
    const { renamed, fixed, sealed, waiting } = followEdit([a, b], after, new Set(), new Set());
    expect([...renamed]).toEqual([[b.id, movedB]]);
    expect([...fixed]).toEqual([a.id]);
    expect([...sealed]).toEqual([]);
    expect(waiting).toEqual([]);
    const ignoredA = followEdit([a, b], after, new Set(), new Set([a.id]));
    expect([...ignoredA.sealed]).toEqual([a.id]);
    expect([...ignoredA.fixed]).toEqual([]);
  });

  it("makes a bug that is new to the room wait", () => {
    const newcomer = makeFinding("a.py", 20, "gremlin");
    const after = makeFile("a.py", { findings: [b, newcomer] });
    const { renamed, fixed, waiting } = followEdit([a, b], after, new Set([a.id]), new Set());
    expect([...renamed.keys()]).toEqual([b.id]);
    expect([...fixed]).toEqual([a.id]);
    expect(waiting).toEqual([newcomer]);
  });

  it("says why, with the file name only, and tells ignoring from fixing", () => {
    expect(reformCaption("bakery/orders.py", 1)).toBe("1 bug fixed in orders.py: the code is rewritten!");
    expect(reformCaption("bakery/orders.py", 2, 1)).toBe("2 bugs fixed in orders.py: the code is rewritten!");
    expect(reformCaption("bakery/orders.py", 0, 1)).toBe("1 bug ignored in orders.py.");
    expect(reformCaption("main.py", 0)).toBe("");
    expect(nextWaveCaption("bakery/orders.py")).toContain("orders.py");
    expect(rebuiltCaption(1, 3)).toBe("1 more monster to fight here.");
    expect(rebuiltCaption(0, 2)).toBe("2 more lines to fix here.");
    expect(settledCaption(0, 1)).toBe("1 glowing line left to fix here.");
    expect(settledCaption(2, 3)).toBe("2 monsters still to fight here.");
    expect(settledCaption(1, 3, 2)).toBe("1 monster still to fight here. 2 more bugs will come out later.");
  });
});
