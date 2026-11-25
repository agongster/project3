/** Sound choices shared by the reward overlays. */
import type { AudioApi, SfxName } from "@/game/bridge";
import type { Rarity } from "@/lib/types";

/** The fanfare for revealing an item of each rarity. */
export const REVEAL_SFX: Readonly<Record<Rarity, SfxName>> = {
  common: "revealCommon",
  rare: "revealRare",
  epic: "revealEpic",
  legendary: "revealLegendary",
};

/** How much higher the last coin tick of a count-up sounds than the first (rising pitch = excitement). */
const COIN_PITCH_RISE = 0.6;
const COIN_TICK_VOLUME = 0.5;

/** One "ching" of a coin counter; `progress` 0–1 raises the pitch as the count goes up. */
export function playCoinTick(audio: AudioApi, progress: number): void {
  audio.sfx("coin", { pitch: 1 + progress * COIN_PITCH_RISE, volume: COIN_TICK_VOLUME });
}
