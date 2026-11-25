/**
 * The three long-lived objects the whole app shares, created once per browser
 * tab (not once per screen), so the save, the music and the HUD survive
 * moving between the title screen, the loading screen and the game:
 *
 *   save   the persisted save file (localStorage)
 *   audio  the synthesized sound + music engine
 *   hud    live values the canvas engine writes and the HUD reads
 *
 * They are created lazily on the first `getServices()` call, which the App
 * only makes in the browser (never during server rendering).
 */
import { createAudio } from "@/game/audio";
import { INITIAL_HUD, type AudioApi, type HudState } from "@/game/bridge";
import { createSaveStore, createStore, type SaveStore } from "@/lib/game";
import type { Store } from "@/lib/types";

export interface AppServices {
  save: SaveStore;
  audio: AudioApi;
  hud: Store<HudState>;
}

let services: AppServices | null = null;

/** The shared services, created on first use. Browser only. */
export function getServices(): AppServices {
  if (!services) {
    services = {
      save: createSaveStore(),
      audio: createAudio(),
      hud: createStore(INITIAL_HUD),
    };
  }
  return services;
}
