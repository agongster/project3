/**
 * Repo Health milestones: whenever the share of bugs dealt with in the code
 * (fixed or sealed; a fight alone does not count) crosses 25 / 50 / 75 /
 * 100 %, pay the reward once (`claimMilestones` remembers which ones were
 * paid) and celebrate it with a toast.
 */
import { useEffect } from "react";
import type { AudioApi } from "@/game/bridge";
import type { Feed } from "@/components/hud/feed";
import { claimMilestones, type RepoHealth } from "@/lib/game";
import type { SaveData, Store } from "@/lib/types";

const MILESTONE_TEXT: Record<number, string> = {
  25: "A quarter of the land is purified!",
  50: "Half the land is purified!",
  75: "Three quarters of the land is purified!",
  100: "The whole land is purified!",
};

/**
 * @param health the current Repo Health from `repoHealth`
 */
export function useMilestones(save: Store<SaveData>, repoKey: string, health: RepoHealth, feed: Feed, audio: AudioApi): void {
  // A repo without a single bug has nothing to purify (its rewards are the treasure chests),
  // so it never pays milestones just for walking in.
  const ratio = health.total > 0 ? health.ratio : 0;

  useEffect(() => {
    const { save: paid, rewards } = claimMilestones(save.get(), repoKey, ratio);
    if (rewards.length === 0) return;
    save.set(paid);
    audio.sfx("coin");
    for (const reward of rewards) {
      feed.toast({
        text: MILESTONE_TEXT[reward.milestone] ?? `${reward.milestone}% purified!`,
        tone: "good",
        icon: { type: "star" },
        coins: reward.coins,
      });
    }
  }, [save, repoKey, ratio, feed, audio]);
}
