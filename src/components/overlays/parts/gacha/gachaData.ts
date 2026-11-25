/**
 * Small helpers for the Wishing Well screen: collection progress and
 * "how good was this pull". All wishing rules live in src/lib/game/gacha.ts.
 */
import { ALL_ITEMS, RARITIES } from "@/lib/game/catalog";
import type { WishResult } from "@/lib/game";
import type { Rarity } from "@/lib/types";

/** Items the well can give: starter items are never handed out, so they don't count. */
const COLLECTIBLE = ALL_ITEMS.filter((item) => !item.starter);

export interface CollectionProgress {
  owned: number;
  total: number;
  byRarity: { rarity: Rarity; owned: number; total: number }[];
}

/** "23 / 41 collected", overall and per rarity. */
export function collectionProgress(ownedIds: readonly string[]): CollectionProgress {
  const owned = new Set(ownedIds);
  const byRarity = RARITIES.map((rarity) => {
    const items = COLLECTIBLE.filter((item) => item.rarity === rarity);
    return { rarity, owned: items.filter((item) => owned.has(item.id)).length, total: items.length };
  });
  return {
    owned: COLLECTIBLE.filter((item) => owned.has(item.id)).length,
    total: COLLECTIBLE.length,
    byRarity,
  };
}

/** The rarest rarity among the results (decides the well's glow colour and the skip fanfare). */
export function bestRarity(results: readonly WishResult[]): Rarity {
  let best = 0;
  for (const result of results) best = Math.max(best, RARITIES.indexOf(result.rarity));
  return RARITIES[best];
}

/** True for the rarities that get a dramatic pause and a flash when revealed. */
export function isBigRarity(rarity: Rarity): boolean {
  return rarity === "epic" || rarity === "legendary";
}

/** "3 new items! Duplicates gave back +68 coins." */
export function pullSummary(results: readonly WishResult[]): string {
  const fresh = results.filter((result) => result.isNew).length;
  const refund = results.reduce((sum, result) => sum + result.refund, 0);
  const newPart = fresh === 0 ? "No new items this time." : `${fresh} new item${fresh === 1 ? "" : "s"}!`;
  return refund > 0 ? `${newPart} Duplicates gave back +${refund} coins.` : newPart;
}
