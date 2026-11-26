import { describe, expect, it } from "vitest";
import { definitionAt } from "@/lib/analysis/outline";
import { Ground, type AnalyzedFile, type Dungeon, type MonsterKind, type Rect } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { generateDungeon, dungeonProblems, reachableFrom, solidPropTiles } from "@/lib/worldgen";
import { endDoorLanding } from "@/lib/worldgen/dungeonDoorSpot";
import { MAX_LABEL_CHARS, MAX_ROOMS } from "@/lib/worldgen/roomPlan";
import { makeFileWithMonsters } from "./helpers";
import { fileWithCode, fn } from "./fakeCode";

const MINIONS: MonsterKind[] = ["dustBunny", "todoMite", "echoBat"];
const ELITES: MonsterKind[] = ["gremlin", "phantom", "mimic", "swallowToad", "spaghetti"];
const BOSSES: MonsterKind[] = ["keyThief", "evalSerpent", "glitchKing"];

/** A deterministic mix of `count` monsters, optionally ending with bosses. */
function monsterMix(count: number, bosses: number, offset = 0): MonsterKind[] {
  const regular = [...MINIONS, ...ELITES];
  const out: MonsterKind[] = [];
  for (let i = 0; i < count - bosses; i++) out.push(regular[(i * 3 + offset) % regular.length]);
  for (let i = 0; i < bosses; i++) out.push(BOSSES[(i + offset) % BOSSES.length]);
  return out;
}

const isFloor = (d: Dungeon, x: number, y: number) => {
  const g = d.ground[y * d.width + x];
  return g === Ground.DungeonFloor || g === Ground.DungeonFloorAlt;
};
const roomOf = (d: Dungeon, x: number, y: number) => d.rooms.findIndex((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
/** Tiles inside a room's rectangle that are not floor: its interior walls. */
const interiorWalls = (d: Dungeon, r: Rect) => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (!isFloor(d, x, y)) n++;
  return n;
};
/** Light props (torches on the top wall, crystals inside) that belong to a room. */
const lightsOf = (d: Dungeon, r: Rect) =>
  d.props.filter((p) => (p.kind === "torch" || p.kind === "crystal") && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y - 1 && p.y < r.y + r.h).length;

/** The checks every generated dungeon must pass, whatever the file. */
function expectPlayable(d: Dungeon, file: AnalyzedFile): void {
  expect(dungeonProblems(d, file)).toEqual([]);
  expect(d.monsters.map((m) => m.findingId).sort()).toEqual(file.findings.map((f) => f.id).sort());
  const reach = reachableFrom(d, d.entrance, solidPropTiles(d.props));
  for (const p of [d.exit, d.endDoor, d.chest, ...d.monsters]) expect(reach[p.y * d.width + p.x]).toBe(1);
}

describe("generateDungeon", () => {
  const file = makeFileWithMonsters("potions/brew.py", monsterMix(9, 1));
  const dungeon = generateDungeon(file, 1234);

  it("is deterministic for the same repo seed and path", () => {
    expect(generateDungeon(file, 1234)).toEqual(dungeon);
    expect(generateDungeon(file, 999).seed).not.toBe(dungeon.seed);
  });

  it("has the right shape: at most MAX_ROOMS rooms plus arenas, left to right, a 2-tile void margin", () => {
    const arenas = dungeon.roomInfo.filter((r) => r.arena).length;
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(1);
    expect(dungeon.rooms.length).toBeLessThanOrEqual(MAX_ROOMS + arenas);
    expect(dungeon.roomInfo).toHaveLength(dungeon.rooms.length);
    for (let i = 1; i < dungeon.rooms.length; i++) expect(dungeon.rooms[i].x).toBeGreaterThan(dungeon.rooms[i - 1].x + dungeon.rooms[i - 1].w);
    for (let x = 0; x < dungeon.width; x++) {
      for (const y of [0, 1, dungeon.height - 2, dungeon.height - 1]) expect(dungeon.ground[y * dungeon.width + x]).toBe(Ground.DungeonVoid);
    }
  });

  it("puts the entrance on the left of the entry hall with the exit doormat right next to it", () => {
    const first = dungeon.rooms[0];
    expect(dungeon.roomInfo[0].kind).toBe("module");
    expect(dungeon.entrance.x).toBe(first.x);
    expect(dungeon.ground[dungeon.exit.y * dungeon.width + dungeon.exit.x]).toBe(Ground.DungeonExit);
    expect(dungeon.solid[dungeon.exit.y * dungeon.width + dungeon.exit.x]).toBe(0);
    expect(Math.abs(dungeon.exit.x - dungeon.entrance.x) + Math.abs(dungeon.exit.y - dungeon.entrance.y)).toBe(1);
    const plaque = dungeon.props.find((p) => p.kind === "plaque" && p.x === first.x + 1 && p.y === first.y - 1)!;
    expect(plaque.text?.startsWith(file.path)).toBe(true);
  });

  it("hangs a plaque at the entrance of every room", () => {
    const plaques = dungeon.props.filter((p) => p.kind === "plaque");
    expect(plaques).toHaveLength(dungeon.rooms.length);
    dungeon.rooms.forEach((r) => expect(plaques.some((p) => p.x === r.x + 1 && p.y === r.y - 1)).toBe(true));
  });

  it("draws a wall face wherever a wall has floor below it", () => {
    for (let y = 0; y + 1 < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        const g = dungeon.ground[y * dungeon.width + x];
        if (g === Ground.DungeonWall) expect(isFloor(dungeon, x, y + 1)).toBe(false);
        if (g === Ground.DungeonWallFace) expect(isFloor(dungeon, x, y + 1)).toBe(true);
      }
    }
  });

  it("places torches on wall faces and the chest in the last room", () => {
    const torches = dungeon.props.filter((p) => p.kind === "torch");
    for (const t of torches) expect(dungeon.ground[t.y * dungeon.width + t.x]).toBe(Ground.DungeonWallFace);
    expect(roomOf(dungeon, dungeon.chest.x, dungeon.chest.y)).toBe(dungeon.rooms.length - 1);
  });
});

describe("dungeon invariants for 1–10 findings, with and without bosses", () => {
  for (let count = 1; count <= 10; count++) {
    for (const bosses of count >= 4 ? [0, 1, 2] : [0, 1]) {
      it(`${count} findings, ${bosses} boss(es)`, () => {
        for (let variant = 0; variant < 3; variant++) {
          const file = makeFileWithMonsters(`pkg/file_${count}_${bosses}_${variant}.py`, monsterMix(count, Math.min(bosses, count), variant), variant);
          const d = generateDungeon(file, 777 + variant);
          expectPlayable(d, file);

          // Monsters: on floor, away from the entrance, spaced, big ones with room to move.
          d.monsters.forEach((m, i) => {
            expect(isFloor(d, m.x, m.y)).toBe(true);
            expect(Math.max(Math.abs(m.x - d.entrance.x), Math.abs(m.y - d.entrance.y))).toBeGreaterThanOrEqual(5);
            for (const other of d.monsters.slice(i + 1)) {
              expect(Math.max(Math.abs(m.x - other.x), Math.abs(m.y - other.y))).toBeGreaterThanOrEqual(2);
            }
            if (MONSTERS[m.kind].size > 16) {
              for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(isFloor(d, m.x + dx, m.y + dy)).toBe(true);
            }
          });

          // Bosses live in open arenas of their own.
          for (const b of d.monsters.filter((m) => MONSTERS[m.kind].severity === "boss")) {
            const room = roomOf(d, b.x, b.y);
            expect(d.roomInfo[room].arena).toBe(true);
            expect(d.rooms[room].w).toBeGreaterThanOrEqual(13);
            expect(d.rooms[room].h).toBeGreaterThanOrEqual(9);
            expect(interiorWalls(d, d.rooms[room])).toBe(0);
            expect(d.monsters.filter((m) => roomOf(d, m.x, m.y) === room).every((m) => MONSTERS[m.kind].severity === "boss")).toBe(true);
          }

          // Within a room, monsters read left to right in line order.
          const byLine = new Map(file.findings.map((f) => [f.id, f.line]));
          d.rooms.forEach((_, room) => {
            const inRoom = d.monsters.filter((m) => roomOf(d, m.x, m.y) === room);
            for (let i = 1; i < inRoom.length; i++) {
              expect(byLine.get(inRoom[i].findingId)!).toBeGreaterThanOrEqual(byLine.get(inRoom[i - 1].findingId)!);
              expect(inRoom[i].x).toBeGreaterThanOrEqual(inRoom[i - 1].x);
            }
          });
        }
      });
    }
  }

  it("copes with a crowded file (30 findings, several bosses)", () => {
    const file = makeFileWithMonsters("crowded.py", monsterMix(30, 5));
    expectPlayable(generateDungeon(file, 1), file);
  });

  it("keeps the map tight: no huge empty void", () => {
    const d = generateDungeon(makeFileWithMonsters("small.py", ["dustBunny"]), 5);
    const last = d.rooms[d.rooms.length - 1];
    expect(d.width).toBe(last.x + last.w + 3);
    expect(d.height).toBeLessThanOrEqual(Math.max(...d.rooms.map((r) => r.h)) + 9);
  });
});

describe("the file shapes the dungeon", () => {
  const roomOfMonster = (d: Dungeon, findingId: string) => {
    const m = d.monsters.find((x) => x.findingId === findingId)!;
    return roomOf(d, m.x, m.y);
  };

  it("puts every monster in the room of the function its line is in", () => {
    const file = fileWithCode(
      "bakery/orders.py",
      [fn("read_order", 4, 24, { branches: 6 }), fn("Shop", 26, 60, { kind: "class" }), fn("Shop.total", 30, 45)],
      [[2, "dustBunny"], [5, "mimic"], [14, "swallowToad"], [20, "gremlin"], [28, "echoBat"], [33, "phantom"], [70, "todoMite"]],
    );
    const d = generateDungeon(file, 42);
    expectPlayable(d, file);
    expect(d.roomInfo.map((r) => r.label)).toEqual(["module", "def read_order()", "class Shop", "def Shop.total()"]);
    for (const f of file.findings) {
      const definition = definitionAt(file.outline, f.line);
      const info = d.roomInfo[roomOfMonster(d, f.id)];
      if (definition) expect(info.names).toContain(definition.name);
      else expect(info.kind).toBe("module");
    }
  });

  it("orders the rooms like the source, from the entrance inward", () => {
    const file = fileWithCode("order.py", [fn("a", 3, 10), fn("b", 12, 20), fn("c", 22, 40)], [[35, "gremlin"], [4, "echoBat"], [15, "phantom"]]);
    const d = generateDungeon(file, 3);
    expect(d.roomInfo.map((r) => r.names.join())).toEqual(["", "a", "b", "c"]);
    for (let i = 1; i < d.rooms.length; i++) expect(d.rooms[i].x).toBeGreaterThan(d.rooms[i - 1].x);
  });

  it("gives branchy functions more interior walls than straight ones, and keeps them walkable", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const file = fileWithCode(`maze${seed}.py`, [fn("straight", 3, 30), fn("tangled", 32, 60, { branches: 20 })], [[5, "gremlin"], [34, "gremlin"]]);
      const d = generateDungeon(file, seed);
      expectPlayable(d, file);
      expect(interiorWalls(d, d.rooms[1])).toBe(0);
      expect(interiorWalls(d, d.rooms[2])).toBeGreaterThan(4);
    }
  });

  it("lights documented rooms better than undocumented ones", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const file = fileWithCode(`lamps${seed}.py`, [fn("documented", 3, 30), fn("bare", 32, 59, { docstring: null })], [[5, "gremlin"], [34, "gremlin"]]);
      const d = generateDungeon(file, seed);
      expect(d.roomInfo.map((r) => r.lit)).toEqual([true, true, false]);
      expect(lightsOf(d, d.rooms[1])).toBeGreaterThan(lightsOf(d, d.rooms[2]));
    }
  });

  it("clips 300-character names", () => {
    const long = `handler_${"x".repeat(292)}`;
    const file = fileWithCode("long.py", [fn(long, 3, 20), fn(`Klass.${long}`, 22, 30)], [[4, "gremlin"], [23, "phantom"]]);
    const d = generateDungeon(file, 1);
    expectPlayable(d, file);
    for (const info of d.roomInfo) expect(Array.from(info.label).length).toBeLessThanOrEqual(MAX_LABEL_CHARS);
  });

  it("handles the edge cases", () => {
    const twelve = (line: number, step: number) => Array.from({ length: 12 }, (_, i) => [line + i * step, ELITES[i % ELITES.length]] as const);
    const cases: AnalyzedFile[] = [
      fileWithCode("one.py", [fn("f", 3, 8)], [[4, "gremlin"]]),
      fileWithCode("crowded_function.py", [fn("f", 3, 80, { branches: 9 })], twelve(5, 6)),
      fileWithCode("twelve_functions.py", Array.from({ length: 12 }, (_, i) => fn(`f${i}`, 3 + i * 8, 9 + i * 8, { branches: i * 2 })), twelve(5, 8)),
      fileWithCode("module_only.py", [fn("unused", 40, 50)], [[2, "dustBunny"], [3, "echoBat"], [30, "keyThief"]]),
      fileWithCode("script.py", [], twelve(2, 3), { moduleDocstring: null }),
      fileWithCode("fifty_branches.py", [fn("monster", 3, 200, { branches: 50 })], [[10, "spaghetti"], [50, "gremlin"], [120, "todoMite"]]),
      fileWithCode("boss_in_maze.py", [fn("run", 3, 90, { branches: 30 })], [[10, "gremlin"], [20, "evalSerpent"], [30, "mimic"]]),
    ];
    for (const file of cases) {
      const d = generateDungeon(file, 9);
      expectPlayable(d, file);
      expect(generateDungeon(file, 9)).toEqual(d);
    }
  });
});

describe("the end door", () => {
  /** The door's tile, its landing, and the room it belongs to. */
  const doorOf = (d: Dungeon) => ({ door: d.endDoor, last: d.rooms[d.rooms.length - 1], landing: endDoorLanding(d.endDoor) });

  it("is a way-out tile on the east wall of the last room, with free floor in front", () => {
    const file = makeFileWithMonsters("potions/brew.py", monsterMix(9, 1));
    const d = generateDungeon(file, 1234);
    const { door, last, landing } = doorOf(d);
    expect(door.x).toBe(last.x + last.w);
    expect(door.y).toBeGreaterThan(last.y);
    expect(door.y).toBeLessThan(last.y + last.h - 1);
    expect(d.ground[door.y * d.width + door.x]).toBe(Ground.DungeonExit);
    expect(d.solid[door.y * d.width + door.x]).toBe(0);
    for (const t of landing) {
      expect(isFloor(d, t.x, t.y)).toBe(true);
      expect(d.props.some((p) => p.x === t.x && p.y === t.y)).toBe(false);
    }
  });

  it("gives a one-room dungeon its door on the wall opposite the entrance", () => {
    const file = fileWithCode("script.py", [], [[2, "gremlin"], [5, "dustBunny"], [9, "mimic"]], { moduleDocstring: null });
    const d = generateDungeon(file, 9);
    expectPlayable(d, file);
    expect(d.rooms).toHaveLength(1);
    expect(d.entrance.x).toBe(d.rooms[0].x);
    expect(d.endDoor.x).toBe(d.rooms[0].x + d.rooms[0].w);
  });

  it("sits two rows above the chest when nothing is in the way", () => {
    const file = fileWithCode("quiet_end.py", [fn("start", 3, 10), fn("finish", 12, 20)], [[4, "dustBunny"]]);
    const d = generateDungeon(file, 4);
    expect(d.endDoor.y).toBe(d.chest.y - 2);
  });

  it("is the same for the same seed, and is the only thing the map gained", () => {
    const file = makeFileWithMonsters("same.py", monsterMix(6, 0));
    const d = generateDungeon(file, 31);
    expect(generateDungeon(file, 31).endDoor).toEqual(d.endDoor);
    const ways = Array.from(d.ground).filter((g) => g === Ground.DungeonExit).length;
    expect(ways).toBe(2);
  });

  it("is checked by dungeonProblems", () => {
    const file = makeFileWithMonsters("broken.py", monsterMix(3, 0));
    const d = generateDungeon(file, 2);
    const { last, landing } = doorOf(d);
    expect(dungeonProblems({ ...d, endDoor: { x: last.x + 2, y: last.y + 2 } }, file).some((p) => p.includes("east wall"))).toBe(true);
    const crate = { kind: "crate" as const, x: landing[0].x, y: landing[0].y, variant: 0, solid: true };
    expect(dungeonProblems({ ...d, props: [...d.props, crate] }, file).some((p) => p.includes("in front of the end door"))).toBe(true);
  });
});
