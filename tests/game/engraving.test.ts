/**
 * Named loot: a chest item is engraved with the code it came from, and the
 * save remembers it per owned item (bounded, sanitized, backward compatible).
 */
import { describe, expect, it } from "vitest";
import { emptyOutline } from "@/lib/analysis/outline";
import { getItem } from "@/lib/game/catalog";
import {
  cleanEngraving,
  engraveItem,
  engravingFor,
  engravingOf,
  engravingText,
  MAX_ENGRAVED_NAME,
  MAX_ENGRAVED_PATH,
  sanitizeEngravings,
  showpieceDefinition,
} from "@/lib/game/engraving";
import { wish } from "@/lib/game/gacha";
import { openChest, rollChest } from "@/lib/game/loot";
import { defaultSave, sanitizeSave } from "@/lib/game/store";
import { mulberry32 } from "@/lib/rng";
import type { AnalyzedFile, Definition } from "@/lib/types";
import { KEY, makeFile, makeFinding, saveWith, STARTER_IDS, VETERAN_OWNED } from "./helpers";

function def(name: string, kind: Definition["kind"], line: number, endLine: number, docstring: string | null = null): Definition {
  return { name, kind, line, endLine, branches: 0, docstring };
}

function withDefinitions(file: AnalyzedFile, definitions: Definition[]): AnalyzedFile {
  return { ...file, outline: { ...emptyOutline(), definitions } };
}

describe("engravingFor", () => {
  it("engraves a clean file's best-documented function, the longest on a tie", () => {
    const file = withDefinitions(makeFile("data/prepare.py"), [
      def("tokenize", "function", 1, 40, null),
      def("get_batch", "function", 42, 60, "Grab a random batch."),
      def("Loader", "class", 62, 90, "Loads things."),
      def("Loader.load", "method", 64, 89, "Load it all."),
    ]);
    expect(showpieceDefinition(file)?.name).toBe("Loader.load");
    expect(engravingFor(file, "clean-file")).toEqual({ name: "Loader.load()", path: "data/prepare.py" });
    expect(engravingText(engravingFor(file, "clean-file"))).toBe("Forged in Loader.load() · data/prepare.py");
  });

  it("uses a class when a clean file has no functions, and only the file when it has nothing", () => {
    expect(engravingFor(withDefinitions(makeFile("a.py"), [def("OrderBook", "class", 1, 9)]), "clean-file").name).toBe("OrderBook");
    const bare = engravingFor(makeFile("config.py"), "clean-file");
    expect(bare).toEqual({ name: null, path: "config.py" });
    expect(engravingText(bare)).toBe("Forged in config.py");
  });

  it("engraves a dungeon chest with the function that held the toughest monster", () => {
    const findings = [makeFinding("potions/brewing.py", 5, "dustBunny"), makeFinding("potions/brewing.py", 12, "evalSerpent"), makeFinding("potions/brewing.py", 30, "gremlin")];
    const file = withDefinitions(makeFile("potions/brewing.py", { findings }), [def("brew", "function", 10, 14, "Brew."), def("bottle", "function", 20, 40)]);
    expect(engravingFor(file, "dungeon-clear")).toEqual({ name: "brew()", path: "potions/brewing.py" });
  });

  it("falls back to the file when the toughest monster lives in module-level code", () => {
    const file = withDefinitions(makeFile("config.py", { findings: [makeFinding("config.py", 3, "keyThief")] }), [def("load", "function", 10, 20)]);
    expect(engravingFor(file, "dungeon-clear")).toEqual({ name: null, path: "config.py" });
  });

  it("clips enormous names and paths", () => {
    const file = withDefinitions(makeFile(`${"very/".repeat(60)}deep.py`), [def("x".repeat(500), "function", 1, 2)]);
    const engraving = engravingFor(file, "clean-file");
    expect(Array.from(engraving.name!).length).toBeLessThanOrEqual(MAX_ENGRAVED_NAME);
    expect(engraving.name!.endsWith("…()")).toBe(true);
    expect(Array.from(engraving.path).length).toBeLessThanOrEqual(MAX_ENGRAVED_PATH);
    expect(engraving.path.endsWith("/deep.py")).toBe(true);
  });
});

describe("remembering engravings", () => {
  const duck = getItem("rubberDuck")!;
  const file = withDefinitions(makeFile("bakery/oven.py", { grade: "S" }), [def("bake_batch", "function", 1, 30, "Bake a tray.")]);

  it("a chest roll carries the engraving of its item, and none without an item", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const loot = rollChest({ source: "clean-file", file, owned: VETERAN_OWNED }, rng);
      expect(loot.engraving).toEqual(loot.item ? { name: "bake_batch()", path: "bakery/oven.py" } : null);
    }
  });

  it("opening a chest engraves a new item, but not a duplicate", () => {
    const loot = { coins: 5, item: duck, rarity: duck.rarity, isNew: true, refund: 0, grade: "S" as const, headline: "", reasons: [], engraving: { name: "bake_batch()", path: "bakery/oven.py" } };
    const opened = openChest(defaultSave(), KEY, loot, file.path);
    expect(engravingOf(opened, "rubberDuck")).toEqual({ name: "bake_batch()", path: "bakery/oven.py" });

    const owner = saveWith({ owned: [...STARTER_IDS, "rubberDuck"] });
    const again = openChest(owner, KEY, { ...loot, isNew: false, refund: 20 }, "other.py");
    expect(engravingOf(again, "rubberDuck")).toBeNull();
  });

  it("keeps the first engraving and ignores items that are not owned", () => {
    const owner = saveWith({ owned: [...STARTER_IDS, "rubberDuck"] });
    const first = engraveItem(owner, "rubberDuck", { name: "a()", path: "a.py" });
    expect(engraveItem(first, "rubberDuck", { name: "b()", path: "b.py" })).toBe(first);
    expect(engraveItem(owner, "bugNet", { name: "a()", path: "a.py" })).toBe(owner);
  });

  it("never engraves Wishing Well items", () => {
    const rich = saveWith({ coins: 10_000, owned: VETERAN_OWNED });
    const wished = wish(rich, mulberry32(9));
    expect(wished).not.toBeNull();
    expect(wished!.save.engravings).toBeUndefined();
  });

  it("does not look up inherited object properties as engravings", () => {
    expect(engravingOf(defaultSave(), "constructor")).toBeNull();
    expect(engravingOf(defaultSave(), "__proto__")).toBeNull();
  });
});

describe("sanitizing engravings", () => {
  it("keeps clean engravings of owned items only", () => {
    const owned = [...STARTER_IDS, "rubberDuck", "bugNet"];
    const raw = {
      rubberDuck: { name: "bake()", path: "bakery/oven.py" },
      bugNet: { name: 42, path: "x.py" },
      catEars: { name: "a()", path: "a.py" },
      madeUp: { name: "a()", path: "a.py" },
      twig: { name: "a()", path: "" },
    };
    expect(sanitizeEngravings(raw, owned)).toEqual({ rubberDuck: { name: "bake()", path: "bakery/oven.py" }, bugNet: { name: null, path: "x.py" } });
  });

  it("returns undefined for garbage or nothing, so old saves stay unchanged", () => {
    for (const junk of [undefined, null, 7, "x", [], {}, { rubberDuck: "x" }]) expect(sanitizeEngravings(junk, ["rubberDuck"])).toBeUndefined();
  });

  it("cleans hostile text", () => {
    const clean = cleanEngraving({ name: `\u0000${"n".repeat(1000)}\n`, path: `${"p/".repeat(500)}f.py` })!;
    expect(Array.from(clean.name!).length).toBeLessThanOrEqual(MAX_ENGRAVED_NAME);
    expect(clean.name).not.toMatch(/[\u0000\n]/);
    expect(Array.from(clean.path).length).toBeLessThanOrEqual(MAX_ENGRAVED_PATH);
  });

  it("survives a save round trip, and a save without engravings loads unchanged", () => {
    const owned = [...STARTER_IDS, "rubberDuck"];
    const save = saveWith({ owned, engravings: { rubberDuck: { name: "bake()", path: "bakery/oven.py" } } });
    expect(sanitizeSave(JSON.parse(JSON.stringify(save)))).toStrictEqual(save);
    const old = JSON.parse(JSON.stringify(saveWith({ owned })));
    delete old.engravings;
    expect(sanitizeSave(old)).toStrictEqual(saveWith({ owned }));
    expect("engravings" in sanitizeSave(old)).toBe(false);
  });
});
