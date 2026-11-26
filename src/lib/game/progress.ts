/**
 * Derived values: things computed *from* the save (and the repo analysis)
 * instead of being stored in it.
 *
 * Keeping these derived means there is one source of truth. Max HP, for
 * example, is never saved: it is recomputed from your level and charms, so
 * re-tuning a charm in catalog.ts instantly applies to every existing save.
 *
 * Also home to the small helpers that read and write one repo's progress
 * inside a save, because "which repo progress do we keep?" is a progress rule.
 */
import { BASE_MAX_HP, LEVEL_TITLES, LEVEL_XP, STARTER_WEAPON, getItem, getWeapon } from "@/lib/game/catalog";
import type { CharmDef, PetPerk, WeaponDef } from "@/lib/game/catalog";
import type { AnalyzedFile, RepoAnalysis, RepoProgress, SaveData } from "@/lib/types";
import { isTrivialInit } from "@/lib/worldgen/regions";

// ───────────────────────────── Tuning ─────────────────────────────

/** Coins closer than this many pixels fly to the player (before charms). About 1.75 tiles. */
export const BASE_MAGNET_RADIUS = 28;

/** Reaching each of these levels permanently adds one heart, so levelling up feels tangible. */
export const BONUS_HEART_LEVELS: readonly number[] = [3, 6, 9];

/** One heart = two half-hearts (HP is counted in half-hearts everywhere). */
export const HP_PER_BONUS_HEART = 2;

/**
 * How many repos' progress a save remembers. Each repo stores every defeated
 * finding id, so without a cap a long-time player's save would keep growing
 * until localStorage ran out of room. The least recently played repo is
 * forgotten first.
 */
export const MAX_SAVED_REPOS = 12;

/**
 * Repo Health milestones: when the share of defeated findings reaches
 * `percent`, the player is paid `coins` once (see `claimMilestones`). The last
 * one is the biggest so finishing a repo feels like a jackpot.
 */
export const HEALTH_MILESTONES: readonly { percent: number; coins: number }[] = [
  { percent: 25, coins: 25 },
  { percent: 50, coins: 50 },
  { percent: 75, coins: 75 },
  { percent: 100, coins: 150 },
];

/** The highest level in LEVEL_XP. */
export const MAX_LEVEL = LEVEL_XP.length;

// ──────────────────────────── Levels ─────────────────────────────

export interface LevelInfo {
  /** 1-based level. */
  level: number;
  title: string;
  /** XP earned since reaching the current level. */
  intoLevel: number;
  /** Total XP this level spans (next threshold − this threshold); 0 at max level. */
  forNext: number;
  /** intoLevel ÷ forNext, for the XP bar (always 1 at max level). */
  ratio: number;
  /** True at the last level, where the XP bar stays full. */
  isMax: boolean;
}

/** Turns a raw XP total into the level, title and XP-bar numbers the UI shows. */
export function levelForXp(xp: number): LevelInfo {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  // LEVEL_XP[i] is the XP needed to *reach* level i + 1, so walk up while we can afford the next one.
  let index = 0;
  while (index + 1 < LEVEL_XP.length && safeXp >= LEVEL_XP[index + 1]) index++;

  const level = index + 1;
  const isMax = level === MAX_LEVEL;
  const floor = LEVEL_XP[index];
  const forNext = isMax ? 0 : LEVEL_XP[index + 1] - floor;
  const intoLevel = safeXp - floor;
  return {
    level,
    title: LEVEL_TITLES[index] ?? LEVEL_TITLES[LEVEL_TITLES.length - 1],
    intoLevel,
    forNext,
    ratio: isMax ? 1 : intoLevel / forNext,
    isMax,
  };
}

// ───────────────────────── Player stats ──────────────────────────

/** Everything the engine needs to know about the player's power, folded from level + equipment. */
export interface PlayerStats {
  /** Half-hearts. */
  maxHp: number;
  /** Multiply the base walk speed by this (1.15 = 15% faster). */
  speedMult: number;
  /** Coins closer than this many pixels fly to the player. */
  magnetRadius: number;
  /** Multiply coins dropped in the world (monsters, bushes, pots) by this. */
  coinMult: number;
  /** Multiply the dash cooldown by this (0.5 = dash twice as often). */
  dashCooldownMult: number;
  /** Heal one half-heart every this many seconds, or null for no regeneration. */
  regenEverySec: number | null;
  /** 0–1 chance that a hit deals double damage. */
  critChance: number;
  /** Damage dealt back to a monster that touches the player (0 = none). */
  thorns: number;
  weapon: WeaponDef;
  /** What the equipped pet does, or null without a pet. */
  petPerk: PetPerk | null;
}

/**
 * Folds the equipped charms into one set of numbers, following the rules in
 * the `CharmEffect` comments in catalog.ts:
 *  - bonuses that are "+X%" or "+X px" are added together,
 *  - the dash cooldown multipliers are multiplied together (two halvings = a quarter),
 *  - regen uses the fastest charm,
 *  - crit chances are added but capped at 100%.
 * Items that are equipped but not owned (a hand-edited save) are ignored.
 */
export function playerStats(save: SaveData): PlayerStats {
  const owned = new Set(save.owned);
  const charms = save.equipped.charms
    .filter((id) => owned.has(id))
    .map((id) => getItem(id))
    .filter((item): item is CharmDef => item?.slot === "charm");

  const level = levelForXp(save.xp).level;
  const levelHearts = BONUS_HEART_LEVELS.filter((needed) => level >= needed).length;

  let maxHp = BASE_MAX_HP + levelHearts * HP_PER_BONUS_HEART;
  let speedMult = 1;
  let magnetRadius = BASE_MAGNET_RADIUS;
  let coinMult = 1;
  let dashCooldownMult = 1;
  let regenEverySec: number | null = null;
  let critChance = 0;
  let thorns = 0;

  for (const charm of charms) {
    switch (charm.effect) {
      case "speed":
        speedMult += charm.value;
        break;
      case "magnet":
        magnetRadius += charm.value;
        break;
      case "maxHp":
        maxHp += charm.value;
        break;
      case "coins":
        coinMult += charm.value;
        break;
      case "dash":
        dashCooldownMult *= charm.value;
        break;
      case "regen":
        regenEverySec = regenEverySec === null ? charm.value : Math.min(regenEverySec, charm.value);
        break;
      case "crit":
        critChance = Math.min(1, critChance + charm.value);
        break;
      case "thorns":
        thorns += charm.value;
        break;
    }
  }

  const weaponId = owned.has(save.equipped.weapon) ? save.equipped.weapon : STARTER_WEAPON;
  const pet = save.equipped.pet && owned.has(save.equipped.pet) ? getItem(save.equipped.pet) : undefined;

  return {
    maxHp,
    speedMult,
    magnetRadius,
    coinMult,
    dashCooldownMult,
    regenEverySec,
    critChance,
    thorns,
    weapon: getWeapon(weaponId),
    petPerk: pet?.slot === "pet" ? pet.perk : null,
  };
}

// ───────────────────────── Repo progress ─────────────────────────

/**
 * Shared, frozen "nothing done yet" progress returned by `getProgress` for
 * repos the player has never touched. Returning the same object every time
 * keeps React selectors stable; freezing it guarantees nobody edits it.
 */
const NO_PROGRESS: RepoProgress = Object.freeze({
  defeated: Object.freeze([]) as unknown as string[],
  cleared: Object.freeze([]) as unknown as string[],
  opened: Object.freeze([]) as unknown as string[],
  milestones: Object.freeze([]) as unknown as number[],
});

/** A fresh, empty progress record (safe to build on). */
export function emptyProgress(): RepoProgress {
  return { defeated: [], cleared: [], opened: [], milestones: [] };
}

/** Progress for one repo key (`owner/repo@sha`), or a shared empty record if the repo was never played. */
export function getProgress(save: SaveData, key: string): RepoProgress {
  return Object.hasOwn(save.repos, key) ? save.repos[key] : NO_PROGRESS;
}

/**
 * Returns a new save with `progress` stored under `key`.
 *
 * The key is (re)inserted at the *end* of `repos`, so the object's key order
 * doubles as "least → most recently played" (JS keeps string keys in
 * insertion order). When there are more than MAX_SAVED_REPOS, the ones at the
 * front, the least recently played, are dropped. No timestamps needed.
 */
export function withRepoProgress(save: SaveData, key: string, progress: RepoProgress): SaveData {
  const others = Object.entries(save.repos).filter(([otherKey]) => otherKey !== key);
  const kept = others.slice(Math.max(0, others.length - (MAX_SAVED_REPOS - 1)));
  return { ...save, repos: Object.fromEntries([...kept, [key, progress]]) };
}

// ────────────────────────── Repo health ──────────────────────────

export interface RepoHealth {
  /** defeated ÷ total, 0–1. A repo with no findings is perfectly healthy (1). */
  ratio: number;
  /** Findings (monsters) defeated. */
  defeated: number;
  /** Findings that exist as monsters (the per-file `overflow` extras are not monsters). */
  total: number;
  dungeonsCleared: number;
  /** Files with at least one finding. */
  dungeonsTotal: number;
  chestsOpened: number;
  /**
   * One chest per building: clean files hold one, dungeons drop one when
   * cleared. A near-empty `__init__.py` is only a lantern, so it has none.
   */
  chestsTotal: number;
}

/** The numbers behind the Repo Health bar and the notice board. */
export function repoHealth(analysis: RepoAnalysis, progress: RepoProgress): RepoHealth {
  const defeatedIds = new Set(progress.defeated);
  const openedPaths = new Set(progress.opened);
  // Failed downloads have no findings and no chest, so they don't count for anything.
  const files = analysis.files.filter((file) => file.status === "ok");

  let total = 0;
  let defeated = 0;
  let dungeonsTotal = 0;
  let dungeonsCleared = 0;
  let chestsOpened = 0;
  for (const file of files) {
    // Only count ids that exist in this analysis, so stale ids can never push health past 100%.
    const beaten = file.findings.filter((finding) => defeatedIds.has(finding.id)).length;
    total += file.findings.length;
    defeated += beaten;
    if (file.findings.length > 0) {
      dungeonsTotal++;
      if (beaten === file.findings.length || progress.cleared.includes(file.path)) dungeonsCleared++;
    }
    if (openedPaths.has(file.path)) chestsOpened++;
  }

  return {
    ratio: total === 0 ? 1 : defeated / total,
    defeated,
    total,
    dungeonsCleared,
    dungeonsTotal,
    chestsOpened,
    chestsTotal: files.filter((file) => !isTrivialInit(file)).length,
  };
}

/** Findings in `file` whose monster is still alive. */
export function remainingFindings(file: AnalyzedFile, progress: RepoProgress): AnalyzedFile["findings"] {
  const defeatedIds = new Set(progress.defeated);
  return file.findings.filter((finding) => !defeatedIds.has(finding.id));
}

/**
 * True once every monster in the file's dungeon is defeated (or the engine
 * already recorded the dungeon as cleared). Files without findings are not
 * dungeons at all, so they return false.
 */
export function isDungeonCleared(file: AnalyzedFile, progress: RepoProgress): boolean {
  if (file.findings.length === 0) return false;
  return progress.cleared.includes(file.path) || remainingFindings(file, progress).length === 0;
}
