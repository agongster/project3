/**
 * The village cast: a guide who welcomes the player with the README,
 * merchants named after the most-imported packages, and villagers named
 * after (and quoting) the code of the region they live in. Every village,
 * including one built from hostile or completely empty outlines, must be
 * complete and sensible.
 */
import { describe, expect, it } from "vitest";
import { emptyOutline, type FileOutline } from "@/lib/analysis/outline";
import { rngFromString } from "@/lib/rng";
import type { AnalyzedFile, Definition, RepoAnalysis } from "@/lib/types";
import { generateOverworld, overworldProblems } from "@/lib/worldgen";
import { MAX_MERCHANTS } from "@/lib/worldgen/merchants";
import { ATTRIBUTION_SEPARATOR, MAX_BUBBLE_LENGTH, MAX_QUOTE_LENGTH, MAX_VILLAGER_NAME } from "@/lib/worldgen/repoWords";
import { GAMEPLAY_TIPS, MAX_VILLAGERS, VILLAGER_NAMES, writeVillagers, type VillagerCast } from "@/lib/worldgen/villagers";
import { finishAnalysis, makeFakeAnalysis, makeFakeFile } from "./helpers";

function def(name: string, kind: Definition["kind"], line: number, endLine: number, docstring: string | null = null): Definition {
  return { name, kind, line, endLine, branches: 0, docstring };
}

/** A clean module with the given outline. */
function file(path: string, outline: Partial<FileOutline>, lineCount = 120): AnalyzedFile {
  const base = makeFakeFile(rngFromString(path), path, "module", lineCount, { cursedRate: 0, failedRate: 0 });
  return { ...base, outline: { ...emptyOutline(), ...outline } };
}

const BAKERY = [
  file("bakery/oven.py", {
    imports: ["numpy", "os"],
    definitions: [def("OvenTimer", "class", 3, 40, "Counts down while the bread bakes."), def("preheat", "function", 42, 60, "Warm the oven up slowly.")],
    comments: [{ line: 50, text: "Never open the door while the souffle rises." }],
  }),
  file("bakery/recipes.py", { imports: ["numpy", "requests"], comments: [{ line: 4, text: "Granny's secret: a pinch of salt in the caramel." }] }),
];
const POTIONS = [file("potions/brew.py", { imports: ["numpy"], definitions: [def("stir_cauldron", "function", 1, 20, "Stir clockwise, as tradition demands.")] })];
const ROOT = [file("main.py", { imports: ["bakery", "potions", "requests"], definitions: [def("open_shop", "function", 1, 10, "Greet the morning customers.")] })];

function rich(extra: Partial<RepoAnalysis> = {}): RepoAnalysis {
  return finishAnalysis("shop", [...ROOT, ...BAKERY, ...POTIONS], { readme: "The friendliest bakery in the kingdom.", ...extra });
}

function everyone(cast: VillagerCast) {
  return [...cast.town, ...cast.regional.map((r) => r.script)];
}

function expectSensible(cast: VillagerCast): void {
  const all = everyone(cast);
  expect(all.length).toBeLessThanOrEqual(MAX_VILLAGERS);
  expect(new Set(all.map((v) => v.name)).size).toBe(all.length);
  for (const villager of all) {
    expect(villager.name.trim()).not.toBe("");
    expect(villager.lines.length).toBeGreaterThanOrEqual(1);
    expect(villager.lines.length).toBeLessThanOrEqual(3);
    for (const line of villager.lines) {
      expect(line.trim()).not.toBe("");
      expect(line).not.toContain("undefined");
      const [words, note] = line.split(ATTRIBUTION_SEPARATOR);
      expect(words.replace(/[“”\s]/g, "")).not.toBe("");
      if (note !== undefined) expect(note).toMatch(/^# from /);
    }
    for (const saying of villager.bubbles) {
      expect(saying.trim()).not.toBe("");
      expect(saying.length).toBeLessThanOrEqual(MAX_BUBBLE_LENGTH);
      expect(saying).toMatch(/^[\x20-\x7E]+$/);
    }
  }
}

describe("writeVillagers", () => {
  const cast = writeVillagers(rich(), 4, rngFromString("seed"));

  it("lets the guide welcome the player with the README, the overview and the controls", () => {
    const [guide] = cast.town;
    expect(guide.name).toBe("Open Shop");
    expect(guide.lines).toEqual(["Welcome to shop! The friendliest bakery in the kingdom.", "Welcome! This land has 4 files and 480 lines of Python.", GAMEPLAY_TIPS[0]]);
    expect(guide.bubbles).toEqual(["Welcome to shop!"]);
  });

  it("sets up merchants for the most-imported outside packages", () => {
    const merchants = cast.town.filter((v) => v.name.endsWith(" merchant"));
    expect(merchants.map((m) => m.name)).toEqual(["the numpy merchant", "the requests merchant"].slice(0, MAX_MERCHANTS));
    expect(merchants[0].lines[0]).toBe("Fresh numpy, right here! 3 of the 4 houses here buy from me — bakery/oven.py is my best customer.");
    expect(merchants[0].bubbles).toContain("3 houses buy my numpy!");
  });

  it("names region villagers after their region's code and has them quote it, with attributions", () => {
    const bakery = cast.regional.find((r) => r.regionId === "dir:bakery")!.script;
    expect(bakery.name).toBe("Oven Timer");
    expect(bakery.lines[0]).toBe("“Counts down while the bread bakes.”\n# from OvenTimer in bakery/oven.py");
    expect(bakery.bubbles.every((saying) => ["Counts down while the bread bakes.", "Warm the oven up slowly.", "Never open the door while the souffle rises.", "Granny's secret: a pinch of salt in the caramel."].includes(saying))).toBe(true);
  });

  it("keeps a gameplay tip as every ordinary villager's last line", () => {
    for (const villager of everyone(cast).filter((v) => !v.name.endsWith(" merchant"))) expect(GAMEPLAY_TIPS).toContain(villager.lines.at(-1));
  });

  it("is complete, sensible and deterministic", () => {
    expectSensible(cast);
    expect(writeVillagers(rich(), 4, rngFromString("seed"))).toEqual(cast);
  });

  it("falls back to the GitHub description, then to the overview, when there is no README", () => {
    const described = writeVillagers(rich({ readme: null, description: "Cakes & potions" }), 4, rngFromString("s"));
    expect(described.town[0].lines[0]).toBe('Welcome to shop! They say it\'s all about "Cakes & potions"');
    expect(everyone(described).flatMap((v) => v.lines).join(" ")).not.toContain("They say this land is all about");
    const bare = writeVillagers(rich({ readme: null, description: null }), 4, rngFromString("s"));
    expect(bare.town[0].lines[0]).toBe("Welcome! This land has 4 files and 480 lines of Python.");
  });

  it("never has more than MAX_VILLAGERS, even with room for six ordinary villagers and merchants", () => {
    expect(everyone(writeVillagers(rich(), 6, rngFromString("s"))).length).toBeLessThanOrEqual(MAX_VILLAGERS);
  });
});

describe("a village without any repo words", () => {
  const silent = finishAnalysis("silent", [...ROOT, ...BAKERY, ...POTIONS].map((f) => ({ ...f, outline: emptyOutline() })), { readme: null, description: null });
  const cast = writeVillagers(silent, 4, rngFromString("x"));

  it("uses the classic names and the repo facts, and has no merchants", () => {
    expectSensible(cast);
    for (const villager of everyone(cast)) {
      expect(VILLAGER_NAMES).toContain(villager.name);
      expect(villager.lines.join(" ")).not.toContain(ATTRIBUTION_SEPARATOR);
    }
    expect(cast.town.some((v) => v.name.endsWith(" merchant"))).toBe(false);
  });

  it("still gives everyone a greeting to pop in a bubble", () => {
    for (const villager of everyone(cast)) expect(villager.bubbles.length).toBeGreaterThan(0);
  });
});

describe("a village built from hostile text", () => {
  const weird = "x".repeat(500);
  const hostile = finishAnalysis(
    "h" + "o".repeat(200) + "stile",
    [
      file("main.py", {
        imports: ["q".repeat(300), "numpy", "🍰"],
        moduleDocstring: "<script>alert('hi')</script> **bold** [link](http://x.y)",
        definitions: [def(weird, "function", 1, 400, "y".repeat(5000)), def("__init__", "method", 2, 3, "!!!!")],
        comments: [
          { line: 1, text: "!!!!!!!!!!!!!!!!!!!!" },
          { line: 2, text: "这是训练循环的核心部分，请不要随便修改它" },
          { line: 3, text: "🍰🍰🍰 cake cake cake 🍰🍰🍰" },
          { line: 4, text: "" },
          { line: 5, text: "word ".repeat(400) },
        ],
      }),
      file(`${"deep".repeat(40)}/x.py`, { definitions: [def("Ünïcödé", "class", 1, 2, "\u0000\u0007 control chars and words here")] }),
    ],
    { readme: "z".repeat(10_000), description: "d".repeat(10_000) },
  );
  const cast = writeVillagers(hostile, 6, rngFromString("h"));

  it("stays complete, sensible and bounded", () => {
    expectSensible(cast);
    for (const villager of everyone(cast)) {
      expect(villager.name.length).toBeLessThanOrEqual(MAX_VILLAGER_NAME + " merchant".length + 4 + 14);
      for (const line of villager.lines) expect(Array.from(line.split(ATTRIBUTION_SEPARATOR)[0]).length).toBeLessThanOrEqual(Math.max(MAX_QUOTE_LENGTH + 2, 240));
    }
  });

  it("builds a valid world", () => {
    const world = generateOverworld(hostile);
    expect(overworldProblems(world, hostile)).toEqual([]);
  });
});

describe("villagers in the world", () => {
  it("stand by their own region's gate, and the world stays valid", () => {
    const analysis = rich();
    const world = generateOverworld(analysis);
    expect(overworldProblems(world, analysis)).toEqual([]);
    const bakeryVillager = world.npcs.find((n) => n.name === "Oven Timer");
    const bakery = world.regions.find((r) => r.dir === "bakery")!;
    expect(bakeryVillager).toBeDefined();
    const distanceToRegion = Math.max(bakery.x - bakeryVillager!.x, bakeryVillager!.x - (bakery.x + bakery.w), bakery.y - bakeryVillager!.y, bakeryVillager!.y - (bakery.y + bakery.h), 0);
    expect(distanceToRegion).toBeLessThanOrEqual(4);
  });

  it("fuzz: random repos with random outlines always make valid, talkative villages", () => {
    for (let seed = 0; seed < 40; seed++) {
      const analysis = { ...makeFakeAnalysis(seed), readme: seed % 3 === 0 ? null : `Readme number ${seed} says hello to everyone.` };
      // Sprinkle outside imports so some villages get merchants.
      const files = analysis.files.map((f, i) => ({ ...f, outline: { ...f.outline, imports: i % 2 === 0 ? ["numpy", "os"] : ["torch"] } }));
      const withImports = { ...analysis, files };
      const world = generateOverworld(withImports);
      expect(overworldProblems(world, withImports)).toEqual([]);
      expect(world.npcs.length).toBeGreaterThanOrEqual(3);
      expect(world.npcs.length).toBeLessThanOrEqual(MAX_VILLAGERS);
      for (const npc of world.npcs) for (const line of npc.lines) expect(line.trim()).not.toBe("");
    }
  });
});
