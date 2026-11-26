import { describe, expect, it } from "vitest";
import type { MonsterKind } from "@/lib/types";
import { clipText, locationLabel, MAX_FUNCTION_ROOMS, MAX_LABEL_CHARS, MAX_MONSTERS_PER_ROOM, MAX_NAME_CHARS, MAX_ROOMS, planRooms, roomIndexAt } from "@/lib/worldgen/roomPlan";
import { fileWithCode, fn } from "./fakeCode";

const labels = (path: Parameters<typeof planRooms>[0]) => planRooms(path).map((r) => r.info.label);
const lines = (rooms: ReturnType<typeof planRooms>) => rooms.map((r) => r.findings.map((f) => f.line));

describe("planRooms", () => {
  it("gives the module an entry hall and every function with findings a room, in source order", () => {
    const file = fileWithCode(
      "bakery/orders.py",
      [fn("add", 4, 7), fn("unused", 9, 12), fn("read_order", 14, 20, { branches: 3 }), fn("total", 22, 25)],
      [[2, "dustBunny"], [23, "phantom"], [15, "swallowToad"], [5, "mimic"]],
    );
    const rooms = planRooms(file);
    expect(rooms.map((r) => r.info.label)).toEqual(["module", "def add()", "def read_order()", "def total()"]);
    expect(lines(rooms)).toEqual([[2], [5], [15], [23]]);
    expect(rooms[2].info).toMatchObject({ kind: "function", names: ["read_order"], line: 14, endLine: 20, branches: 3, arena: false });
    expect(rooms[0].info).toMatchObject({ kind: "module", names: [], line: 1, branches: 0 });
  });

  it("keeps an (empty) entry hall when every finding is inside a function", () => {
    const rooms = planRooms(fileWithCode("a.py", [fn("f", 3, 9)], [[4, "gremlin"]]));
    expect(rooms.map((r) => r.info.label)).toEqual(["module", "def f()"]);
    expect(rooms[0].findings).toEqual([]);
  });

  it("puts everything in the hall when the outline is empty (a plain script)", () => {
    const rooms = planRooms(fileWithCode("script.py", [], [[3, "dustBunny"], [9, "echoBat"]]));
    expect(labels(fileWithCode("script.py", [], [[3, "dustBunny"]]))).toEqual(["module"]);
    expect(lines(rooms)).toEqual([[3, 9]]);
  });

  it("names methods and class bodies after their class", () => {
    const file = fileWithCode(
      "cauldron.py",
      [fn("Cauldron", 4, 20, { kind: "class" }), fn("Cauldron.add", 8, 12), fn("Cauldron.stir", 14, 20, { docstring: null })],
      [[5, "echoBat"], [9, "gremlin"], [15, "phantom"]],
    );
    expect(labels(file)).toEqual(["module", "class Cauldron", "def Cauldron.add()", "def Cauldron.stir()"]);
  });

  it("gives bosses an arena of their own right after the room of the same code", () => {
    const file = fileWithCode("brew.py", [fn("brew", 5, 30)], [[6, "gremlin"], [8, "evalSerpent"], [12, "dustBunny"], [1, "keyThief"]]);
    const rooms = planRooms(file);
    expect(rooms.map((r) => [r.info.label, r.info.arena])).toEqual([
      ["module", true], // only a boss at module level: the hall itself is the arena
      ["def brew() · 1/2", false],
      ["def brew() · 2/2", true],
    ]);
    expect(lines(rooms)).toEqual([[1], [6, 12], [8]]);
  });

  it("merges the smallest neighbouring functions when there are too many", () => {
    // Five functions with a finding each: the two big ones keep their own rooms, the three tiny ones share.
    const sizes = [30, 2, 3, 2, 30];
    let line = 1;
    const definitions = sizes.map((size, i) => {
      const d = fn(`f${i}`, line, line + size - 1);
      line += size + 2;
      return d;
    });
    const monsters = definitions.map((d) => [d.line + 1, "dustBunny"] as const);
    const rooms = planRooms(fileWithCode("many.py", definitions, monsters));
    const functionRooms = rooms.filter((r) => r.info.kind === "function");
    expect(functionRooms).toHaveLength(MAX_FUNCTION_ROOMS);
    // Every function is still somewhere, in source order, and the 30-line ones stayed alone.
    expect(functionRooms.flatMap((r) => r.info.names)).toEqual(definitions.map((d) => d.name));
    expect(functionRooms[0].info.names).toEqual(["f0"]);
    expect(functionRooms[MAX_FUNCTION_ROOMS - 1].info.names).toEqual(["f4"]);
    expect(functionRooms.find((r) => r.info.names.length > 1)?.info.label).toMatch(/^def f\d+\(\) \+\d+ more$/);
    expect(rooms.every((r, i) => i === 0 || r.info.line >= rooms[i - 1].info.line)).toBe(true);
  });

  it("splits crowded rooms, but never makes more than MAX_ROOMS rooms", () => {
    const six: [number, MonsterKind][] = Array.from({ length: 6 }, (_, i) => [10 + i * 3, "todoMite"]);
    const rooms = planRooms(fileWithCode("busy.py", [fn("busy", 9, 60)], six));
    expect(rooms.map((r) => r.info.label)).toEqual(["module", "def busy() · 1/2", "def busy() · 2/2"]);
    expect(rooms.slice(1).map((r) => r.findings.length)).toEqual([3, 3]);

    // Twelve in one function: split while the dungeon has room for more rooms.
    const twelve: [number, MonsterKind][] = Array.from({ length: 12 }, (_, i) => [10 + i * 3, "todoMite"]);
    const busier = planRooms(fileWithCode("busier.py", [fn("busy", 9, 60)], twelve));
    expect(busier).toHaveLength(MAX_ROOMS);
    expect(busier.slice(1).map((r) => r.findings.length)).toEqual([3, 3, 3, 3]);

    const crowd: [number, MonsterKind][] = Array.from({ length: 60 }, (_, i) => [i + 1, "todoMite"]);
    const crowded = planRooms(fileWithCode("crowd.py", [], crowd));
    expect(crowded).toHaveLength(MAX_ROOMS);
    expect(crowded.reduce((n, r) => n + r.findings.length, 0)).toBe(60);
    expect(planRooms(fileWithCode("six.py", [], crowd.slice(0, MAX_MONSTERS_PER_ROOM)))).toHaveLength(1);
  });

  it("lights documented rooms only", () => {
    const file = fileWithCode("doc.py", [fn("documented", 3, 8), fn("bare", 10, 15, { docstring: null })], [[4, "gremlin"], [11, "gremlin"]], { moduleDocstring: null });
    expect(planRooms(file).map((r) => r.info.lit)).toEqual([false, true, false]);
  });

  it("writes plaques that quote the docstring or ask for one", () => {
    const file = fileWithCode("doc.py", [fn("documented", 3, 8), fn("bare", 10, 15, { docstring: null })], [[4, "gremlin"], [11, "gremlin"]]);
    expect(planRooms(file).map((r) => r.plaque)).toEqual([
      'doc.py — "A module."',
      'def documented() — "Docs for documented."',
      "def bare() — No docstring. What does this function do?",
    ]);
  });

  it("clips 300-character names in names, labels and plaques", () => {
    const long = `f${"x".repeat(299)}`;
    const rooms = planRooms(fileWithCode("long.py", [fn(long, 3, 8, { docstring: null })], [[4, "gremlin"]]));
    expect(rooms[1].info.names[0]).toHaveLength(MAX_NAME_CHARS);
    expect(rooms[1].info.names[0].endsWith("…")).toBe(true);
    expect(Array.from(rooms[1].info.label).length).toBeLessThanOrEqual(MAX_LABEL_CHARS);
    expect(rooms[1].plaque.length).toBeLessThan(MAX_LABEL_CHARS + 60);
    expect(clipText("short", 10)).toBe("short");
    expect(clipText("😀😀😀😀", 3)).toBe("😀😀…");
  });

  it("is deterministic", () => {
    const file = fileWithCode("d.py", [fn("a", 2, 9), fn("b", 11, 20)], [[3, "gremlin"], [12, "keyThief"], [1, "dustBunny"]]);
    expect(planRooms(file)).toEqual(planRooms(file));
  });
});

describe("reading rooms back", () => {
  const dungeon = {
    path: "bakery/orders.py",
    rooms: [
      { x: 3, y: 4, w: 9, h: 7 },
      { x: 18, y: 4, w: 10, h: 7 },
    ],
    roomInfo: planRooms(fileWithCode("bakery/orders.py", [fn("take_order", 3, 9)], [[4, "gremlin"]])).map((r) => r.info),
  };

  it("finds the room under a tile, or the nearest one from a corridor", () => {
    expect(roomIndexAt(dungeon, 5, 6)).toBe(0);
    expect(roomIndexAt(dungeon, 20, 6)).toBe(1);
    expect(roomIndexAt(dungeon, 14, 6)).toBe(0); // in the corridor, closer to the hall
    expect(roomIndexAt(dungeon, 17, 6)).toBe(1);
    expect(roomIndexAt({ rooms: [] }, 1, 1)).toBe(-1);
  });

  it("writes the HUD location line", () => {
    expect(locationLabel(dungeon, 20, 6)).toBe("orders.py · def take_order()");
    expect(locationLabel(dungeon, 4, 6)).toBe("orders.py · module");
    expect(locationLabel({ ...dungeon, rooms: [], roomInfo: [] }, 4, 6)).toBe("bakery/orders.py");
  });
});
