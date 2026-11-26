/**
 * Quests, the forge streak and achievements outside the Workshop: when the
 * world opens (so the quest board is saved before the first forge) and
 * whenever the game moves this repo's progress or the lifetime stats (a
 * monster defeated, a chest opened, a wish…), `settleQuests` runs with no
 * forge report and pays whatever is now earned. Forges settle their own
 * quests (forgeFlow.ts); this then finds nothing more to do, because
 * `settleQuests` is idempotent.
 *
 * What it pays is announced as the game's usual small toasts (questToasts.ts).
 * Like useMilestones, it watches the save and writes it back from an effect.
 */
import { useEffect } from "react";
import type { AudioApi } from "@/game/bridge";
import type { Feed } from "@/components/hud/feed";
import { getProgress, settleQuests } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { RepoAnalysis, SaveData, Store } from "@/lib/types";
import { questToast } from "./questToasts";

/** @param analysis the live analysis (the code as it is now) */
export function useQuestSettling(save: Store<SaveData>, repoKey: string, analysis: RepoAnalysis, feed: Feed, audio: AudioApi): void {
  const progress = useStore(save, (s) => getProgress(s, repoKey));
  const stats = useStore(save, (s) => s.stats);

  useEffect(() => {
    const result = settleQuests(save.get(), repoKey, analysis, null);
    if (result.save === save.get()) return;
    save.set(result.save);
    const toasts = result.news.map(questToast).filter((toast) => toast !== null);
    if (toasts.length > 0) audio.sfx("coin");
    for (const toast of toasts) feed.toast(toast);
  }, [save, repoKey, analysis, progress, stats, feed, audio]);
}
