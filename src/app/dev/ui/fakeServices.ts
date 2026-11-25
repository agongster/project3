/**
 * Stand-ins for the app's services on the /dev/ui page: an in-memory save
 * (never written to localStorage, so poking around here can't touch your real
 * progress) with a few coins, XP and hats, a real audio engine, and a HUD store.
 */
import { createAudio } from "@/game/audio";
import { INITIAL_HUD, type HudState } from "@/game/bridge";
import type { AppServices } from "@/components/app/services";
import { createSaveStore, createStore, grantItem, type RepoHealth } from "@/lib/game";
import { analyzeDemoSources } from "@/lib/analysis/demo";
import type { RepoAnalysis } from "@/lib/types";

const DEV_COINS = 240;
const DEV_XP = 120;
const DEV_HATS = ["catEars", "wizardHat", "crown"];

export function createDevServices(): AppServices {
  const save = createSaveStore(null);
  save.set((s) => {
    const withHats = DEV_HATS.reduce(grantItem, s);
    return { ...withHats, created: true, coins: DEV_COINS, xp: DEV_XP, equipped: { ...withHats.equipped, hat: "catEars" } };
  });
  return { save, audio: createAudio(), hud: createStore<HudState>(INITIAL_HUD) };
}

/** The demo kingdom without running the linter: every file, no findings. Enough for overlays that only need a repo name. */
export function createDevAnalysis(): RepoAnalysis {
  return analyzeDemoSources(() => []);
}

/** Repo Health numbers for the HUD view. */
export function devHealth(ratio: number): RepoHealth {
  const total = 20;
  return { ratio, defeated: Math.round(ratio * total), total, dungeonsCleared: 2, dungeonsTotal: 8, chestsOpened: 3, chestsTotal: 17 };
}
