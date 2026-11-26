/**
 * Bookkeeping when a monster (= a finding) is defeated, for the monster
 * code to call once per kill:
 *
 *   recordFindingDefeated(ctx, finding, coinsDropped, criticalFix)
 *
 * It records the defeat in the save (XP, bugs squashed) and tells the UI
 * about it with a `squashed` event, plus a `levelUp` event when the XP
 * crossed a level. A critical fix (the right pick in the finisher) also
 * pays its bonus XP and counts in `stats.fixesPicked`, in the same save
 * update, so the level-up check sees all of the XP at once. The UI plays
 * the sounds for those events and pays the Repo Health milestones
 * (src/components/app/useMilestones.ts), so nothing is announced twice.
 * Dropping the coins themselves is the caller's job (`ctx.spawnCoins`), so
 * it can pop them out of the monster's body.
 */
import { levelForXp, recordDefeat } from "@/lib/game";
import { recordCriticalFix } from "@/lib/game/finisher";
import type { Finding } from "@/lib/types";
import type { SceneContext } from "./context";

export function recordFindingDefeated(ctx: SceneContext, finding: Finding, coinsDropped: number, criticalFix = false): void {
  let leveledUp: { level: number; title: string } | null = null;
  ctx.save.set((save) => {
    const defeated = recordDefeat(save, ctx.repoKey, finding).save;
    // Only a first defeat earns the bonus (recordDefeat ignores repeats, so must we).
    const next = criticalFix && defeated !== save ? recordCriticalFix(defeated, finding) : defeated;
    const before = levelForXp(save.xp);
    const after = levelForXp(next.xp);
    leveledUp = after.level > before.level ? { level: after.level, title: after.title } : null;
    return next;
  });
  ctx.emit({ type: "squashed", finding, coins: coinsDropped });
  if (leveledUp) {
    const { level, title } = leveledUp;
    ctx.emit({ type: "levelUp", level, title });
  }
}
