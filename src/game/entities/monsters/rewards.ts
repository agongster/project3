/**
 * The bookkeeping maths of monsters, kept pure so it is easy to test
 * (tests/engine/monsters.test.ts):
 *
 *  - which monsters to spawn (defeated findings stay gone forever)
 *  - how many coins a defeated monster drops
 *  - how likely it is to drop a heart (much likelier when the hero is hurt)
 */
import type { MonsterDef, PetPerk } from "@/lib/game/catalog";
import type { MonsterSpawn } from "@/lib/types";

/** Usual chance that a defeated monster drops a heart. */
export const HEART_DROP_CHANCE = 0.15;
/** Chance when the hero is low on health — the game helps you out. */
export const LOW_HP_HEART_DROP_CHANCE = 0.6;
/** "Low on health" = this many half-hearts or fewer (two hearts). */
export const LOW_HP_THRESHOLD = 4;
/** A "lucky" pet adds this many extra coins (inclusive range). */
export const LUCKY_BONUS_COINS: readonly [number, number] = [1, 2];

/** The spawns whose finding has not been defeated yet in this repo. */
export function spawnsToCreate(spawns: readonly MonsterSpawn[], defeatedIds: readonly string[]): MonsterSpawn[] {
  const defeated = new Set(defeatedIds);
  return spawns.filter((s) => !defeated.has(s.findingId));
}

/** A whole number in [min, max] (inclusive). */
function rollBetween(min: number, max: number, random: () => number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/**
 * Coins a defeated monster drops, before the combo bonus (`ctx.spawnCoins`
 * applies that): its catalog range, plus the lucky pet's bonus.
 */
export function coinsForDefeat(def: Pick<MonsterDef, "coins">, petPerk: PetPerk | null, random: () => number): number {
  const [min, max] = def.coins;
  const base = rollBetween(min, max, random);
  const lucky = petPerk === "lucky" ? rollBetween(LUCKY_BONUS_COINS[0], LUCKY_BONUS_COINS[1], random) : 0;
  return base + lucky;
}

/** Chance (0–1) that a defeated monster drops a heart, given the hero's current HP in half-hearts. */
export function heartDropChance(heroHp: number): number {
  return heroHp <= LOW_HP_THRESHOLD ? LOW_HP_HEART_DROP_CHANCE : HEART_DROP_CHANCE;
}
