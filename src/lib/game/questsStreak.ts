/**
 * The forge streak ("Clean forge ×3") and the lifetime editing counts that
 * achievements read, both updated from a ForgeReport.
 *
 * The report handed in here lists only REAL fixes in `fixed`: findings
 * sealed with `# noqa` are taken out first (`realReport` in seal-aware
 * callers, see src/components/app/forgeFlow.ts), so a seal never extends a
 * streak, mends a boss or purifies a file "by hand".
 *
 *   clean forge   fixed at least one finding and introduced none → streak + 1,
 *                 and from ×2 on a small bonus that grows (capped)
 *   broken forge  introduced a new finding → the streak starts over at 0
 *                 (no other penalty: new bugs are just new monsters)
 *   other forges  changed no finding (a docstring, a comment, a non-Python
 *                 file, saving unchanged text) → the streak stays as it is
 *
 * The reward for the fixes themselves is paid, and counted in
 * `stats.realFixes`, by `applyForge` (src/lib/game/forge.ts); only the
 * streak bonus is paid from here.
 */
import { hashString } from "@/lib/rng";
import type { SaveData } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace/contract";
import type { QuestReward } from "./quests";
import type { WorkshopProgress } from "./questsTypes";

/** Each step of a streak from ×2 on adds this many bonus coins… */
export const STREAK_BONUS_STEP = 5;
/** …up to this many per forge. */
export const STREAK_BONUS_CAP = 25;

/** A brand-new Workshop record. */
export function emptyWorkshop(): WorkshopProgress {
  return {
    streak: 0,
    bestStreak: 0,
    lastForge: "",
    counts: { handPurified: 0, bossesMended: 0, raisedToS: 0, questsDone: 0, lanternsLit: 0 },
    achievements: [],
  };
}

/** The player's Workshop record (an empty one for a save from before the Workshop). */
export function workshopOf(save: SaveData): WorkshopProgress {
  return save.workshop ?? emptyWorkshop();
}

export type ForgeVerdict = "clean" | "broken" | "neutral";

/** What a forge means for the streak (see the table at the top of this file). */
export function forgeVerdict(report: ForgeReport): ForgeVerdict {
  if (!report.linted) return "neutral";
  if (report.introduced.length > 0) return "broken";
  return report.fixed.length > 0 ? "clean" : "neutral";
}

/** Bonus coins for reaching `streak` clean forges in a row: 0 for the first, then 5, 10, 15… up to the cap. */
export function streakBonus(streak: number): number {
  return Math.max(0, Math.min(STREAK_BONUS_CAP, STREAK_BONUS_STEP * (streak - 1)));
}

/**
 * A short tag for a report. Two different forges can't share one (a finding
 * can't be fixed twice in a row), so seeing the same tag again means the
 * same report was handed in twice, and it must not count again.
 */
function forgeFingerprint(report: ForgeReport): string {
  const ids = (findings: ForgeReport["fixed"]) => findings.map((finding) => finding.id).sort().join(",");
  const facts = [report.path, report.before.score, report.after.score, ids(report.fixed), ids(report.introduced)];
  return hashString(facts.join("|")).toString(36);
}

/** What one forge did to the streak, for the news. */
export type StreakChange = { type: "streak"; streak: number; reward: QuestReward } | { type: "streakLost"; streak: number };

/**
 * The Workshop record after `report`, and how the streak changed (null when
 * it did not). `fought` are the finding ids defeated in this repo before the
 * forge: a boss whose code is fixed before it was fought counts as "mended".
 * Returns the very same record for a report it has already counted.
 */
export function recordForge(
  record: WorkshopProgress,
  report: ForgeReport,
  fought: ReadonlySet<string>,
): { record: WorkshopProgress; change: StreakChange | null } {
  const fingerprint = forgeFingerprint(report);
  if (!report.linted || record.lastForge === fingerprint) return { record, change: null };

  const verdict = forgeVerdict(report);
  const streak = verdict === "clean" ? record.streak + 1 : verdict === "broken" ? 0 : record.streak;
  const { counts } = record;
  const next: WorkshopProgress = {
    ...record,
    streak,
    bestStreak: Math.max(record.bestStreak, streak),
    lastForge: fingerprint,
    counts: {
      ...counts,
      handPurified: counts.handPurified + (report.purified && report.fixed.length > 0 ? 1 : 0),
      bossesMended: counts.bossesMended + report.fixed.filter((f) => f.severity === "boss" && !fought.has(f.id)).length,
      raisedToS: counts.raisedToS + (report.before.grade !== "S" && report.after.grade === "S" ? 1 : 0),
    },
  };

  let change: StreakChange | null = null;
  if (verdict === "clean") change = { type: "streak", streak, reward: { coins: streakBonus(streak), xp: 0 } };
  else if (verdict === "broken" && record.streak > 0) change = { type: "streakLost", streak: record.streak };
  return { record: next, change };
}
