/**
 * Bookkeeping when a monster (= a finding) is defeated, for the monster
 * code to call once per kill:
 *
 *   recordFindingDefeated(ctx, finding, coinsDropped)
 *
 * It records the defeat in the save (XP, bugs squashed), announces a level
 * up, pays any Repo Health milestone reached (25/50/75/100%) and emits the
 * `squashed` toast. Dropping the coins themselves is the caller's job
 * (`ctx.spawnCoins`), so it can pop them out of the monster's body.
 */
import { claimMilestones, getProgress, recordDefeat, repoHealth, type MilestoneReward } from "@/lib/game";
import type { Finding } from "@/lib/types";
import type { SceneContext } from "./context";

export function recordFindingDefeated(ctx: SceneContext, finding: Finding, coinsDropped: number): void {
  let leveledUp: { level: number; title: string } | null = null;
  ctx.save.set((save) => {
    const result = recordDefeat(save, ctx.repoKey, finding);
    leveledUp = result.leveledUp;
    return result.save;
  });
  ctx.emit({ type: "squashed", finding, coins: coinsDropped });
  if (leveledUp) {
    const { level, title } = leveledUp;
    ctx.audio.sfx("levelUp");
    ctx.emit({ type: "levelUp", level, title });
  }

  const health = repoHealth(ctx.analysis, getProgress(ctx.save.get(), ctx.repoKey));
  let rewards: MilestoneReward[] = [];
  ctx.save.set((save) => {
    const result = claimMilestones(save, ctx.repoKey, health.ratio);
    rewards = result.rewards;
    return result.save;
  });
  for (const r of rewards) ctx.emit({ type: "toast", text: `Repo Health ${r.milestone}%! +${r.coins} coins`, tone: "good" });
}
