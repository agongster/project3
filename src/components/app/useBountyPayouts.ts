/**
 * Notice-board bounties: whenever a wanted monster is defeated (wherever it
 * dies), pay its reward once and celebrate it with a toast. The engine only
 * records the defeat in the save; this hook watches the save, like
 * useMilestones does, and `settleBounties` remembers which bounties are paid.
 *
 * The first check after the game screen opens pays nothing: a wanted monster
 * that is already defeated by then (a save from before bounties existed) is
 * only marked settled, and its poster simply shows CLAIMED.
 */
import { useEffect, useMemo, useRef } from "react";
import type { AudioApi } from "@/game/bridge";
import type { Feed } from "@/components/hud/feed";
import { getProgress } from "@/lib/game";
import { chooseBounties, settleBounties } from "@/lib/game/bounties";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";

export function useBountyPayouts(save: Store<SaveData>, repoKey: string, analysis: RepoAnalysis, feed: Feed, audio: AudioApi): void {
  const bounties = useMemo(() => chooseBounties(analysis), [analysis]);
  const defeated = useStore(save, (s) => getProgress(s, repoKey).defeated);
  /** False until the first check has run (that one settles old defeats without paying). */
  const watching = useRef(false);

  useEffect(() => {
    const pay = watching.current;
    watching.current = true;
    const { save: settled, paid } = settleBounties(save.get(), repoKey, bounties, pay);
    if (settled === save.get()) return;
    save.set(settled);
    if (paid.length > 0) audio.sfx("coin");
    for (const bounty of paid) {
      feed.toast({
        text: `Bounty claimed: line ${bounty.line} in ${bounty.folder || "Town Square"}!`,
        detail: bounty.code,
        tone: "good",
        icon: { type: "monster", kind: bounty.monster },
        coins: bounty.reward,
      });
    }
  }, [save, repoKey, bounties, defeated, feed, audio]);
}
