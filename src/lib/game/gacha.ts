/**
 * The Wishing Well (gacha): toss coins in, get a random item back.
 *
 * Two layers of randomness, rolled one after the other:
 *   1. rarity  (`rollRarity`): base odds from WISH_RATES, bent by the pity counters
 *   2. item    (`rollItem`):   one item of that rarity, preferring ones you don't own yet
 *
 * PITY, in plain words. The save keeps two counters in `save.gacha`:
 *   - sinceEpic:      wishes in a row that gave neither an epic nor a legendary
 *   - sinceLegendary: wishes in a row that gave no legendary
 * A counter resets to 0 when its kind of item drops and goes up by one
 * otherwise. If the wish about to be made would be the EPIC_PITY-th in a row
 * without an epic-or-better, it is guaranteed to be one (the common/rare rows
 * are removed from the table for that wish). Likewise the LEGENDARY_PITY-th
 * wish without a legendary is always a legendary. Bad luck therefore has a
 * hard ceiling, which keeps the well friendly.
 *
 * All randomness comes from the `rng` argument, so tests are reproducible and
 * the UI simply passes `Math.random`.
 */
import { ALL_ITEMS, RARITIES, RARITY_INFO } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import { awardItem, hasCoins, spendCoins } from "@/lib/game/actions";
import { chance, pick, weightedIndex } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import type { ItemSlot, Rarity, SaveData } from "@/lib/types";

// ───────────────────────────── Tuning ─────────────────────────────

/** Price of one wish, in coins. */
export const WISH_COST = 30;

/** Price of a bundle of ten wishes: one wish free compared with 10 × WISH_COST. */
export const WISH_TEN_COST = 270;

/** How many wishes the bundle price covers. */
export const WISH_BUNDLE_SIZE = 10;

/** Base odds of each rarity (weights; they add up to 100 so they read as percentages). */
export const WISH_RATES: Readonly<Record<Rarity, number>> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};

/** The EPIC_PITY-th wish in a row without an epic-or-better is guaranteed to be one. */
export const EPIC_PITY = 10;

/** The LEGENDARY_PITY-th wish in a row without a legendary is guaranteed to be one. */
export const LEGENDARY_PITY = 40;

/**
 * Chance that an item roll is drawn only from items the player doesn't own
 * yet (when any are left at that rarity). Otherwise it is drawn from every
 * item of that rarity, which may *also* land on a new one, so the real chance
 * of something new is a bit higher. This makes the collection actually fill
 * up instead of handing out the same duplicate over and over.
 */
export const PREFER_NEW_CHANCE = 0.75;

/** The rates used for a pity-guaranteed epic-or-better wish: same epic : legendary ratio, no commons/rares. */
const EPIC_OR_BETTER_RATES: Readonly<Record<Rarity, number>> = {
  common: 0,
  rare: 0,
  epic: WISH_RATES.epic,
  legendary: WISH_RATES.legendary,
};

/** Starter items are never handed out again. */
const DROPPABLE_ITEMS: readonly ItemDef[] = ALL_ITEMS.filter((item) => !item.starter);

// ───────────────────────────── Types ─────────────────────────────

export type PityCounters = Pick<SaveData["gacha"], "sinceEpic" | "sinceLegendary">;

export interface WishResult {
  item: ItemDef;
  rarity: Rarity;
  /** True the first time the player gets this item. */
  isNew: boolean;
  /** Coins given back for a duplicate (0 when new). */
  refund: number;
}

export interface WishOutcome {
  save: SaveData;
  result: WishResult;
}

export interface WishManyOutcome {
  save: SaveData;
  /** One result per wish, in the order they were made. */
  results: WishResult[];
}

// ───────────────────────────── Rolls ─────────────────────────────

/** Picks a rarity from a table of weights (shared with loot.ts). */
export function pickRarity(weights: Readonly<Record<Rarity, number>>, rng: Rng): Rarity {
  return RARITIES[weightedIndex(rng, RARITIES.map((rarity) => weights[rarity]))];
}

/** Rolls the rarity of the next wish, honouring the pity guarantees (see the top of this file). */
export function rollRarity(pity: PityCounters, rng: Rng): Rarity {
  if (pity.sinceLegendary + 1 >= LEGENDARY_PITY) return "legendary";
  if (pity.sinceEpic + 1 >= EPIC_PITY) return pickRarity(EPIC_OR_BETTER_RATES, rng);
  return pickRarity(WISH_RATES, rng);
}

/**
 * Picks one droppable (non-starter) item of `rarity`, preferring items not in
 * `owned` (see PREFER_NEW_CHANCE). `slots` optionally narrows the pool, e.g.
 * to give a beginner a weapon; it is ignored if no item of that rarity fits.
 */
export function rollItem(rarity: Rarity, owned: readonly string[], rng: Rng, slots?: readonly ItemSlot[]): ItemDef {
  const ofRarity = DROPPABLE_ITEMS.filter((item) => item.rarity === rarity);
  const inSlots = slots ? ofRarity.filter((item) => slots.includes(item.slot)) : ofRarity;
  const pool = inSlots.length > 0 ? inSlots : ofRarity.length > 0 ? ofRarity : DROPPABLE_ITEMS;

  const ownedIds = new Set(owned);
  const unowned = pool.filter((item) => !ownedIds.has(item.id));
  if (unowned.length > 0 && chance(rng, PREFER_NEW_CHANCE)) return pick(rng, unowned);
  return pick(rng, pool);
}

/** Moves the pity counters forward after a wish that produced `rarity`. */
function advanceCounters(gacha: SaveData["gacha"], rarity: Rarity): SaveData["gacha"] {
  const legendary = rarity === "legendary";
  const epicOrBetter = legendary || rarity === "epic";
  return {
    totalPulls: gacha.totalPulls + 1,
    sinceEpic: epicOrBetter ? 0 : gacha.sinceEpic + 1,
    sinceLegendary: legendary ? 0 : gacha.sinceLegendary + 1,
  };
}

/** One already-paid-for wish: roll, award the item (or its refund) and update the counters. */
function wishOnce(save: SaveData, rng: Rng): WishOutcome {
  const rarity = rollRarity(save.gacha, rng);
  const item = rollItem(rarity, save.owned, rng);
  const awarded = awardItem(save, item);
  const next: SaveData = {
    ...awarded.save,
    gacha: advanceCounters(save.gacha, rarity),
    stats: { ...awarded.save.stats, wishes: awarded.save.stats.wishes + 1 },
  };
  return { save: next, result: { item, rarity, isNew: awarded.isNew, refund: awarded.refund } };
}

// ───────────────────────────── Wishing ─────────────────────────────

/** Coins needed for `count` wishes: every full set of ten costs WISH_TEN_COST, the rest WISH_COST each. */
export function wishCost(count: number): number {
  const bundles = Math.floor(count / WISH_BUNDLE_SIZE);
  return bundles * WISH_TEN_COST + (count - bundles * WISH_BUNDLE_SIZE) * WISH_COST;
}

/** True when the player can pay for `count` wishes (default 1). */
export function canAfford(save: SaveData, count = 1): boolean {
  return Number.isInteger(count) && count >= 1 && hasCoins(save, wishCost(count));
}

/**
 * Makes `count` wishes at once, paying `wishCost(count)` up front. Returns
 * null, without changing anything, when the player can't afford it or count
 * is not a positive whole number; check `canAfford` first to grey out the button.
 * Later wishes in the batch already know about items won earlier in it.
 */
export function wishMany(save: SaveData, count: number, rng: Rng): WishManyOutcome | null {
  if (!canAfford(save, count)) return null;
  const paid = spendCoins(save, wishCost(count));
  if (!paid) return null;

  let current = paid;
  const results: WishResult[] = [];
  for (let i = 0; i < count; i++) {
    const outcome = wishOnce(current, rng);
    current = outcome.save;
    results.push(outcome.result);
  }
  return { save: current, results };
}

/** Makes one wish for WISH_COST coins. Returns null when the player can't afford it (see `canAfford`). */
export function wish(save: SaveData, rng: Rng): WishOutcome | null {
  const outcome = wishMany(save, 1, rng);
  return outcome && { save: outcome.save, result: outcome.results[0] };
}

// ───────────────────────────── Display ─────────────────────────────

export interface OddsRow {
  rarity: Rarity;
  label: string;
  color: string;
  /** Base chance per wish, in percent (rounded to one decimal). */
  percent: number;
  /** Coins refunded when this rarity is a duplicate. */
  dupeRefund: number;
}

/** The odds table shown next to the well (players like to know the rates). */
export function gachaOdds(): OddsRow[] {
  const totalWeight = RARITIES.reduce((sum, rarity) => sum + WISH_RATES[rarity], 0);
  return RARITIES.map((rarity) => ({
    rarity,
    label: RARITY_INFO[rarity].label,
    color: RARITY_INFO[rarity].color,
    // Multiply before dividing and round, so 28 shows as "28" and not "28.000000000000004".
    percent: Math.round((WISH_RATES[rarity] * 1000) / totalWeight) / 10,
    dupeRefund: RARITY_INFO[rarity].dupeRefund,
  }));
}

/** The same rules as short sentences, ready to print under the odds table. */
export const GACHA_ODDS_TEXT: readonly string[] = [
  gachaOdds()
    .map((row) => `${row.label} ${row.percent}%`)
    .join(" · "),
  `An Epic or better is guaranteed at least once every ${EPIC_PITY} wishes.`,
  `A Legendary is guaranteed at least once every ${LEGENDARY_PITY} wishes.`,
  `Duplicates turn back into coins (${gachaOdds()
    .map((row) => row.dupeRefund)
    .join(" / ")}).`,
  `${WISH_BUNDLE_SIZE} wishes cost ${WISH_TEN_COST} coins instead of ${WISH_BUNDLE_SIZE * WISH_COST}.`,
];

/**
 * How many wishes until each guarantee kicks in, for a "Epic+ in 3 wishes!"
 * hint. 1 means the very next wish is guaranteed. (A guaranteed legendary
 * is also an epic-or-better, hence the `min`.)
 */
export function pityStatus(pity: PityCounters): { epicIn: number; legendaryIn: number } {
  const legendaryIn = Math.max(1, LEGENDARY_PITY - pity.sinceLegendary);
  return {
    epicIn: Math.min(legendaryIn, Math.max(1, EPIC_PITY - pity.sinceEpic)),
    legendaryIn,
  };
}
