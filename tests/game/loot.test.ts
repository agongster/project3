import { describe, expect, it } from "vitest";
import { MONSTERS, RARITY_INFO, getItem } from "@/lib/game/catalog";
import {
  CLEAN_FILE_CHESTS,
  DUNGEON_CHESTS,
  DUNGEON_COINS_PER_FINDING,
  beginnerSlot,
  openChest,
  rollChest,
  worstSeverity,
} from "@/lib/game/loot";
import { getProgress } from "@/lib/game/progress";
import { defaultSave } from "@/lib/game/store";
import { mulberry32 } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import type { AnalyzedFile, Grade } from "@/lib/types";
import type { ChestLoot } from "@/lib/game/loot";
import { KEY, STARTER_IDS, VETERAN_OWNED, deepFreeze, makeFile, makeFinding, saveWith } from "./helpers";

const ROLLS = 3000;

function rollMany(file: AnalyzedFile, source: "clean-file" | "dungeon-clear", owned: string[], rng: Rng): ChestLoot[] {
  return Array.from({ length: ROLLS }, () => rollChest({ source, file, owned }, rng));
}

function itemShare(loots: ChestLoot[]): number {
  return loots.filter((loot) => loot.item !== null).length / loots.length;
}

describe("clean-file chests", () => {
  const cleanFile = (grade: Grade) =>
    makeFile("potions/brew.py", { grade, highlights: ["Every function has a docstring", "Fully type-hinted"] });

  it("grade S: always epic or better, ~25% legendary, 40–60 coins", () => {
    const loots = rollMany(cleanFile("S"), "clean-file", VETERAN_OWNED, mulberry32(1));
    for (const loot of loots) {
      expect(["epic", "legendary"]).toContain(loot.rarity);
      expect(loot.coins).toBeGreaterThanOrEqual(40);
      expect(loot.coins).toBeLessThanOrEqual(60);
    }
    const legendary = loots.filter((loot) => loot.rarity === "legendary").length / ROLLS;
    expect(legendary).toBeGreaterThan(0.21);
    expect(legendary).toBeLessThan(0.29);
  });

  it("grade A: always rare or better", () => {
    for (const loot of rollMany(cleanFile("A"), "clean-file", VETERAN_OWNED, mulberry32(2))) {
      expect(loot.rarity).not.toBe("common");
      expect(loot.item).not.toBeNull();
    }
  });

  it("grade B: usually a common or rare item", () => {
    const loots = rollMany(cleanFile("B"), "clean-file", VETERAN_OWNED, mulberry32(3));
    expect(itemShare(loots)).toBeCloseTo(CLEAN_FILE_CHESTS.B.itemChance, 1);
    for (const loot of loots) if (loot.rarity) expect(["common", "rare"]).toContain(loot.rarity);
  });

  it("grade C: mostly coins, sometimes a common item", () => {
    const loots = rollMany(cleanFile("C"), "clean-file", VETERAN_OWNED, mulberry32(4));
    expect(itemShare(loots)).toBeCloseTo(CLEAN_FILE_CHESTS.C.itemChance, 1);
    for (const loot of loots) {
      if (loot.rarity) expect(loot.rarity).toBe("common");
      expect(loot.coins).toBeGreaterThanOrEqual(8);
      expect(loot.coins).toBeLessThanOrEqual(15);
    }
  });

  it("explains itself: grade, headline and the file's highlights", () => {
    const loot = rollChest({ source: "clean-file", file: cleanFile("S"), owned: VETERAN_OWNED }, mulberry32(5));
    expect(loot.grade).toBe("S");
    expect(loot.headline).toMatch(/^Grade S code! An? (epic|legendary) reward for potions\/brew\.py$/);
    expect(loot.reasons).toEqual(["Every function has a docstring", "Fully type-hinted"]);

    const plain = rollChest({ source: "clean-file", file: makeFile("x.py", { grade: "C" }), owned: VETERAN_OWNED }, mulberry32(6));
    expect(plain.reasons.length).toBeGreaterThan(0);
  });
});

describe("dungeon-clear chests", () => {
  const boss = makeFile("vault.py", {
    findings: [makeFinding("vault.py", 1), makeFinding("vault.py", 2, "keyThief", { code: "S105" })],
  });
  const elite = makeFile("cave.py", { findings: [makeFinding("cave.py", 4, "gremlin", { code: "B006" })] });
  const minions = makeFile("dust.py", { findings: [1, 2, 3, 4, 5].map((line) => makeFinding("dust.py", line)) });

  it("finds the worst severity", () => {
    expect(worstSeverity(boss)).toBe("boss");
    expect(worstSeverity(elite)).toBe("elite");
    expect(worstSeverity(minions)).toBe("minion");
    expect(worstSeverity(makeFile("empty.py"))).toBe("minion");
  });

  it("boss dungeons: always rare or better, often epic", () => {
    const loots = rollMany(boss, "dungeon-clear", VETERAN_OWNED, mulberry32(7));
    for (const loot of loots) expect(["rare", "epic", "legendary"]).toContain(loot.rarity);
    expect(loots.filter((loot) => loot.rarity === "epic").length / ROLLS).toBeGreaterThan(0.25);
  });

  it("elite dungeons: always a common or rare item", () => {
    for (const loot of rollMany(elite, "dungeon-clear", VETERAN_OWNED, mulberry32(8))) {
      expect(["common", "rare"]).toContain(loot.rarity);
    }
  });

  it("minion dungeons: mostly coins, ~40% common item", () => {
    const loots = rollMany(minions, "dungeon-clear", VETERAN_OWNED, mulberry32(9));
    expect(itemShare(loots)).toBeCloseTo(DUNGEON_CHESTS.minion.itemChance, 1);
    for (const loot of loots) if (loot.rarity) expect(loot.rarity).toBe("common");
  });

  it("pays more coins for dungeons with more findings", () => {
    const [min, max] = DUNGEON_CHESTS.minion.coins;
    const bonus = minions.findings.length * DUNGEON_COINS_PER_FINDING;
    for (const loot of rollMany(minions, "dungeon-clear", VETERAN_OWNED, mulberry32(10))) {
      expect(loot.coins).toBeGreaterThanOrEqual(min + bonus);
      expect(loot.coins).toBeLessThanOrEqual(max + bonus);
    }
  });

  it("has no grade, and names the toughest foe", () => {
    const loot = rollChest({ source: "dungeon-clear", file: boss, owned: VETERAN_OWNED }, mulberry32(11));
    expect(loot.grade).toBeNull();
    expect(loot.headline).toContain("vault.py");
    expect(loot.reasons).toEqual(["Squashed 2 bugs in this file", `Toughest foe: ${MONSTERS.keyThief.name}`]);
  });
});

describe("beginner's luck", () => {
  const cFile = makeFile("meh.py", { grade: "C" });

  it("steers a new player to a weapon, then to a charm, then stops", () => {
    expect(beginnerSlot(STARTER_IDS)).toBe("weapon");
    expect(beginnerSlot([...STARTER_IDS, "bugNet"])).toBe("charm");
    expect(beginnerSlot(VETERAN_OWNED)).toBeNull();
  });

  it("guarantees a weapon in every chest until the player has one", () => {
    for (const loot of rollMany(cFile, "clean-file", STARTER_IDS, mulberry32(12))) {
      expect(loot.item?.slot).toBe("weapon");
      expect(loot.item?.starter).toBeFalsy();
      expect(loot.isNew).toBe(true);
    }
  });

  it("then makes any dropped item a charm", () => {
    const loots = rollMany(cFile, "clean-file", [...STARTER_IDS, "bugNet"], mulberry32(13));
    for (const loot of loots) if (loot.item) expect(loot.item.slot).toBe("charm");
  });
});

describe("openChest", () => {
  const file = makeFile("potions/brew.py", { grade: "A" });

  it("adds coins and the item, marks the chest opened and counts it", () => {
    const save = deepFreeze(saveWith({ coins: 5 }));
    const loot = rollChest({ source: "clean-file", file, owned: save.owned }, mulberry32(14));
    const opened = openChest(save, KEY, loot, file.path);

    expect(opened.coins).toBe(5 + loot.coins);
    expect(opened.owned).toContain(loot.item!.id);
    expect(getProgress(opened, KEY).opened).toEqual([file.path]);
    expect(opened.stats.chestsOpened).toBe(1);
  });

  it("is a no-op the second time", () => {
    const save = defaultSave();
    const loot = rollChest({ source: "clean-file", file, owned: save.owned }, mulberry32(15));
    const once = openChest(save, KEY, loot, file.path);
    expect(openChest(once, KEY, loot, file.path)).toBe(once);
  });

  it("refunds a duplicate item instead of granting it twice", () => {
    const save = saveWith({ owned: [...STARTER_IDS, "rubberDuck"] });
    const duck = getItem("rubberDuck")!;
    const loot: ChestLoot = {
      coins: 10,
      item: duck,
      rarity: duck.rarity,
      isNew: false,
      refund: RARITY_INFO.rare.dupeRefund,
      grade: "A",
      headline: "",
      reasons: [],
    };
    const opened = openChest(save, KEY, loot, file.path);
    expect(opened.coins).toBe(10 + RARITY_INFO.rare.dupeRefund);
    expect(opened.owned.filter((id) => id === "rubberDuck")).toHaveLength(1);
  });

  it("reports duplicates in the rolled loot", () => {
    const rng = mulberry32(16);
    for (let i = 0; i < 500; i++) {
      const loot = rollChest({ source: "clean-file", file, owned: VETERAN_OWNED }, rng);
      if (loot.item) {
        expect(loot.isNew).toBe(!VETERAN_OWNED.includes(loot.item.id));
        expect(loot.refund).toBe(loot.isNew ? 0 : RARITY_INFO[loot.item.rarity].dupeRefund);
      }
    }
  });
});
