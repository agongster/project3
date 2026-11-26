/**
 * Fuzz test: generate the dungeon of every cursed file of many fake repos
 * (files with random outlines: scripts, classes with methods, branchy and
 * documented functions, 300-character names) and check the invariants that
 * keep each dungeon playable and true to its file.
 */
import { describe, expect, it } from "vitest";
import { generateDungeon, dungeonProblems } from "@/lib/worldgen";
import { makeFakeAnalysis, type FakeAnalysisOptions } from "./helpers";

const SHAPES: { name: string; opts: FakeAnalysisOptions }[] = [
  { name: "ordinary repo", opts: {} },
  { name: "every file cursed, many bosses", opts: { cursedRate: 1, bossRate: 0.3 } },
  { name: "crowded files", opts: { cursedRate: 1, maxFindings: 30, fileCount: 8 } },
  { name: "one finding per file", opts: { cursedRate: 1, maxFindings: 1, fileCount: 12 } },
  { name: "a dozen findings per file, some bosses", opts: { cursedRate: 1, maxFindings: 12, bossRate: 0.15, fileCount: 10 } },
];
const SEEDS = 60;

describe("dungeon fuzz", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const shape = SHAPES[seed % SHAPES.length];
    it(`seed ${seed}: ${shape.name}`, () => {
      const analysis = makeFakeAnalysis(seed, shape.opts);
      for (const file of analysis.files.filter((f) => f.findings.length > 0)) {
        const dungeon = generateDungeon(file, seed);
        expect(dungeonProblems(dungeon, file)).toEqual([]);
        expect(dungeon.width).toBeLessThanOrEqual(200);
        if (seed % 10 === 0) expect(generateDungeon(file, seed)).toEqual(dungeon);
      }
    });
  }
});
