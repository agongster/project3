/**
 * Which sound each sim event makes.
 *
 * The catch sound climbs in pitch as the streak grows (a classic "combo"
 * feel), and the little landing "boing" is rate-limited so a coin shower
 * hitting the ground does not turn into a drum roll.
 */
import type { AudioApi } from "@/game/bridge";
import type { SimEvent } from "./sim";

/** Each streak step raises the catch pitch by this much... */
const STREAK_PITCH_STEP = 0.06;
/** ...for at most this many steps (then it stays at the top note). */
const STREAK_PITCH_STEPS = 10;
/** The "boing" of a missed bug: a quiet, high falling blip. */
const BOING_VOLUME = 0.3;
const BOING_PITCH = 1.5;
/** At most one boing per this many seconds. */
const BOING_MIN_GAP = 0.15;

export interface SoundPlayer {
  play(event: SimEvent, time: number): void;
}

export function createSoundPlayer(getAudio: () => AudioApi): SoundPlayer {
  let lastBoingAt = -Infinity;

  return {
    play(event, time) {
      const audio = getAudio();
      switch (event.type) {
        case "go":
          audio.sfx("uiSelect");
          break;
        case "catch": {
          const pitch = 1 + Math.min(event.streak - 1, STREAK_PITCH_STEPS) * STREAK_PITCH_STEP;
          if (event.kind === "coin") audio.sfx("coin", { pitch });
          else if (event.kind === "heart") audio.sfx("heart");
          else audio.sfx("catch", { pitch });
          if (event.golden) audio.sfx("coin", { pitch: 1.25 });
          break;
        }
        case "bounce":
          if (!event.first || time - lastBoingAt < BOING_MIN_GAP) break;
          lastBoingAt = time;
          audio.sfx("uiBack", { volume: BOING_VOLUME, pitch: BOING_PITCH });
          break;
        case "bonus":
          if (event.bonus === "coinShower") audio.sfx("revealRare");
          break;
      }
    },
  };
}
