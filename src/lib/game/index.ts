/**
 * Public API of the game-state logic (save store, reducers, gacha, loot,
 * derived stats, checklist export). Everything here is framework-free.
 *
 * Not re-exported on purpose:
 *   - catalog.ts:  import item / monster data from "@/lib/game/catalog".
 *   - useStore.ts: the React hook, from "@/lib/game/useStore", so the canvas
 *                  engine can import this file without pulling in React.
 */
export {
  DEFAULT_NAME,
  MAX_COINS,
  MAX_NAME_LENGTH,
  MAX_PAID_FIXES,
  MAX_XP,
  SAVE_DEBOUNCE_MS,
  SAVE_STORAGE_KEY,
  createSaveStore,
  createStore,
  defaultSave,
  sanitizeLook,
  sanitizeName,
  sanitizeSave,
  sanitizeSettings,
} from "@/lib/game/store";
export type { SaveStorage, SaveStore } from "@/lib/game/store";

export {
  BASE_MAGNET_RADIUS,
  BONUS_HEART_LEVELS,
  HEALTH_MILESTONES,
  HP_PER_BONUS_HEART,
  MAX_LEVEL,
  MAX_SAVED_REPOS,
  emptyProgress,
  getProgress,
  isDungeonCleared,
  levelForXp,
  playerStats,
  remainingFindings,
  repoHealth,
  withRepoProgress,
} from "@/lib/game/progress";
export type { LevelInfo, PlayerStats, RepoHealth } from "@/lib/game/progress";

export {
  addCoins,
  awardItem,
  claimMilestones,
  equipItem,
  grantItem,
  hasCoins,
  isEquipped,
  markCreated,
  recordDefeat,
  recordDungeonCleared,
  resetAll,
  resetRepo,
  setLook,
  setSettings,
  setTheme,
  spendCoins,
  unequip,
} from "@/lib/game/actions";
export type { AwardResult, DefeatResult, MilestoneReward } from "@/lib/game/actions";

export {
  EPIC_PITY,
  GACHA_ODDS_TEXT,
  LEGENDARY_PITY,
  PREFER_NEW_CHANCE,
  WISH_BUNDLE_SIZE,
  WISH_COST,
  WISH_RATES,
  WISH_TEN_COST,
  canAfford,
  gachaOdds,
  pickRarity,
  pityStatus,
  rollItem,
  rollRarity,
  wish,
  wishCost,
  wishMany,
} from "@/lib/game/gacha";
export type { OddsRow, PityCounters, WishManyOutcome, WishOutcome, WishResult } from "@/lib/game/gacha";

export {
  CLEAN_FILE_CHESTS,
  DUNGEON_CHESTS,
  DUNGEON_COINS_PER_FINDING,
  beginnerSlot,
  openChest,
  rollChest,
  worstSeverity,
} from "@/lib/game/loot";
export type { ChestInput, ChestLoot, ChestSource, ChestTier } from "@/lib/game/loot";

export { buildChecklist } from "@/lib/game/checklist";

// What saving code in the Workshop pays and how it moves progress (src/lib/workspace forges, this pays).
export { FIX_COIN_MULTIPLIER, FIX_XP_MULTIPLIER, applyForge, fixCoins, fixXp } from "@/lib/game/forge";
export type { ForgePayout, ForgeResult } from "@/lib/game/forge";

// The Workshop's quests, forge streak and achievements (start reading at quests.ts).
export { QUEST_BOARD_SIZE, QUEST_KIND_LABELS, QUEST_REWARDS } from "@/lib/game/quests";
export type { Quest, QuestKind, QuestProgress, QuestReward, QuestTarget, RepoQuests, WorkshopProgress } from "@/lib/game/quests";
export { questBoard } from "@/lib/game/questsBoard";
export type { BoardView } from "@/lib/game/questsBoard";
export { STREAK_BONUS_CAP, STREAK_BONUS_STEP, streakBonus, workshopOf } from "@/lib/game/questsStreak";
export { newsLine, settleQuests } from "@/lib/game/questsSettle";
export type { QuestNewsItem, SettleResult } from "@/lib/game/questsSettle";
export { ACHIEVEMENTS, ACHIEVEMENT_REWARD } from "@/lib/game/achievements";
export type { Achievement, AchievementIcon, AchievementId } from "@/lib/game/achievements";
