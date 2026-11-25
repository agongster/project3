import { describe, expect, it } from "vitest";
import { Ground } from "@/lib/types";
import { createTileMap, setTile } from "@/lib/worldgen/grid";
import { renderAscii, reachableFrom } from "@/lib/worldgen";
import { planRegions, signText } from "@/lib/worldgen/regions";
import { repoFacts } from "@/lib/worldgen/villagers";
import { finishAnalysis, makeFakeAnalysis } from "./helpers";

describe("reachableFrom", () => {
  //   .#.
  //   .#.
  //   ...
  const map = createTileMap(3, 3, Ground.Grass, false);
  setTile(map, 1, 0, Ground.Water, true);
  setTile(map, 1, 1, Ground.Water, true);

  it("flood-fills around walls using 4-neighbour steps", () => {
    const reach = reachableFrom(map, { x: 0, y: 0 });
    expect([...reach]).toEqual([1, 0, 1, 1, 0, 1, 1, 1, 1]);
  });

  it("treats extra solid tiles (props, villagers) as walls", () => {
    const reach = reachableFrom(map, { x: 0, y: 0 }, [{ x: 1, y: 2 }]);
    expect(reach[2]).toBe(0);
    expect(reach[6]).toBe(1);
  });

  it("reaches nothing from a blocked or out-of-bounds start", () => {
    expect([...reachableFrom(map, { x: 1, y: 0 })].every((v) => v === 0)).toBe(true);
    expect([...reachableFrom(map, { x: 9, y: 9 })].every((v) => v === 0)).toBe(true);
  });
});

describe("renderAscii", () => {
  it("draws one character per tile, with overlays on top", () => {
    const map = createTileMap(4, 2, Ground.Grass, false);
    setTile(map, 0, 1, Ground.Path, false);
    expect(renderAscii(map, [{ x: 3, y: 0, ch: "@" }])).toBe("...@\n=...");
  });
});

describe("makeFakeAnalysis", () => {
  it("is deterministic and honours the options", () => {
    const a = makeFakeAnalysis(3, { fileCount: 30, dirCount: 4 });
    expect(makeFakeAnalysis(3, { fileCount: 30, dirCount: 4 })).toEqual(a);
    expect(a.files).toHaveLength(30);
    expect(new Set(a.files.map((f) => f.path)).size).toBe(30);
    expect(a.stats.findingCount).toBe(a.files.reduce((s, f) => s + f.findings.length, 0));
    expect(makeFakeAnalysis(3, { dirCount: 0 }).files.every((f) => !f.path.includes("/"))).toBe(true);
  });
});

describe("region planning and villager facts", () => {
  it("keeps nested files in their top-level region, sorted by path", () => {
    const analysis = makeFakeAnalysis(11, { fileCount: 30, dirCount: 2, maxDepth: 4 });
    const plans = planRegions(analysis.files);
    for (const plan of plans.slice(1)) {
      expect(plan.files.every((f) => f.path.startsWith(`${plan.dir}/`))).toBe(true);
      const paths = plan.files.map((f) => f.path);
      expect(paths).toEqual([...paths].sort());
    }
  });

  it("writes sign text with singular/plural and clean regions", () => {
    const analysis = makeFakeAnalysis(12, { fileCount: 1, dirCount: 1, rootShare: 0, cursedRate: 0, failedRate: 0, initRate: 0 });
    const [, region] = planRegions(analysis.files);
    expect(signText(region)).toBe(`${region.name} — 1 file, all clean`);
  });

  it("states facts that make sense for an empty-ish repo", () => {
    const facts = repoFacts(finishAnalysis("empty", makeFakeAnalysis(13, { fileCount: 1, cursedRate: 0 }).files, { stars: 0, description: null }));
    expect(facts[0]).toContain("just one file");
    expect(facts.join(" ")).toContain("Not a single bug in the whole land!");
    expect(facts.join(" ")).not.toContain("undefined");
  });
});
