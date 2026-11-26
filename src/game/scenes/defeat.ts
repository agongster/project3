/**
 * Bookkeeping when a monster (= a finding) is defeated, for the monster
 * code to call once per kill:
 *
 *   recordFindingDefeated(ctx, finding, coinsDropped)
 *
 * It records the defeat in the save (XP, bugs squashed) and tells the UI
 * about it with a `squashed` event, plus a `levelUp` event when the XP
 * crossed a level. The UI plays the sounds for those events and pays the
 * Repo Health milestones (src/components/app/useMilestones.ts), so nothing
 * is announced twice. Dropping the coins themselves is the caller's job
 * (`ctx.spawnCoins`), so it can pop them out of the monster's body.
 */
import { recordDefeat } from "@/lib/game";
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
    ctx.emit({ type: "levelUp", level, title });
  }
}
