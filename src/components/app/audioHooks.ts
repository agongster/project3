/**
 * React glue for the audio engine.
 *
 * Browsers only allow sound after the player has clicked or pressed a key,
 * so `useAudioSetup` unlocks the audio on the first gesture anywhere on the
 * page, and keeps the volumes and the music's theme tint in sync with the
 * save. `useMusic` lets each screen say which track should be playing.
 */
import { useEffect } from "react";
import type { AudioApi, MusicTrack } from "@/game/bridge";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";

/** Unlocks audio on the first click / key press and mirrors the save's audio settings. */
export function useAudioSetup(save: Store<SaveData>, audio: AudioApi): void {
  const sfxVolume = useStore(save, (s) => s.settings.sfx);
  const musicVolume = useStore(save, (s) => s.settings.music);
  const theme = useStore(save, (s) => s.theme);

  useEffect(() => {
    audio.setVolumes(sfxVolume, musicVolume);
  }, [audio, sfxVolume, musicVolume]);

  useEffect(() => {
    audio.setTheme(theme);
  }, [audio, theme]);

  useEffect(() => {
    const unlock = () => {
      audio.unlock();
      removeListeners();
    };
    const removeListeners = () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    // Capture phase, so the unlock happens even if a component stops the event.
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return removeListeners;
  }, [audio]);
}

/** Cross-fades to `track` while the calling component is on screen. */
export function useMusic(audio: AudioApi, track: MusicTrack | null): void {
  useEffect(() => {
    audio.music(track);
  }, [audio, track]);
}
