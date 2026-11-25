/**
 * Fuzz test: throw many differently shaped fake repos at the overworld
 * generator and check the invariants that keep the game playable.
 */
import { describe, expect, it } from "vitest";
import type { Overworld } from "@/lib/types";
import { generateOverworld, overworldProblems, reachableFrom, solidPropTiles } from "@/lib/worldgen";
import { makeFakeAnalysis, type FakeAnalysisOptions } from "./helpers";

const SHAPES: { name: string; opts: FakeAnalysisOptions }[] = [
  { name: "one file", opts: { fileCount: 1 } },
  { name: "everything in the root", opts: { dirCount: 0 } },
  { name: "150 files", opts: { fileCount: 150, dirCount: 8 } },
  { name: "25 top-level dirs", opts: { fileCount: 60, dirCount: 25 } },
  { name: "deep nesting", opts: { maxDepth: 5, dirCount: 3 } },
  { name: "zero findings", opts: { cursedRate: 0 } },
  { name: "every file cursed", opts: { cursedRate: 1, bossRate: 0.3 } },
  { name: "messy (failed files, many inits)", opts: { failedRate: 0.3, initRate: 1 } },
  { name: "mostly failed downloads", opts: { failedRate: 0.7, initRate: 1, fileCount: 30 } },
  { name: "three files, three dirs", opts: { fileCount: 3, dirCount: 3, rootShare: 0 } },
];
const SEEDS = 60;

function overlappingBuildings(world: Overworld): string[] {
  const out: string[] = [];
  world.buildings.forEach((a, i) => {
    for (const b of world.buildings.slice(i + 1)) {
      // At least one free tile must separate two buildings.
      const apart = a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y;
      if (!apart) out.push(`${a.path} / ${b.path}`);
    }
  });
  return out;
}

describe("overworld fuzz", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const shape = SHAPES[seed % SHAPES.length];
    it(`seed ${seed}: ${shape.name}`, () => {
      const analysis = makeFakeAnalysis(seed, shape.opts);
      const world = generateOverworld(analysis);

      expect(overworldProblems(world, analysis)).toEqual([]);
      expect(overlappingBuildings(world)).toEqual([]);
      expect(world.width).toBeLessThanOrEqual(200);
      expect(world.height).toBeLessThanOrEqual(200);

      const reach = reachableFrom(world, world.spawn, [...solidPropTiles(world.props), ...world.npcs]);
      for (const b of world.buildings) expect(reach[b.door.y * world.width + b.door.x]).toBe(1);

      const shown = world.buildings.length + world.props.filter((p) => (p.kind === "lantern" || p.kind === "stump") && p.text).length;
      expect(shown).toBe(analysis.files.length);

      if (seed % 10 === 0) expect(generateOverworld(analysis)).toEqual(world);
    });
  }
});
