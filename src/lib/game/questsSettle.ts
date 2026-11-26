/**
 * `settleQuests`: the one reducer the game calls for quests, the forge
 * streak and achievements.
 *
 *   when a repo is opened:    settleQuests(save, key, analysis, null)
 *     (posts its first quest board, so the quests the panel shows are the
 *      ones saved before the first forge)
 *
 *   after a forge:            const before = save;
 *                             save = applyForge(save, key, report).save;     // pays the fix itself (forge.ts)
 *                             settleQuests(save, key, workspace.analysis.get(), report, getProgress(before, key).defeated)
 *     (applyForge first, so "First Real Fix" sees the fix it counted; the
 *      last argument is the monsters fought *before* the forge, which
 *      applyForge forgets for fixed bugs: it tells a boss fixed before anyone
 *      fought it apart from one fought first. Without it, every fixed boss
 *      counts as unfought, the generous mistake.)
 *
 *   after any other change:   settleQuests(save, key, analysis, null)
 *     (a monster defeated, a chest opened, a wish…: fighting moves the
 *      "squash monsters" chore and several achievements)
 *
 * It runs three steps, each deciding only what it is owed:
 *   1. the forge report → the streak and the lifetime editing counts
 *   2. the quest board  → completed quests come off, the board refills
 *   3. achievements     → badges the save now deserves
 * and then pays everything in one go. It returns the new save and a
 * plain-data list of what just happened, for the UI to announce.
 *
 * It is idempotent: called twice with the same inputs, the second call finds
 * nothing to do and returns the very same save. Each quest pays once, each
 * badge once, and a forge report already counted is not counted again.
 */
import { MAX_XP } from "@/lib/game/store";
import { addCoins } from "@/lib/game/actions";
import { getProgress, levelForXp, withRepoProgress } from "@/lib/game/progress";
import type { RepoAnalysis, SaveData } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";
import { ACHIEVEMENT_REWARD, unlockAchievements } from "./achievements";
import type { Achievement } from "./achievements";
import type { Quest, QuestReward } from "./quests";
import { updateBoard } from "./questsBoard";
import { describeCompleted } from "./questsCheck";
import { recordForge, workshopOf } from "./questsStreak";
import type { StreakChange } from "./questsStreak";

/** One thing that just happened, for the UI to announce. */
export type QuestNewsItem =
  | { type: "quest"; quest: Quest }
  | StreakChange
  | { type: "achievement"; achievement: Achievement; reward: QuestReward }
  | { type: "levelUp"; level: number; title: string };

export interface SettleResult {
  save: SaveData;
  /** In order: the streak, completed quests, new achievements, then a level-up if any. */
  news: QuestNewsItem[];
  /** Totals paid by this call (already in `save`). */
  coins: number;
  xp: number;
}

/**
 * One plain-text line per piece of news ("Quest complete: Document read_order()
 * in bakery/orders.py"), e.g. for the Workshop's forge summary. Null for news
 * not worth a line of its own (the first clean forge of a streak).
 */
export function newsLine(item: QuestNewsItem): string | null {
  switch (item.type) {
    case "quest":
      return `Quest complete: ${item.quest.title}`;
    case "streak":
      return item.streak >= 2 ? `Clean forge ×${item.streak}! +${item.reward.coins} bonus coins` : null;
    case "streakLost":
      return `Streak of ${item.streak} reset: a new bug appeared (no other penalty)`;
    case "achievement":
      return `Achievement unlocked: ${item.achievement.title}`;
    case "levelUp":
      return `Level up! Level ${item.level}: ${item.title}`;
  }
}

/** Adds a reward's coins (clamped like every other payout) and XP (clamped to MAX_XP). */
export function payReward(save: SaveData, reward: QuestReward): SaveData {
  const withCoins = addCoins(save, reward.coins);
  const xp = Math.min(MAX_XP, withCoins.xp + Math.max(0, Math.round(reward.xp)));
  return xp === withCoins.xp ? withCoins : { ...withCoins, xp };
}

/** The reward a piece of news carries (zero for news that pays nothing). */
function rewardOf(item: QuestNewsItem): QuestReward {
  if (item.type === "quest") return item.quest.reward;
  if (item.type === "streak" || item.type === "achievement") return item.reward;
  return { coins: 0, xp: 0 };
}

/** Step 1: counts the forge (once) into the streak and the lifetime editing counts. */
function settleForge(save: SaveData, report: ForgeReport | null, fought: readonly string[]): { save: SaveData; news: QuestNewsItem[] } {
  if (!report) return { save, news: [] };
  const before = workshopOf(save);
  const { record, change } = recordForge(before, report, new Set(fought));
  if (record === before) return { save, news: [] };
  return { save: { ...save, workshop: record }, news: change ? [change] : [] };
}

/** Step 2: takes completed quests off the board (counting them) and refills it. */
function settleBoard(save: SaveData, key: string, analysis: RepoAnalysis): { save: SaveData; news: QuestNewsItem[] } {
  const progress = getProgress(save, key);
  const { quests, completed } = updateBoard(progress.quests, analysis, progress);
  if (quests === progress.quests) return { save, news: [] };

  let next = withRepoProgress(save, key, { ...progress, quests });
  if (completed.length > 0) {
    const record = workshopOf(next);
    const lanterns = completed.filter((spec) => spec.kind === "document").length;
    const counts = { ...record.counts, questsDone: record.counts.questsDone + completed.length, lanternsLit: record.counts.lanternsLit + lanterns };
    next = { ...next, workshop: { ...record, counts } };
  }
  return { save: next, news: completed.map((spec) => ({ type: "quest", quest: describeCompleted(spec) })) };
}

/** Step 3: records the achievements the save now deserves. */
function settleAchievements(save: SaveData, key: string, analysis: RepoAnalysis): { save: SaveData; news: QuestNewsItem[] } {
  const { save: next, unlocked } = unlockAchievements(save, key, analysis);
  return { save: next, news: unlocked.map((achievement) => ({ type: "achievement", achievement, reward: ACHIEVEMENT_REWARD })) };
}

/**
 * Applies a forge report (or, with `null`, any other change) to quests, the
 * streak and achievements, and pays what they earned. `foughtBeforeForge`:
 * the repo's defeated finding ids from before `applyForge` (see the file
 * comment); it defaults to the ones in `save`.
 */
export function settleQuests(
  save: SaveData,
  key: string,
  analysis: RepoAnalysis,
  report: ForgeReport | null,
  foughtBeforeForge: readonly string[] = getProgress(save, key).defeated,
): SettleResult {
  const forged = settleForge(save, report, foughtBeforeForge);
  const boarded = settleBoard(forged.save, key, analysis);
  const badged = settleAchievements(boarded.save, key, analysis);
  const news = [...forged.news, ...boarded.news, ...badged.news];

  const coins = news.reduce((sum, item) => sum + rewardOf(item).coins, 0);
  const xp = news.reduce((sum, item) => sum + rewardOf(item).xp, 0);
  const paid = payReward(badged.save, { coins, xp });

  const levelBefore = levelForXp(save.xp);
  const levelAfter = levelForXp(paid.xp);
  if (levelAfter.level > levelBefore.level) news.push({ type: "levelUp", level: levelAfter.level, title: levelAfter.title });
  return { save: paid, news, coins: paid.coins - badged.save.coins, xp: paid.xp - badged.save.xp };
}
