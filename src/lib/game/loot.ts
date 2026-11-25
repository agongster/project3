/**
 * Treasure chests: the "good code = rewards" mechanic.
 *
 * Every successfully analyzed file has exactly one chest:
 *   - a CLEAN file (no findings) is a treasure house whose chest quality
 *     depends on the file's quality grade (S best … C). Writing documented,
 *     type-hinted, simple code literally pays.
 *   - a file WITH findings is a dungeon; clearing it drops a chest whose
 *     quality depends on the scariest monster that lived there, plus coins
 *     for every bug squashed.
 *
 * `rollChest` decides what is inside (pure, uses the rng you pass) and
 * `openChest` applies it to the save. They are separate so the UI can roll,
 * show the reveal animation, and then commit.
 */
import { MONSTERS, RARITY_INFO, getItem } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import { addCoins, awardItem } from "@/lib/game/actions";
import { pickRarity, rollItem } from "@/lib/game/gacha";
import { getProgress, withRepoProgress } from "@/lib/game/progress";
import { chance, randInt } from "@/lib/rng";
import type { Rng } from "@/lib/rng";
import type { AnalyzedFile, Grade, ItemSlot, Rarity, SaveData, Severity } from "@/lib/types";

// ───────────────────────────── Tuning ─────────────────────────────

/** What one kind of chest can contain. */
export interface ChestTier {
  /** Coins inside: a random whole number in [min, max]. */
  coins: readonly [min: number, max: number];
  /** 0–1 chance the chest also holds an item. */
  itemChance: number;
  /** If there is an item, the odds of each rarity (weights). */
  rarityWeights: Readonly<Record<Rarity, number>>;
}

/** Clean-file chests, by quality grade. Better code, better treasure. */
export const CLEAN_FILE_CHESTS: Readonly<Record<Grade, ChestTier>> = {
  // Guaranteed epic or better, a 1-in-4 shot at a legendary.
  S: { coins: [40, 60], itemChance: 1, rarityWeights: { common: 0, rare: 0, epic: 75, legendary: 25 } },
  // Guaranteed rare or better, with a real chance at an epic.
  A: { coins: [25, 40], itemChance: 1, rarityWeights: { common: 0, rare: 72, epic: 25, legendary: 3 } },
  // Usually an item, common or rare.
  B: { coins: [15, 25], itemChance: 0.7, rarityWeights: { common: 60, rare: 40, epic: 0, legendary: 0 } },
  // Mostly a pouch of coins; sometimes a common item.
  C: { coins: [8, 15], itemChance: 0.3, rarityWeights: { common: 100, rare: 0, epic: 0, legendary: 0 } },
};

/** Dungeon-clear chests, by the scariest monster that was in the dungeon. Beating a boss deserves loot. */
export const DUNGEON_CHESTS: Readonly<Record<Severity, ChestTier>> = {
  // Rare or better, good epic odds.
  boss: { coins: [30, 45], itemChance: 1, rarityWeights: { common: 0, rare: 55, epic: 35, legendary: 10 } },
  // Always an item, common or rare.
  elite: { coins: [15, 25], itemChance: 1, rarityWeights: { common: 55, rare: 45, epic: 0, legendary: 0 } },
  // Mostly coins; 40% chance of a common item.
  minion: { coins: [8, 14], itemChance: 0.4, rarityWeights: { common: 100, rare: 0, epic: 0, legendary: 0 } },
};

/** Extra coins in a dungeon chest for every finding (monster) the dungeon held. Bigger mess, bigger payout. */
export const DUNGEON_COINS_PER_FINDING = 4;

/** Shown as the reason for a clean file's chest when the analysis gave no highlights. */
const FALLBACK_CLEAN_REASON = "Ruff found nothing to complain about";

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { minion: 0, elite: 1, boss: 2 };

// ───────────────────────────── Types ─────────────────────────────

export type ChestSource = "clean-file" | "dungeon-clear";

export interface ChestInput {
  source: ChestSource;
  file: AnalyzedFile;
  /** The player's owned item ids (`save.owned`), so the roll can favour new items. */
  owned: readonly string[];
}

export interface ChestLoot {
  coins: number;
  item: ItemDef | null;
  /** Rarity of `item` (null when there is no item). */
  rarity: Rarity | null;
  /** True when `item` is not in the collection yet. */
  isNew: boolean;
  /** Coins given instead of a duplicate item (0 when new or no item). */
  refund: number;
  /** The file's quality grade for clean-file chests, null for dungeon chests. */
  grade: Grade | null;
  /** One celebratory line for the reveal, e.g. "Grade S code! An epic reward for potions/brew.py". */
  headline: string;
  /** Why the player earned it (for clean files: what is good about the code). */
  reasons: string[];
}

// ─────────────────────────── Beginner's luck ───────────────────────────

/**
 * Steers early chests toward a new toy, so the first minutes of play feel rewarding:
 *  1. While the player has no weapon besides the starter twig, every chest is
 *     guaranteed to contain an item, and that item is a weapon.
 *  2. After that, while they own no charm, any item a chest drops is a charm.
 *  3. From then on chests are unrestricted (null).
 */
export function beginnerSlot(owned: readonly string[]): ItemSlot | null {
  const items = owned.map((id) => getItem(id));
  if (!items.some((item) => item?.slot === "weapon" && !item.starter)) return "weapon";
  if (!items.some((item) => item?.slot === "charm")) return "charm";
  return null;
}

// ───────────────────────────── Rolling ─────────────────────────────

/** The most dangerous severity among the file's findings ("minion" for a file with none). */
export function worstSeverity(file: AnalyzedFile): Severity {
  return file.findings.reduce<Severity>(
    (worst, finding) => (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[worst] ? finding.severity : worst),
    "minion",
  );
}

/** "an epic", "a legendary", ... */
function withArticle(word: string): string {
  return `${/^[aeiou]/i.test(word) ? "An" : "A"} ${word}`;
}

function rewardPhrase(item: ItemDef | null): string {
  return item ? `${withArticle(RARITY_INFO[item.rarity].label.toLowerCase())} reward` : "A pouch of coins";
}

function dungeonReasons(file: AnalyzedFile): string[] {
  const count = file.findings.length;
  const reasons = [`Squashed ${count} bug${count === 1 ? "" : "s"} in this file`];
  const toughest = file.findings.reduce<AnalyzedFile["findings"][number] | null>(
    (best, finding) => (!best || SEVERITY_RANK[finding.severity] > SEVERITY_RANK[best.severity] ? finding : best),
    null,
  );
  if (toughest) reasons.push(`Toughest foe: ${MONSTERS[toughest.monster]?.name ?? toughest.title}`);
  return reasons;
}

/**
 * Decides what is inside a chest. Pure: the same rng sequence always gives
 * the same loot. Nothing is applied to a save; call `openChest` for that.
 */
export function rollChest(input: ChestInput, rng: Rng): ChestLoot {
  const { source, file, owned } = input;
  const isClean = source === "clean-file";
  const grade: Grade = isClean && file.quality.grade in CLEAN_FILE_CHESTS ? file.quality.grade : "C";
  const tier = isClean ? CLEAN_FILE_CHESTS[grade] : DUNGEON_CHESTS[worstSeverity(file)];

  const findingBonus = isClean ? 0 : file.findings.length * DUNGEON_COINS_PER_FINDING;
  const coins = randInt(rng, tier.coins[0], tier.coins[1]) + findingBonus;

  const steer = beginnerSlot(owned);
  const hasItem = steer === "weapon" || chance(rng, tier.itemChance);
  const item = hasItem ? rollItem(pickRarity(tier.rarityWeights, rng), owned, rng, steer ? [steer] : undefined) : null;
  const isNew = item !== null && !owned.includes(item.id);
  const refund = item && !isNew ? RARITY_INFO[item.rarity].dupeRefund : 0;

  const headline = isClean
    ? `Grade ${grade} code! ${rewardPhrase(item)} for ${file.path}`
    : `Dungeon purified! ${rewardPhrase(item)} for cleaning up ${file.path}`;
  const highlights = file.quality.highlights.length > 0 ? [...file.quality.highlights] : [FALLBACK_CLEAN_REASON];

  return {
    coins,
    item,
    rarity: item ? item.rarity : null,
    isNew,
    refund,
    grade: isClean ? grade : null,
    headline,
    reasons: isClean ? highlights : dungeonReasons(file),
  };
}

// ───────────────────────────── Opening ─────────────────────────────

/**
 * Applies a rolled chest to the save: adds its coins, grants the item (or
 * its duplicate refund), remembers that the chest at `path` in repo `key` is
 * open and counts it in the lifetime stats. Opening the same chest again
 * returns the save unchanged, so a double click can't pay out twice.
 */
export function openChest(save: SaveData, key: string, loot: ChestLoot, path: string): SaveData {
  const progress = getProgress(save, key);
  if (progress.opened.includes(path)) return save;

  let next = addCoins(save, loot.coins);
  if (loot.item) next = awardItem(next, loot.item).save;
  next = withRepoProgress(next, key, { ...progress, opened: [...progress.opened, path] });
  return { ...next, stats: { ...next.stats, chestsOpened: next.stats.chestsOpened + 1 } };
}
