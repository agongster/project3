/**
 * Reducers: every way the save can change, as plain functions
 * `(save, ...args) => newSave`.
 *
 * Rules every function here follows:
 *  - The input save is never mutated; a changed save is a new object that
 *    shares the untouched parts with the old one.
 *  - When nothing changes, the *same* save object is returned. The store
 *    then skips notifying listeners and React skips re-rendering.
 *  - Invalid requests (equipping an item you don't own, an unknown id, ...)
 *    are ignored by returning the save unchanged, so a UI bug can't corrupt a save.
 *    The one exception is spending coins you don't have: `spendCoins` returns
 *    null so the caller has to handle "too poor" explicitly (gacha.ts does the same).
 *
 * Usage with the store:  saveStore.set((save) => addCoins(save, 5));
 */
import { MAX_CHARMS, MONSTERS, RARITY_INFO, STARTER_WEAPON, THEMES, getItem } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import { HEALTH_MILESTONES, getProgress, levelForXp, withRepoProgress } from "@/lib/game/progress";
import { MAX_COINS, MAX_XP, defaultSave, sanitizeLook, sanitizeSettings } from "@/lib/game/store";
import type { CharacterLook, EquippedItems, Finding, ItemSlot, RepoProgress, SaveData, ThemeId } from "@/lib/types";

/**
 * Floating-point slack when comparing Repo Health to a milestone, so a ratio
 * that should be exactly 75% but is computed as 74.99999999% still counts.
 */
const MILESTONE_EPSILON = 1e-9;

// ───────────────────────────── Coins ─────────────────────────────

/**
 * Adds (or, with a negative amount, removes) coins. Coins are whole numbers,
 * so fractional amounts (e.g. a drop × the Lucky Clover's 1.5) are rounded,
 * and the total never drops below 0 or rises above MAX_COINS.
 */
export function addCoins(save: SaveData, amount: number): SaveData {
  if (!Number.isFinite(amount)) return save;
  const coins = Math.min(MAX_COINS, Math.max(0, save.coins + Math.round(amount)));
  return coins === save.coins ? save : { ...save, coins };
}

/** True when the player has at least `amount` coins. */
export function hasCoins(save: SaveData, amount: number): boolean {
  return save.coins >= Math.round(amount);
}

/**
 * Pays `amount` coins, or returns null when the player can't afford it (or
 * the amount isn't a valid non-negative number). Returning null instead of
 * throwing makes TypeScript force every caller to handle "too poor".
 */
export function spendCoins(save: SaveData, amount: number): SaveData | null {
  if (!Number.isFinite(amount) || amount < 0 || !hasCoins(save, amount)) return null;
  return addCoins(save, -amount);
}

// ───────────────────────────── Items ─────────────────────────────

/** Adds an item to the collection. Unknown ids and items already owned leave the save unchanged. */
export function grantItem(save: SaveData, itemId: string): SaveData {
  if (!getItem(itemId) || save.owned.includes(itemId)) return save;
  return { ...save, owned: [...save.owned, itemId] };
}

export interface AwardResult {
  save: SaveData;
  /** True when the item was new to the collection. */
  isNew: boolean;
  /** Coins paid out instead because it was a duplicate (0 when new). */
  refund: number;
}

/**
 * Gives an item won from the Wishing Well or a chest: new items join the
 * collection, duplicates turn into coins (RARITY_INFO[rarity].dupeRefund) so
 * no reward ever feels wasted.
 */
export function awardItem(save: SaveData, item: ItemDef): AwardResult {
  if (!save.owned.includes(item.id)) return { save: grantItem(save, item.id), isNew: true, refund: 0 };
  const refund = RARITY_INFO[item.rarity].dupeRefund;
  return { save: addCoins(save, refund), isNew: false, refund };
}

/** True when the item is currently worn / wielded. */
export function isEquipped(save: SaveData, itemId: string): boolean {
  const { weapon, hat, pet, trail, charms } = save.equipped;
  return weapon === itemId || hat === itemId || pet === itemId || trail === itemId || charms.includes(itemId);
}

function withEquipped(save: SaveData, equipped: EquippedItems): SaveData {
  return { ...save, equipped };
}

/**
 * Equips an owned item in its slot. The weapon, hat, pet and trail replace
 * whatever was there. Charms *toggle*: equipping a worn charm takes it off,
 * and equipping a new one when MAX_CHARMS are already worn drops the charm
 * that was put on first. Unknown or unowned items are ignored.
 */
export function equipItem(save: SaveData, itemId: string): SaveData {
  const item = getItem(itemId);
  if (!item || !save.owned.includes(itemId)) return save;
  const equipped = save.equipped;

  switch (item.slot) {
    case "weapon":
      return equipped.weapon === itemId ? save : withEquipped(save, { ...equipped, weapon: itemId });
    case "hat":
      return equipped.hat === itemId ? save : withEquipped(save, { ...equipped, hat: itemId });
    case "pet":
      return equipped.pet === itemId ? save : withEquipped(save, { ...equipped, pet: itemId });
    case "trail":
      return equipped.trail === itemId ? save : withEquipped(save, { ...equipped, trail: itemId });
    case "charm": {
      const charms = equipped.charms.includes(itemId)
        ? equipped.charms.filter((id) => id !== itemId)
        : [...equipped.charms, itemId].slice(-MAX_CHARMS);
      return withEquipped(save, { ...equipped, charms });
    }
  }
}

/**
 * Takes an item off. With `itemId`, only that exact item is removed (nothing
 * happens if it isn't the one worn); without it, the whole slot is emptied
 * (for charms: all of them). The weapon slot can never be empty, so
 * "unequipping" a weapon puts the Trusty Twig back in your hand.
 */
export function unequip(save: SaveData, slot: ItemSlot, itemId?: string): SaveData {
  const equipped = save.equipped;
  const matches = (current: string | null) => current !== null && (itemId === undefined || current === itemId);

  switch (slot) {
    case "weapon":
      if (!matches(equipped.weapon) || equipped.weapon === STARTER_WEAPON) return save;
      return withEquipped(save, { ...equipped, weapon: STARTER_WEAPON });
    case "hat":
      return matches(equipped.hat) ? withEquipped(save, { ...equipped, hat: null }) : save;
    case "pet":
      return matches(equipped.pet) ? withEquipped(save, { ...equipped, pet: null }) : save;
    case "trail":
      return matches(equipped.trail) ? withEquipped(save, { ...equipped, trail: null }) : save;
    case "charm": {
      const charms = itemId === undefined ? [] : equipped.charms.filter((id) => id !== itemId);
      return charms.length === equipped.charms.length ? save : withEquipped(save, { ...equipped, charms });
    }
  }
}

// ───────────────────────── Look & settings ─────────────────────────

/** Changes some look fields. Values are cleaned exactly like a loaded save (indices clamped, name tidied). */
export function setLook(save: SaveData, patch: Partial<CharacterLook>): SaveData {
  const look = sanitizeLook({ ...save.look, ...patch }, save.look);
  const unchanged = (Object.keys(look) as (keyof CharacterLook)[]).every((key) => look[key] === save.look[key]);
  return unchanged ? save : { ...save, look };
}

/** Switches the scenery theme. Unknown theme ids are ignored. */
export function setTheme(save: SaveData, theme: ThemeId): SaveData {
  if (theme === save.theme || !THEMES.some((t) => t.id === theme)) return save;
  return { ...save, theme };
}

/** Changes some settings (volumes are clamped into 0–1). */
export function setSettings(save: SaveData, patch: Partial<SaveData["settings"]>): SaveData {
  const settings = sanitizeSettings({ ...save.settings, ...patch }, save.settings);
  const old = save.settings;
  const unchanged =
    settings.sfx === old.sfx && settings.music === old.music && settings.screenShake === old.screenShake;
  return unchanged ? save : { ...save, settings };
}

/** Called when the player finishes the character creator for the first time. */
export function markCreated(save: SaveData): SaveData {
  return save.created ? save : { ...save, created: true };
}

// ─────────────────────────── Repo progress ───────────────────────────

/** Applies `update` to one repo's progress. Returns the same save if `update` returned the same progress. */
function updateProgress(save: SaveData, key: string, update: (progress: RepoProgress) => RepoProgress): SaveData {
  const before = getProgress(save, key);
  const after = update(before);
  return after === before ? save : withRepoProgress(save, key, after);
}

export interface DefeatResult {
  save: SaveData;
  /** Set when this defeat pushed the player to a new level (the level reached and its title). */
  leveledUp: { level: number; title: string } | null;
}

/**
 * Records that a finding's monster was beaten in a fight, i.e. SUBDUED (it
 * is fully defeated only once its code is fixed, see progress.ts):
 * remembers its id, counts the squash and awards the monster's XP.
 * Subduing the same finding again (e.g. after re-entering a dungeon)
 * changes nothing, so XP can't be farmed. Coins are not handled here: the
 * engine drops them as pickups (see `addCoins`).
 */
export function recordDefeat(save: SaveData, key: string, finding: Pick<Finding, "id" | "monster">): DefeatResult {
  const progress = getProgress(save, key);
  if (progress.defeated.includes(finding.id)) return { save, leveledUp: null };

  const xpGain = MONSTERS[finding.monster]?.xp ?? 0;
  const before = levelForXp(save.xp);
  const withDefeat = withRepoProgress(save, key, { ...progress, defeated: [...progress.defeated, finding.id] });
  const next: SaveData = {
    ...withDefeat,
    xp: Math.min(MAX_XP, save.xp + xpGain),
    stats: { ...save.stats, bugsSquashed: save.stats.bugsSquashed + 1 },
  };
  const after = levelForXp(next.xp);
  return {
    save: next,
    leveledUp: after.level > before.level ? { level: after.level, title: after.title } : null,
  };
}

/**
 * Records that a file's dungeon has gone QUIET (its last fighting monster
 * subdued) and counts it once in the lifetime stats (`dungeonsCleared`).
 */
export function recordDungeonQuiet(save: SaveData, key: string, path: string): SaveData {
  const next = updateProgress(save, key, (progress) =>
    progress.cleared.includes(path) ? progress : { ...progress, cleared: [...progress.cleared, path] },
  );
  if (next === save) return save;
  return { ...next, stats: { ...next.stats, dungeonsCleared: next.stats.dungeonsCleared + 1 } };
}

export interface MilestoneReward {
  /** The Repo Health percentage reached (25, 50, 75 or 100). */
  milestone: number;
  coins: number;
}

/**
 * Pays out every Repo Health milestone (HEALTH_MILESTONES) that `healthRatio`
 * (0–1, from `repoHealth`) has reached and that wasn't paid before. Each
 * milestone pays once per repo, so calling this after every defeat is safe.
 */
export function claimMilestones(
  save: SaveData,
  key: string,
  healthRatio: number,
): { save: SaveData; rewards: MilestoneReward[] } {
  const progress = getProgress(save, key);
  const percent = Number.isFinite(healthRatio) ? healthRatio * 100 : 0;
  const rewards = HEALTH_MILESTONES.filter(
    (m) => percent + MILESTONE_EPSILON >= m.percent && !progress.milestones.includes(m.percent),
  ).map((m) => ({ milestone: m.percent, coins: m.coins }));
  if (rewards.length === 0) return { save, rewards };

  const paid = addCoins(
    save,
    rewards.reduce((sum, reward) => sum + reward.coins, 0),
  );
  const milestones = [...progress.milestones, ...rewards.map((reward) => reward.milestone)];
  return { save: withRepoProgress(paid, key, { ...progress, milestones }), rewards };
}

/** Forgets all progress in one repo (monsters respawn, chests refill). Coins, items and lifetime stats stay. */
export function resetRepo(save: SaveData, key: string): SaveData {
  if (!Object.hasOwn(save.repos, key)) return save;
  const repos = Object.fromEntries(Object.entries(save.repos).filter(([otherKey]) => otherKey !== key));
  return { ...save, repos };
}

/** Starts over completely: a brand-new default save. */
export function resetAll(): SaveData {
  return defaultSave();
}
