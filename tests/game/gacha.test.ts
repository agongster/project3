import { describe, expect, it } from "vitest";
import { ALL_ITEMS, RARITIES, RARITY_INFO } from "@/lib/game/catalog";
import {
  EPIC_PITY,
  GACHA_ODDS_TEXT,
  LEGENDARY_PITY,
  WISH_COST,
  WISH_RATES,
  WISH_TEN_COST,
  canAfford,
  gachaOdds,
  pityStatus,
  rollItem,
  rollRarity,
  wish,
  wishCost,
  wishMany,
} from "@/lib/game/gacha";
import { defaultSave } from "@/lib/game/store";
import { mulberry32 } from "@/lib/rng";
import type { Rarity, SaveData } from "@/lib/types";
import { STARTER_IDS, deepFreeze, saveWith } from "./helpers";

/** Plenty of coins for thousands of wishes, but far enough below MAX_COINS that refunds are never clamped. */
const RICH_COINS = 1_000_000;
const rich = (): SaveData => saveWith({ coins: RICH_COINS });

describe("rollRarity", () => {
  it("matches the base rates over 20,000 rolls with no pity", () => {
    const rng = mulberry32(2024);
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const rolls = 20_000;
    for (let i = 0; i < rolls; i++) counts[rollRarity({ sinceEpic: 0, sinceLegendary: 0 }, rng)]++;

    for (const rarity of RARITIES) {
      // ±1.5 percentage points is > 4 standard deviations for every rarity at this sample size.
      expect(counts[rarity] / rolls).toBeCloseTo(WISH_RATES[rarity] / 100, 1);
      expect(Math.abs(counts[rarity] / rolls - WISH_RATES[rarity] / 100)).toBeLessThan(0.015);
    }
  });

  it("guarantees epic-or-better on the EPIC_PITY-th wish", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 2000; i++) {
      expect(["epic", "legendary"]).toContain(rollRarity({ sinceEpic: EPIC_PITY - 1, sinceLegendary: 0 }, rng));
    }
  });

  it("keeps a chance of legendary on a pity-guaranteed epic wish", () => {
    const rng = mulberry32(6);
    const results = Array.from({ length: 3000 }, () => rollRarity({ sinceEpic: EPIC_PITY - 1, sinceLegendary: 0 }, rng));
    const legendaryShare = results.filter((r) => r === "legendary").length / results.length;
    // Base ratio is 2 : 10 between legendary and epic, so about 1 in 6.
    expect(legendaryShare).toBeGreaterThan(0.12);
    expect(legendaryShare).toBeLessThan(0.22);
  });

  it("guarantees a legendary on the LEGENDARY_PITY-th wish", () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 500; i++) {
      expect(rollRarity({ sinceEpic: 0, sinceLegendary: LEGENDARY_PITY - 1 }, rng)).toBe("legendary");
    }
  });
});

describe("rollItem", () => {
  it("returns an item of the requested rarity and never a starter item", () => {
    const rng = mulberry32(11);
    for (const rarity of RARITIES) {
      for (let i = 0; i < 500; i++) {
        const item = rollItem(rarity, [], rng);
        expect(item.rarity).toBe(rarity);
        expect(item.starter).toBeFalsy();
      }
    }
  });

  it("prefers items the player does not own yet", () => {
    const rng = mulberry32(12);
    const commons = ALL_ITEMS.filter((item) => item.rarity === "common" && !item.starter);
    const owned = commons.slice(0, Math.ceil(commons.length / 2)).map((item) => item.id);
    let fresh = 0;
    const rolls = 5000;
    for (let i = 0; i < rolls; i++) if (!owned.includes(rollItem("common", owned, rng).id)) fresh++;
    // 75% forced-new + 25% × (share of new items in the full pool).
    expect(fresh / rolls).toBeGreaterThan(0.8);
  });

  it("can be narrowed to slots, and ignores a filter nothing matches", () => {
    const rng = mulberry32(13);
    for (let i = 0; i < 200; i++) expect(rollItem("rare", [], rng, ["weapon"]).slot).toBe("weapon");
    expect(rollItem("legendary", [], rng, ["charm"]).id).toBe("greenCheck"); // the only legendary charm
    expect(rollItem("epic", [], rng, []).rarity).toBe("epic"); // empty filter → whole epic pool
  });
});

describe("wish", () => {
  it("cannot be made without enough coins (returns null, nothing changes)", () => {
    const poor = deepFreeze(saveWith({ coins: WISH_COST - 1 }));
    expect(canAfford(poor)).toBe(false);
    expect(wish(poor, mulberry32(1))).toBeNull();
    expect(wish(defaultSave(), mulberry32(1))).toBeNull();

    const almost = saveWith({ coins: WISH_TEN_COST - 1 });
    expect(canAfford(almost, 10)).toBe(false);
    expect(wishMany(almost, 10, mulberry32(1))).toBeNull();
    expect(wishMany(rich(), 0, mulberry32(1))).toBeNull();
    expect(wishMany(rich(), 2.5, mulberry32(1))).toBeNull();
  });

  it("charges the price, grants the item and updates counters (without mutating the input)", () => {
    const save = deepFreeze(saveWith({ coins: WISH_COST }));
    const outcome = wish(save, mulberry32(3))!;
    expect(outcome.result.isNew).toBe(true);
    expect(outcome.save.coins).toBe(0);
    expect(outcome.save.owned).toContain(outcome.result.item.id);
    expect(outcome.save.stats.wishes).toBe(1);
    expect(outcome.save.gacha.totalPulls).toBe(1);
    expect(save.coins).toBe(WISH_COST);
  });

  it("prices bundles of ten at a discount", () => {
    expect(wishCost(1)).toBe(WISH_COST);
    expect(wishCost(10)).toBe(WISH_TEN_COST);
    expect(wishCost(11)).toBe(WISH_TEN_COST + WISH_COST);
    expect(wishCost(20)).toBe(2 * WISH_TEN_COST);

    const outcome = wishMany(saveWith({ coins: WISH_TEN_COST }), 10, mulberry32(4))!;
    expect(outcome.results).toHaveLength(10);
    expect(outcome.save.stats.wishes).toBe(10);
  });

  it("refunds duplicates, never duplicates owned ids, and the coins add up", () => {
    let save = rich();
    const rng = mulberry32(21);
    let refunds = 0;
    let spent = 0;
    const seen = new Set(save.owned);
    for (let i = 0; i < 300; i++) {
      const { save: next, result } = wish(save, rng)!;
      expect(result.isNew).toBe(!seen.has(result.item.id));
      expect(result.refund).toBe(result.isNew ? 0 : RARITY_INFO[result.rarity].dupeRefund);
      expect(result.item.rarity).toBe(result.rarity);
      seen.add(result.item.id);
      refunds += result.refund;
      spent += WISH_COST;
      save = next;
    }
    expect(new Set(save.owned).size).toBe(save.owned.length);
    expect(save.coins).toBe(RICH_COINS - spent + refunds);
    // 300 wishes are plenty to complete the collection thanks to the new-item preference.
    expect(save.owned).toHaveLength(ALL_ITEMS.length);
    for (const id of STARTER_IDS) expect(save.owned.filter((owned) => owned === id)).toHaveLength(1);
  });

  it.each([1, 2, 3])("pity: never more than 9 wishes without epic+ or 39 without legendary (seed %i)", (seed) => {
    let save = rich();
    const rng = mulberry32(seed);
    let streakEpic = 0;
    let streakLegendary = 0;
    let maxEpic = 0;
    let maxLegendary = 0;
    for (let i = 0; i < 400; i++) {
      const outcome = wishMany(save, 10, rng)!;
      for (const { rarity } of outcome.results) {
        streakEpic = rarity === "epic" || rarity === "legendary" ? 0 : streakEpic + 1;
        streakLegendary = rarity === "legendary" ? 0 : streakLegendary + 1;
        maxEpic = Math.max(maxEpic, streakEpic);
        maxLegendary = Math.max(maxLegendary, streakLegendary);
      }
      save = outcome.save;
      expect(save.gacha.sinceEpic).toBe(streakEpic);
      expect(save.gacha.sinceLegendary).toBe(streakLegendary);
    }
    expect(save.gacha.totalPulls).toBe(4000);
    expect(maxEpic).toBeLessThanOrEqual(EPIC_PITY - 1);
    expect(maxLegendary).toBeLessThanOrEqual(LEGENDARY_PITY - 1);
  });
});

describe("odds display", () => {
  it("lists every rarity with percentages adding up to 100", () => {
    const rows = gachaOdds();
    expect(rows.map((row) => row.rarity)).toEqual([...RARITIES]);
    expect(rows.reduce((sum, row) => sum + row.percent, 0)).toBeCloseTo(100);
    expect(GACHA_ODDS_TEXT[0]).toBe("Common 60% · Rare 28% · Epic 10% · Legendary 2%");
  });

  it("pityStatus counts down to each guarantee", () => {
    expect(pityStatus({ sinceEpic: 0, sinceLegendary: 0 })).toEqual({ epicIn: EPIC_PITY, legendaryIn: LEGENDARY_PITY });
    expect(pityStatus({ sinceEpic: EPIC_PITY - 1, sinceLegendary: 20 })).toEqual({ epicIn: 1, legendaryIn: 20 });
    expect(pityStatus({ sinceEpic: 2, sinceLegendary: LEGENDARY_PITY - 1 }).epicIn).toBe(1);
  });
});
