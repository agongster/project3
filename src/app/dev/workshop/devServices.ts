/**
 * Stand-ins for the game around the Workshop on /dev/workshop: an in-memory
 * save (never written to localStorage), a lazily created audio engine, and
 * the payout after a forge with the game's own reducer (`applyForge`).
 */
import { createAudio } from "@/game/audio";
import type { AudioApi } from "@/game/bridge";
import type { ForgeRewards } from "@/components/workshop";
import { applyForge, createSaveStore } from "@/lib/game";
import type { SaveData, Store } from "@/lib/types";
import type { ForgeReport } from "@/lib/workspace";

const DEV_COINS = 120;
const DEV_XP = 80;

export function createDevSave(): Store<SaveData> {
  const save = createSaveStore(null);
  save.set((s) => ({ ...s, created: true, coins: DEV_COINS, xp: DEV_XP }));
  return save;
}

let audioEngine: AudioApi | null = null;
function getAudio(): AudioApi {
  if (!audioEngine) audioEngine = createAudio();
  return audioEngine;
}

/** Forwards to the real audio engine, created on first use (never during server rendering). */
export const devAudio: AudioApi = {
  unlock: () => getAudio().unlock(),
  sfx: (name, opts) => getAudio().sfx(name, opts),
  music: (track) => getAudio().music(track),
  setTheme: (theme) => getAudio().setTheme(theme),
  setVolumes: (sfx, music) => getAudio().setVolumes(sfx, music),
};

/** Pays a forge into the dev save, the way the game does, and says what was paid. */
export function devRewards(save: Store<SaveData>, repoKey: string, report: ForgeReport): ForgeRewards {
  const { save: next, paid } = applyForge(save.get(), repoKey, report);
  save.set(next);
  const lines = paid.leveledUp ? [`Level up! You are now a ${paid.leveledUp.title}`] : [];
  return { coins: paid.coins, xp: paid.xp, lines, paidFixes: paid.fixes };
}
