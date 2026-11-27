/**
 * Achievements: one-time badges for milestones of editing (first real fix,
 * a file purified by hand, a boss mended instead of fought…) and of the
 * game as a whole (first monster subdued, a dungeon made quiet, wishes…).
 * Badges about fixing need a real fix: a seal (`# noqa`) never earns one.
 *
 * The list is plain data; `ACHIEVEMENT_RULES` says, for each badge, what a
 * save must show to deserve it. Earned badges are stored per player in
 * `SaveData.workshop.achievements` (not per repo) and each pays
 * ACHIEVEMENT_REWARD once. `settleQuests` (questsSettle.ts) checks them after
 * every change, so a badge appears the moment it is deserved — including
 * for things done before achievements existed.
 */
import { getProgress, repoHealth } from "@/lib/game/progress";
import type { MonsterKind, RepoAnalysis, RepoProgress, SaveData } from "@/lib/types";
import { QUEST_BOARD_SIZE } from "./quests";
import type { QuestReward } from "./quests";
import { workshopOf } from "./questsStreak";
import type { WorkshopProgress } from "./questsTypes";

/** What every achievement pays once, when it is earned. */
export const ACHIEVEMENT_REWARD: QuestReward = { coins: 25, xp: 10 };

/** The numbers the "how many" achievements ask for. */
export const ACHIEVEMENT_GOALS = {
  /** Real fixes for "Bug Whisperer". */
  manyFixes: 10,
  /** Clean forges in a row for "On a Roll" and "Steady Hands". */
  shortStreak: 3,
  longStreak: 5,
  /** Quests completed in one repo for "Board Cleared": a whole board's worth. */
  boardQuests: QUEST_BOARD_SIZE,
  /** "Light the lantern" quests for "Lamplighter". */
  lanterns: 3,
  /** Monsters subdued in fights for "Monster Hunter". */
  monsters: 100,
  /** Right fixes picked in the finisher for "Sharp Eye". */
  fixesPicked: 5,
  /** Wishes made for "Well Wisher". */
  wishes: 10,
} as const;

/** A badge's picture: one of the game's existing sprites (drawn by the UI, see src/game/art). */
export type AchievementIcon =
  | { type: "ui"; name: "star" | "checkmark" | "chestOpen" | "chestClosed" | "coinBig" | "xpGem" }
  | { type: "monster"; kind: MonsterKind }
  | { type: "item"; id: string };

export type AchievementId =
  | "first-fix"
  | "many-fixes"
  | "hand-purified"
  | "boss-mended"
  | "top-marks"
  | "short-streak"
  | "long-streak"
  | "first-quest"
  | "board-cleared"
  | "lamplighter"
  | "restored"
  | "first-squash"
  | "monster-hunter"
  | "first-dungeon"
  | "sharp-eye"
  | "well-wisher";

export interface Achievement {
  id: AchievementId;
  title: string;
  /** One line on how it is earned (also the hint under a badge not earned yet). */
  how: string;
  icon: AchievementIcon;
}

/** Every achievement, in the order the gallery shows them: editing first, then the rest of the game. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-fix", title: "First Real Fix", how: "Fix a bug by editing its code.", icon: { type: "item", id: "greenCheck" } },
  { id: "many-fixes", title: "Bug Whisperer", how: `Fix ${ACHIEVEMENT_GOALS.manyFixes} bugs for real.`, icon: { type: "item", id: "rubberDuck" } },
  { id: "hand-purified", title: "Purified by Hand", how: "Fix a file's last bug in the Workshop.", icon: { type: "item", id: "halo" } },
  { id: "boss-mended", title: "Boss Mender", how: "Fix a boss's code before fighting it (ignoring it won't do).", icon: { type: "monster", kind: "glitchKing" } },
  { id: "top-marks", title: "Top Marks", how: "Raise a file to grade S by editing it.", icon: { type: "item", id: "crown" } },
  { id: "short-streak", title: "On a Roll", how: `Save ${ACHIEVEMENT_GOALS.shortStreak} clean fixes in a row.`, icon: { type: "item", id: "refactorHammer" } },
  { id: "long-streak", title: "Steady Hands", how: `Save ${ACHIEVEMENT_GOALS.longStreak} clean fixes in a row.`, icon: { type: "item", id: "goldenDuck" } },
  { id: "first-quest", title: "Quest Taker", how: "Complete your first quest.", icon: { type: "ui", name: "star" } },
  { id: "board-cleared", title: "Board Cleared", how: `Complete ${ACHIEVEMENT_GOALS.boardQuests} quests in one repo.`, icon: { type: "ui", name: "chestOpen" } },
  { id: "lamplighter", title: "Lamplighter", how: `Complete ${ACHIEVEMENT_GOALS.lanterns} "Light the lantern" quests.`, icon: { type: "item", id: "docScarf" } },
  { id: "restored", title: "Kingdom Restored", how: "Bring a repo to 100% health, at least half of it fixed by hand (not ignored).", icon: { type: "item", id: "rainbowTrail" } },
  { id: "first-squash", title: "First Squash", how: "Subdue your first monster in a fight.", icon: { type: "monster", kind: "dustBunny" } },
  { id: "monster-hunter", title: "Monster Hunter", how: `Subdue ${ACHIEVEMENT_GOALS.monsters} monsters in fights.`, icon: { type: "item", id: "bugNet" } },
  { id: "first-dungeon", title: "Dungeon Delver", how: "Quiet a dungeon: subdue every monster in it.", icon: { type: "ui", name: "chestClosed" } },
  { id: "sharp-eye", title: "Sharp Eye", how: `Pick the right fix ${ACHIEVEMENT_GOALS.fixesPicked} times.`, icon: { type: "item", id: "typeBow" } },
  { id: "well-wisher", title: "Well Wisher", how: `Make ${ACHIEVEMENT_GOALS.wishes} wishes at the Wishing Well.`, icon: { type: "ui", name: "coinBig" } },
];

/** Everything the achievement rules look at, gathered from the save and the repo being played. */
export interface AchievementFacts {
  stats: SaveData["stats"];
  workshop: WorkshopProgress;
  /** Quests completed in the repo being played. */
  questsDoneHere: number;
  /** The repo being played is at 100% health, at least half of it fixed by hand. */
  restoredByHand: boolean;
}

/** When each achievement is deserved. */
export const ACHIEVEMENT_RULES: Readonly<Record<AchievementId, (facts: AchievementFacts) => boolean>> = {
  "first-fix": (f) => (f.stats.realFixes ?? 0) >= 1,
  "many-fixes": (f) => (f.stats.realFixes ?? 0) >= ACHIEVEMENT_GOALS.manyFixes,
  "hand-purified": (f) => f.workshop.counts.handPurified >= 1,
  "boss-mended": (f) => f.workshop.counts.bossesMended >= 1,
  "top-marks": (f) => f.workshop.counts.raisedToS >= 1,
  "short-streak": (f) => f.workshop.bestStreak >= ACHIEVEMENT_GOALS.shortStreak,
  "long-streak": (f) => f.workshop.bestStreak >= ACHIEVEMENT_GOALS.longStreak,
  "first-quest": (f) => f.workshop.counts.questsDone >= 1,
  "board-cleared": (f) => f.questsDoneHere >= ACHIEVEMENT_GOALS.boardQuests,
  lamplighter: (f) => f.workshop.counts.lanternsLit >= ACHIEVEMENT_GOALS.lanterns,
  restored: (f) => f.restoredByHand,
  "first-squash": (f) => f.stats.bugsSquashed >= 1,
  "monster-hunter": (f) => f.stats.bugsSquashed >= ACHIEVEMENT_GOALS.monsters,
  "first-dungeon": (f) => f.stats.dungeonsCleared >= 1,
  "sharp-eye": (f) => f.stats.fixesPicked >= ACHIEVEMENT_GOALS.fixesPicked,
  "well-wisher": (f) => f.stats.wishes >= ACHIEVEMENT_GOALS.wishes,
};

/** Achievement ids, for validating a loaded save. */
export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));

/**
 * True when Repo Health is 100% (every bug fixed or sealed) and at least
 * half of all the bugs were really fixed in the code, not sealed.
 */
export function isRestoredByHand(analysis: RepoAnalysis, progress: RepoProgress): boolean {
  const health = repoHealth(analysis, progress);
  return health.fixed > 0 && health.fixed + health.sealed === health.total && health.fixed * 2 >= health.total;
}

/** Gathers the facts for the achievement rules. */
export function achievementFacts(save: SaveData, key: string, analysis: RepoAnalysis): AchievementFacts {
  const progress = getProgress(save, key);
  return {
    stats: save.stats,
    workshop: workshopOf(save),
    questsDoneHere: progress.quests?.done.length ?? 0,
    restoredByHand: isRestoredByHand(analysis, progress),
  };
}

/** The achievements the facts deserve that are not earned yet, in gallery order. */
export function newAchievements(facts: AchievementFacts): Achievement[] {
  const earned = new Set(facts.workshop.achievements);
  return ACHIEVEMENTS.filter((achievement) => !earned.has(achievement.id) && ACHIEVEMENT_RULES[achievement.id](facts));
}

/** Records the newly deserved achievements in the save (each one once). Same save when there are none. */
export function unlockAchievements(save: SaveData, key: string, analysis: RepoAnalysis): { save: SaveData; unlocked: Achievement[] } {
  const unlocked = newAchievements(achievementFacts(save, key, analysis));
  if (unlocked.length === 0) return { save, unlocked };
  const record = workshopOf(save);
  const achievements = [...record.achievements, ...unlocked.map((achievement) => achievement.id)];
  return { save: { ...save, workshop: { ...record, achievements } }, unlocked };
}
