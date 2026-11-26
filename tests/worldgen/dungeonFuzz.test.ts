/**
 * Fuzz test: generate the dungeon of every cursed file of many fake repos
 * (files with random outlines: scripts, classes with methods, branchy and
 * documented functions, 300-character names) and check the invariants that
 * keep each dungeon playable and true to its file — the end door included.
 */
import { describe, expect, it } from "vitest";
import { generateDungeon, dungeonProblems, reachableFrom, solidPropTiles } from "@/lib/worldgen";
import { endDoorLanding } from "@/lib/worldgen/dungeonDoorSpot";
import { MONSTERS } from "@/lib/game/catalog";
import type { MonsterSpawn } from "@/lib/types";
import { makeFakeAnalysis, type FakeAnalysisOptions } from "./helpers";

const SHAPES: { name: string; opts: FakeAnalysisOptions }[] = [
  { name: "ordinary repo", opts: {} },
  { name: "every file cursed, many bosses", opts: { cursedRate: 1, bossRate: 0.3 } },
  { name: "crowded files", opts: { cursedRate: 1, maxFindings: 30, fileCount: 8 } },
  { name: "one finding per file", opts: { cursedRate: 1, maxFindings: 1, fileCount: 12 } },
  { name: "a dozen findings per file, some bosses", opts: { cursedRate: 1, maxFindings: 12, bossRate: 0.15, fileCount: 10 } },
];
const SEEDS = 60;

/**
 * True when tile `t` is in the space the generator keeps around monster `m`
 * (dungeon.ts monsterSpace): its footprint plus a tile, and the caption band
 * under it where its line of code is carved (4 tiles either side, 2 rows).
 */
function nearMonster(t: { x: number; y: number }, m: MonsterSpawn): boolean {
  const reach = MONSTERS[m.kind].size > 16 ? 2 : 1;
  const inSquare = Math.abs(t.x - m.x) <= reach && Math.abs(t.y - m.y) <= reach;
  const inBand = Math.abs(t.x - m.x) <= 4 && (t.y === m.y || t.y === m.y + 1);
  return inSquare || inBand;
}

describe("dungeon fuzz", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const shape = SHAPES[seed % SHAPES.length];
    it(`seed ${seed}: ${shape.name}`, () => {
      const analysis = makeFakeAnalysis(seed, shape.opts);
      for (const file of analysis.files.filter((f) => f.findings.length > 0)) {
        const dungeon = generateDungeon(file, seed);
        expect(dungeonProblems(dungeon, file)).toEqual([]);
        // The end door: on the last room's east wall, reachable, free floor in front (all also in dungeonProblems).
        const last = dungeon.rooms[dungeon.rooms.length - 1];
        expect(dungeon.endDoor.x).toBe(last.x + last.w);
        const reach = reachableFrom(dungeon, dungeon.entrance, solidPropTiles(dungeon.props));
        for (const t of [dungeon.endDoor, ...endDoorLanding(dungeon.endDoor)]) expect(reach[t.y * dungeon.width + t.x]).toBe(1);
        for (const t of endDoorLanding(dungeon.endDoor)) for (const m of dungeon.monsters) expect(nearMonster(t, m)).toBe(false);
        expect(dungeon.width).toBeLessThanOrEqual(200);
        if (seed % 10 === 0) expect(generateDungeon(file, seed)).toEqual(dungeon);
      }
    });
  }
});
