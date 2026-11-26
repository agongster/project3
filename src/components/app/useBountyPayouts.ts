/**
 * Notice-board bounties: whenever a wanted monster is CAPTURED (subdued in a
 * fight, wherever it falls), pay its reward once and celebrate it with a
 * toast. The engine only records the fight in the save; this hook watches
 * the save, like useMilestones does, and `settleBounties` remembers which
 * bounties are paid. (A wanted bug fixed for real in the Workshop before
 * anyone caught it is paid by the forge itself, see forgeFlow.ts; one only
 * sealed closes its notice unpaid.)
 *
 * The first check after the game screen opens pays nothing: a wanted monster
 * that is already subdued by then (a save from before bounties existed) is
 * only marked settled, and its poster simply shows CAPTURED.
 *
 * The bounties are the board's list for this visit to the world: chosen
 * once when it opened, then following the code (`createBountyBoard`).
 */
import { useEffect, useRef } from "react";
import type { AudioApi } from "@/game/bridge";
import type { Feed } from "@/components/hud/feed";
import { createStore, getProgress } from "@/lib/game";
import { chooseBounties, settleBounties, type Bounty } from "@/lib/game/bounties";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";

/**
 * The board's bounties for a visit to the world, chosen from the code as it
 * was when the world opened. They are not chosen again after each edit, so
 * fixing a wanted bug never makes a different notice appear in its place.
 * Files the player has edited (`editedPaths`) are left out, so a bug they
 * wrote themselves never becomes a bounty when the world is loaded again.
 */
export function createBountyBoard(analysis: RepoAnalysis, editedPaths: ReadonlySet<string>): Store<Bounty[]> {
  const untouched = analysis.files.filter((file) => !editedPaths.has(file.path));
  return createStore(chooseBounties({ ...analysis, files: untouched }));
}

export function useBountyPayouts(save: Store<SaveData>, repoKey: string, board: Store<Bounty[]>, feed: Feed, audio: AudioApi): void {
  const bounties = useStore(board, (list) => list);
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
        text: `Wanted monster captured: line ${bounty.line} in ${bounty.folder || "Town Square"}!`,
        detail: bounty.code,
        tone: "good",
        icon: { type: "monster", kind: bounty.monster },
        coins: bounty.reward,
      });
    }
  }, [save, repoKey, bounties, defeated, feed, audio]);
}
