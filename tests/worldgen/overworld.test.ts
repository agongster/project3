import { describe, expect, it } from "vitest";
import { Ground, type AnalyzedFile, type Overworld, type Point } from "@/lib/types";
import { hashString, mulberry32 } from "@/lib/rng";
import { generateOverworld, overworldProblems, reachableFrom, renderAscii, solidPropTiles } from "@/lib/worldgen";
import { finishAnalysis, makeFakeAnalysis, makeFakeFile, makeFakeFinding } from "./helpers";

/** Independent re-statement of the reachability invariant (not reusing the generator's own checker). */
function unreachableTargets(world: Overworld): Point[] {
  const reach = reachableFrom(world, world.spawn, [...solidPropTiles(world.props), ...world.npcs]);
  const faced = world.props.filter((p) => ["well", "wardrobe", "board", "fountain", "sign"].includes(p.kind));
  const targets = [
    world.spawn,
    ...world.buildings.map((b) => b.door),
    ...faced.map((p) => ({ x: p.x, y: p.y + 1 })),
    ...world.npcs.map((n) => ({ x: n.x, y: n.y + 1 })),
  ];
  return targets.filter((t) => !reach[t.y * world.width + t.x]);
}

function fileAt(path: string, overrides: Partial<AnalyzedFile> = {}): AnalyzedFile {
  const rng = mulberry32(hashString(path));
  return { ...makeFakeFile(rng, path, "module", 120, { cursedRate: 0, failedRate: 0 }), ...overrides };
}

describe("generateOverworld", () => {
  const analysis = makeFakeAnalysis(42, { fileCount: 24, dirCount: 4 });
  const world = generateOverworld(analysis);

  it("is deterministic: the same analysis gives an identical world", () => {
    expect(generateOverworld(analysis)).toEqual(world);
    expect(world.seed).toBe(hashString(`${analysis.repo.owner}/${analysis.repo.repo}@${analysis.repo.sha}`));
  });

  it("changes when the commit changes", () => {
    const other = generateOverworld({ ...analysis, repo: { ...analysis.repo, sha: "f".repeat(40) } });
    expect(other.seed).not.toBe(world.seed);
    expect(renderAscii(other)).not.toBe(renderAscii(world));
  });

  it("passes every structural invariant", () => {
    expect(world.ground.length).toBe(world.width * world.height);
    expect(world.solid.length).toBe(world.width * world.height);
    expect(overworldProblems(world, analysis)).toEqual([]);
    expect(unreachableTargets(world)).toEqual([]);
  });

  it("has Town Square first and one region per top-level directory", () => {
    expect(world.regions[0]).toMatchObject({ id: "town", name: "Town Square", dir: "" });
    const dirs = new Set(analysis.files.filter((f) => f.path.includes("/")).map((f) => f.path.split("/")[0]));
    expect(world.regions.slice(1).map((r) => r.dir).sort()).toEqual([...dirs].sort());
    for (const r of world.regions.slice(1)) expect(r.name).toBe(`${r.dir}/`);
    const totalFiles = world.regions.reduce((sum, r) => sum + r.fileCount, 0);
    expect(totalFiles).toBe(analysis.files.length);
  });

  it("puts every building inside its region, with doors on paths", () => {
    for (const b of world.buildings) {
      const region = world.regions.find((r) => r.id === b.regionId)!;
      expect(b.x).toBeGreaterThanOrEqual(region.x);
      expect(b.y).toBeGreaterThanOrEqual(region.y);
      expect(b.x + b.w).toBeLessThanOrEqual(region.x + region.w);
      expect(b.y + b.h).toBeLessThanOrEqual(region.y + region.h);
      expect(world.ground[b.door.y * world.width + b.door.x]).toBe(Ground.Path);
      expect(world.solid[b.door.y * world.width + b.door.x]).toBe(0);
    }
  });

  it("spawns on the plaza, a couple of steps from the fountain", () => {
    expect(world.ground[world.spawn.y * world.width + world.spawn.x]).toBe(Ground.Plaza);
    const fountain = world.props.find((p) => p.kind === "fountain")!;
    expect(Math.abs(fountain.x - world.spawn.x) + Math.abs(fountain.y - world.spawn.y)).toBeLessThanOrEqual(3);
  });

  it("has 3–6 chatty villagers with real facts", () => {
    expect(world.npcs.length).toBeGreaterThanOrEqual(3);
    expect(world.npcs.length).toBeLessThanOrEqual(6);
    const allLines = world.npcs.flatMap((n) => n.lines).join("\n");
    expect(allLines).toContain(`${analysis.files.length} files`);
    expect(allLines).toContain("Press Space to swing, Shift to dash!");
    expect(new Set(world.npcs.map((n) => n.name)).size).toBe(world.npcs.length);
  });

  it("puts a sign with a file count at every region entrance", () => {
    const signs = world.props.filter((p) => p.kind === "sign");
    expect(signs).toHaveLength(world.regions.length - 1);
    for (const r of world.regions.slice(1)) {
      expect(signs.some((s) => s.text?.startsWith(`${r.name} — ${r.fileCount} file`))).toBe(true);
    }
  });

  it("surrounds the map with an impassable forest", () => {
    for (let x = 0; x < world.width; x++) {
      expect(world.solid[x]).toBe(1);
      expect(world.solid[(world.height - 1) * world.width + x]).toBe(1);
    }
    for (let y = 0; y < world.height; y++) {
      expect(world.solid[y * world.width]).toBe(1);
      expect(world.solid[y * world.width + world.width - 1]).toBe(1);
    }
  });
});

describe("what each file turns into", () => {
  const files: AnalyzedFile[] = [
    fileAt("pkg/__init__.py", { kind: "init", lineCount: 0 }),
    fileAt("pkg/big_init/__init__.py", { kind: "init", lineCount: 40 }),
    fileAt("pkg/tiny.py", { lineCount: 79 }),
    fileAt("pkg/medium.py", { lineCount: 80 }),
    fileAt("pkg/large.py", { lineCount: 300 }),
    fileAt("pkg/test_stuff.py", { kind: "test", lineCount: 500 }),
    fileAt("pkg/lost.py", { status: "failed", lineCount: 0 }),
    fileAt("setup.py", { lineCount: 20 }),
  ];
  const analysis = finishAnalysis("kinds", files);
  const world = generateOverworld(analysis);
  const building = (path: string) => world.buildings.find((b) => b.path === path);

  it("uses the line count (and test-ness) to pick the building", () => {
    expect(building("pkg/tiny.py")).toMatchObject({ kind: "cottage", w: 2, h: 2 });
    expect(building("pkg/medium.py")).toMatchObject({ kind: "house", w: 3, h: 2 });
    expect(building("pkg/large.py")).toMatchObject({ kind: "manor", w: 4, h: 3 });
    expect(building("pkg/test_stuff.py")).toMatchObject({ kind: "tower", w: 2, h: 3 });
    expect(building("pkg/big_init/__init__.py")).toBeDefined();
    expect(building("setup.py")?.regionId).toBe("town");
  });

  it("turns trivial __init__.py into a lantern and failed files into a stump", () => {
    expect(building("pkg/__init__.py")).toBeUndefined();
    expect(building("pkg/lost.py")).toBeUndefined();
    const lantern = world.props.find((p) => p.kind === "lantern")!;
    expect(lantern).toMatchObject({ text: "pkg/__init__.py", solid: false });
    const stump = world.props.find((p) => p.kind === "stump" && p.text !== undefined)!;
    expect(stump).toMatchObject({ text: "pkg/lost.py", solid: true });
    expect(overworldProblems(world, analysis)).toEqual([]);
  });

  it("marks buildings with findings as corrupted", () => {
    const rng = mulberry32(1);
    const cursed = { ...fileAt("pkg/cursed.py"), findings: [makeFakeFinding(rng, "pkg/cursed.py", 3, "minion")] };
    const w = generateOverworld(finishAnalysis("cursed", [...files, cursed]));
    expect(w.buildings.find((b) => b.path === "pkg/cursed.py")?.corrupted).toBe(true);
    expect(w.buildings.find((b) => b.path === "pkg/tiny.py")?.corrupted).toBe(false);
  });
});

describe("special repos", () => {
  it("keeps a tiny repo cosy but never smaller than 40×30", () => {
    const world = generateOverworld(makeFakeAnalysis(5, { fileCount: 1, dirCount: 0 }));
    expect(world.width).toBeGreaterThanOrEqual(40);
    expect(world.height).toBeGreaterThanOrEqual(30);
    expect(world.width * world.height).toBeLessThan(60 * 50);
  });

  it("still builds Town Square when every file lives in a directory", () => {
    const analysis = makeFakeAnalysis(6, { fileCount: 10, dirCount: 2, rootShare: 0 });
    const world = generateOverworld(analysis);
    expect(world.regions[0]).toMatchObject({ name: "Town Square", fileCount: 0 });
    expect(world.props.filter((p) => ["well", "wardrobe", "board", "fountain"].includes(p.kind))).toHaveLength(4);
    expect(overworldProblems(world, analysis)).toEqual([]);
  });

  it("merges the smallest directories into the Outskirts when there are more than 10", () => {
    const analysis = makeFakeAnalysis(7, { fileCount: 60, dirCount: 25 });
    const world = generateOverworld(analysis);
    expect(world.regions.length).toBeLessThanOrEqual(11);
    const outskirts = world.regions.find((r) => r.name === "Outskirts");
    expect(outskirts).toBeDefined();
    expect(world.props.some((p) => p.kind === "sign" && p.text?.startsWith("Outskirts ("))).toBe(true);
    expect(overworldProblems(world, analysis)).toEqual([]);
  });

  it("celebrates a repo without a single finding", () => {
    const analysis = makeFakeAnalysis(8, { fileCount: 15, cursedRate: 0 });
    const world = generateOverworld(analysis);
    expect(world.buildings.every((b) => !b.corrupted)).toBe(true);
    expect(world.npcs.flatMap((n) => n.lines).join(" ")).toContain("Not a single bug in the whole land!");
  });

  it("keeps a typical repo walkable: every door within ~20 s at 5 tiles/s", () => {
    const world = generateOverworld(makeFakeAnalysis(9, { fileCount: 40, dirCount: 6 }));
    const dist = walkingDistances(world);
    const farthest = Math.max(...world.buildings.map((b) => dist[b.door.y * world.width + b.door.x]));
    expect(farthest).toBeLessThanOrEqual(100);
  });
});

/** BFS step counts from spawn (blocked by solid props and villagers). */
function walkingDistances(world: Overworld): Int32Array {
  const blocked = new Uint8Array(world.solid);
  for (const p of [...solidPropTiles(world.props), ...world.npcs]) blocked[p.y * world.width + p.x] = 1;
  const dist = new Int32Array(world.width * world.height).fill(-1);
  const queue = [world.spawn.y * world.width + world.spawn.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    for (const ni of [i - 1, i + 1, i - world.width, i + world.width]) {
      if (dist[ni] === -1 && !blocked[ni]) {
        dist[ni] = dist[i] + 1;
        queue.push(ni);
      }
    }
  }
  return dist;
}
