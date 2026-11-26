import { describe, expect, it } from "vitest";
import { measureText } from "@/game/art/font";
import { FOLDER_HEADER_PX, fitLabel, layoutRepoTreemap, MIN_FILE_LINES, ROOT_FOLDER_NAME, squarify, type Box } from "@/game/ui/treemap";

const AREA: Box = { x: 10, y: 20, w: 360, h: 180 };
const area = (b: Box) => b.w * b.h;
const inside = (b: Box, outer: Box) => b.x >= outer.x - 1e-6 && b.y >= outer.y - 1e-6 && b.x + b.w <= outer.x + outer.w + 1e-6 && b.y + b.h <= outer.y + outer.h + 1e-6;
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

describe("squarify", () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((weight, i) => ({ id: `f${i}`, weight }));
  const boxes = squarify(items, AREA);

  it("gives every item an area proportional to its weight, filling the space exactly", () => {
    const total = items.reduce((s, i) => s + i.weight, 0);
    for (const item of items) {
      const box = boxes.find((b) => b.id === item.id)!;
      expect(area(box)).toBeCloseTo((area(AREA) * item.weight) / total, 6);
    }
    expect(boxes.reduce((s, b) => s + area(b), 0)).toBeCloseTo(area(AREA), 6);
  });

  it("keeps every box inside the area without overlaps", () => {
    for (const b of boxes) expect(inside(b, AREA)).toBe(true);
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBeCloseTo(0, 6)));
  });

  it("makes boxes square-ish rather than slivers", () => {
    for (const b of boxes) expect(Math.max(b.w / b.h, b.h / b.w)).toBeLessThan(4);
  });

  it("handles one item, no items, zero weights, and is deterministic", () => {
    expect(squarify([{ id: "a", weight: 5 }], AREA)).toEqual([{ id: "a", ...AREA }]);
    expect(squarify([], AREA)).toEqual([]);
    expect(squarify([{ id: "a", weight: 0 }], AREA)).toEqual([{ id: "a", x: AREA.x, y: AREA.y, w: 0, h: 0 }]);
    const tied = [{ id: "b", weight: 1 }, { id: "a", weight: 1 }];
    expect(squarify(tied, AREA)).toEqual(squarify([...tied].reverse(), AREA));
  });
});

describe("layoutRepoTreemap", () => {
  const demo = [
    { path: "main.py", lineCount: 17 },
    { path: "config.py", lineCount: 10 },
    { path: "bakery/__init__.py", lineCount: 0 },
    { path: "bakery/oven.py", lineCount: 41 },
    { path: "bakery/pricing.py", lineCount: 31 },
    { path: "potions/brewing.py", lineCount: 15 },
  ];

  it("makes one box per top-level folder (files at the top share one) holding exactly its files", () => {
    const folders = layoutRepoTreemap(demo, AREA);
    expect(folders.map((f) => f.name).sort()).toEqual([ROOT_FOLDER_NAME, "bakery", "potions"].sort());
    const bakery = folders.find((f) => f.name === "bakery")!;
    expect(bakery.files.map((f) => f.id).sort()).toEqual(["bakery/__init__.py", "bakery/oven.py", "bakery/pricing.py"]);
    for (const folder of folders) for (const file of folder.files) expect(inside(file, folder)).toBe(true);
  });

  it("sizes folders by their lines, with a floor so empty files stay visible", () => {
    const folders = layoutRepoTreemap(demo, AREA);
    const bakery = folders.find((f) => f.name === "bakery")!;
    const potions = folders.find((f) => f.name === "potions")!;
    expect(area(bakery) / area(potions)).toBeCloseTo((MIN_FILE_LINES + 41 + 31) / 15, 6);
    const empty = bakery.files.find((f) => f.id === "bakery/__init__.py")!;
    expect(area(empty)).toBeGreaterThan(0);
  });

  it("gives big folders a name strip above their files and skips it for tiny ones", () => {
    const big = Array.from({ length: 40 }, (_, i) => ({ path: `big/f${i}.py`, lineCount: 500 }));
    const folders = layoutRepoTreemap([...demo, ...big, { path: "tiny/x.py", lineCount: 1 }], AREA);
    const bigFolder = folders.find((f) => f.name === "big")!;
    expect(bigFolder.header).toBe(true);
    for (const file of bigFolder.files) expect(file.y).toBeGreaterThanOrEqual(bigFolder.y + FOLDER_HEADER_PX);
    expect(folders.find((f) => f.name === "tiny")!.header).toBe(false);
  });

  it("keeps a 150-file repo readable: every file visible, nothing overlapping", () => {
    const files = Array.from({ length: 150 }, (_, i) => ({ path: `${["src", "tests", "docs", "tools", "lib"][i % 5]}/sub/file${i}.py`, lineCount: (i * 37) % 600 }));
    const folders = layoutRepoTreemap(files, AREA);
    const boxes = folders.flatMap((f) => f.files);
    expect(boxes).toHaveLength(150);
    for (const b of boxes) expect(area(b)).toBeGreaterThan(4);
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBeLessThan(1e-6)));
  });
});

describe("fitLabel", () => {
  it("keeps short names, shortens long ones with an ellipsis, and gives up when nothing fits", () => {
    expect(fitLabel("oven.py", 100)).toBe("oven.py");
    const cut = fitLabel("a_very_long_module_name.py", 40);
    expect(cut.endsWith("…")).toBe(true);
    expect(measureText(cut)).toBeLessThanOrEqual(40);
    expect(fitLabel("oven.py", 2)).toBe("");
    expect(fitLabel("two\nlines", 200)).toBe("two lines");
  });
});
