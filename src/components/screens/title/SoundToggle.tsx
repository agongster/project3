"use client";

/**
 * Sound on / off. "Off" sets both volumes to 0; "on" restores the volumes
 * the player had before muting (or the defaults if they never had any).
 * The fine-grained sliders live in the pause menu.
 */
import { PixelButton } from "@/components/ui/kit";
import type { AudioApi } from "@/game/bridge";
import { defaultSave, setSettings } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";

/** Volumes from before the last mute, remembered for this browser tab. */
let volumesBeforeMute: { sfx: number; music: number } | null = null;

interface Props {
  save: Store<SaveData>;
  audio: AudioApi;
}

export function SoundToggle({ save, audio }: Props) {
  const sfx = useStore(save, (s) => s.settings.sfx);
  const music = useStore(save, (s) => s.settings.music);
  const muted = sfx === 0 && music === 0;

  const toggle = () => {
    if (muted) {
      const restore = volumesBeforeMute ?? defaultSave().settings;
      save.set((s) => setSettings(s, { sfx: restore.sfx, music: restore.music }));
      audio.sfx("uiSelect");
    } else {
      volumesBeforeMute = { sfx, music };
      save.set((s) => setSettings(s, { sfx: 0, music: 0 }));
    }
  };

  return (
    <PixelButton tone="cream" small onClick={toggle} aria-pressed={!muted} title={muted ? "Turn sound on" : "Turn sound off"}>
      {muted ? "🔇 Sound off" : "🔊 Sound on"}
    </PixelButton>
  );
}
