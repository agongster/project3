import { describe, expect, it } from "vitest";
import { Ground, type Dungeon, type MonsterKind } from "@/lib/types";
import { MONSTERS } from "@/lib/game/catalog";
import { generateDungeon, dungeonProblems, reachableFrom, solidPropTiles } from "@/lib/worldgen";
import { makeFileWithMonsters } from "./helpers";

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
const roomOf = (d: Dungeon, x: number, y: number) =>
  d.rooms.findIndex((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);

describe("generateDungeon", () => {
  const file = makeFileWithMonsters("potions/brew.py", monsterMix(9, 1));
  const dungeon = generateDungeon(file, 1234);

  it("is deterministic for the same repo seed and path", () => {
    expect(generateDungeon(file, 1234)).toEqual(dungeon);
    expect(generateDungeon(file, 999).seed).not.toBe(dungeon.seed);
  });

  it("has the right shape: 1–4 rooms, left to right, a 2-tile void margin", () => {
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(1);
    expect(dungeon.rooms.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < dungeon.rooms.length; i++) expect(dungeon.rooms[i].x).toBeGreaterThan(dungeon.rooms[i - 1].x + dungeon.rooms[i - 1].w);
    for (let x = 0; x < dungeon.width; x++) {
      for (const y of [0, 1, dungeon.height - 2, dungeon.height - 1]) expect(dungeon.ground[y * dungeon.width + x]).toBe(Ground.DungeonVoid);
    }
  });

  it("puts the entrance on the left of room 1 with the exit doormat right next to it", () => {
    const first = dungeon.rooms[0];
    expect(dungeon.entrance.x).toBe(first.x);
    expect(dungeon.ground[dungeon.exit.y * dungeon.width + dungeon.exit.x]).toBe(Ground.DungeonExit);
    expect(dungeon.solid[dungeon.exit.y * dungeon.width + dungeon.exit.x]).toBe(0);
    expect(Math.abs(dungeon.exit.x - dungeon.entrance.x) + Math.abs(dungeon.exit.y - dungeon.entrance.y)).toBe(1);
    const plaque = dungeon.props.find((p) => p.kind === "plaque")!;
    expect(plaque.text).toBe(file.path);
    expect(Math.abs(plaque.x - dungeon.entrance.x)).toBeLessThanOrEqual(3);
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
    expect(torches.length).toBeGreaterThan(0);
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
          expect(dungeonProblems(d, file)).toEqual([]);

          // One monster per finding.
          expect(d.monsters.map((m) => m.findingId).sort()).toEqual(file.findings.map((f) => f.id).sort());
          // Room count: about one room per 3–4 monsters.
          expect(d.rooms.length).toBe(Math.max(Math.min(4, Math.ceil(count / 3.5)), bosses > 0 && count > bosses ? 2 : 1));

          // Reachable from the entrance with solid props in the way.
          const reach = reachableFrom(d, d.entrance, solidPropTiles(d.props));
          for (const p of [d.exit, d.chest, ...d.monsters]) expect(reach[p.y * d.width + p.x]).toBe(1);

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

          // Bosses live in the last room, which is a proper arena.
          const bossSpawns = d.monsters.filter((m) => MONSTERS[m.kind].severity === "boss");
          for (const b of bossSpawns) expect(roomOf(d, b.x, b.y)).toBe(d.rooms.length - 1);
          if (bossSpawns.length > 0) {
            const arena = d.rooms[d.rooms.length - 1];
            expect(arena.w).toBeGreaterThanOrEqual(13);
            expect(arena.h).toBeGreaterThanOrEqual(9);
          }

          // Regular monsters read left to right in line order.
          const byLine = new Map(file.findings.map((f) => [f.id, f.line]));
          const regular = d.monsters.filter((m) => MONSTERS[m.kind].severity !== "boss");
          for (let i = 1; i < regular.length; i++) {
            expect(byLine.get(regular[i].findingId)!).toBeGreaterThanOrEqual(byLine.get(regular[i - 1].findingId)!);
            expect(regular[i].x).toBeGreaterThanOrEqual(regular[i - 1].x);
          }
        }
      });
    }
  }

  it("copes with a crowded file (30 findings, several bosses)", () => {
    const file = makeFileWithMonsters("crowded.py", monsterMix(30, 5));
    const d = generateDungeon(file, 1);
    expect(dungeonProblems(d, file)).toEqual([]);
    expect(d.rooms.length).toBe(4);
  });

  it("keeps the map tight: no huge empty void", () => {
    const d = generateDungeon(makeFileWithMonsters("small.py", ["dustBunny"]), 5);
    const last = d.rooms[d.rooms.length - 1];
    expect(d.width).toBe(last.x + last.w + 3);
    expect(d.height).toBeLessThanOrEqual(Math.max(...d.rooms.map((r) => r.h)) + 9);
  });
});
