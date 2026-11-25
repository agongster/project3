/**
 * The live audio engine the game uses — implements `AudioApi` from bridge.ts.
 *
 * Browsers only allow sound after a user gesture, so no AudioContext exists
 * until `unlock()`. Every other method is safe to call before then: volumes,
 * theme and the requested music track are remembered and applied on unlock.
 *
 * On the server (Next.js rendering) or in a browser without Web Audio,
 * `createAudio()` returns a silent stand-in with the same methods.
 */
import type { AudioApi, MusicTrack, SfxName } from "@/game/bridge";
import type { ThemeId } from "@/lib/types";
import { AudioCore, type SfxOptions } from "./core";

/** How often the scheduler wakes up (ms). */
const TICK_MS = 25;
/** How far ahead notes are booked (s): see the timing notes in sequencer.ts. */
const LOOK_AHEAD = 0.15;
/** Hidden tabs only run timers about once a second, so book further ahead then. */
const LOOK_AHEAD_HIDDEN = 1.5;

export class WebAudioEngine implements AudioApi {
  private ctx: AudioContext | null = null;
  private core: AudioCore | null = null;
  private wantedTrack: MusicTrack | null = null;
  private theme: ThemeId = "meadow";
  private volumes = { sfx: 1, music: 1 };
  /** performance.now() of the last unlock() call. */
  private unlockedAt = -Infinity;

  constructor(private readonly AudioContextClass: typeof AudioContext) {}

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new this.AudioContextClass({ latencyHint: "interactive" });
      } catch {
        return; // audio hardware unavailable: stay silent
      }
      this.core = new AudioCore(this.ctx);
      this.core.setTheme(this.theme);
      this.core.setVolumes(this.volumes.sfx, this.volumes.music);
      document.addEventListener("visibilitychange", this.onVisibilityChange);
      // The scheduler heartbeat runs for the life of the page (the game never tears audio down).
      setInterval(this.tick, TICK_MS);
    }
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    this.unlockedAt = performance.now();
    this.core?.music(this.wantedTrack);
    this.tick();
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    if (!this.core || !this.ctx) return;
    // While the context is suspended its clock is frozen: sounds booked now would
    // all burst out together on resume, so drop them — except right after
    // unlock(), so the click that enabled audio can still make its own sound.
    const justUnlocked = performance.now() - this.unlockedAt < 250;
    if (this.ctx.state === "running" || justUnlocked) this.core.sfx(name, opts);
  }

  music(track: MusicTrack | null): void {
    this.wantedTrack = track;
    if (!this.core) return; // started by unlock()
    this.core.music(track);
    this.tick();
  }

  setTheme(theme: ThemeId): void {
    this.theme = theme;
    this.core?.setTheme(theme);
  }

  setVolumes(sfx: number, music: number): void {
    this.volumes = { sfx, music };
    this.core?.setVolumes(sfx, music);
  }

  /** For the sound-test page. */
  debugInfo() {
    return {
      state: this.ctx?.state ?? "locked",
      time: this.ctx ? Number(this.ctx.currentTime.toFixed(2)) : 0,
      track: this.wantedTrack,
      activeTracks: this.core?.activePlayers ?? 0,
      theme: this.theme,
    };
  }

  /** The scheduler heartbeat: book upcoming notes on the audio clock. */
  private tick = () => {
    if (!this.ctx || !this.core) return;
    const ahead = document.hidden ? LOOK_AHEAD_HIDDEN : LOOK_AHEAD;
    this.core.update(this.ctx.currentTime + ahead);
  };

  /** Some browsers (iOS Safari) suspend audio in background tabs; wake it when we are back. */
  private onVisibilityChange = () => {
    if (!document.hidden && this.ctx && this.ctx.state !== "running") this.ctx.resume().catch(() => {});
    this.tick();
  };
}

/** Does nothing, safely. Used on the server and where Web Audio is missing. */
const SILENT_AUDIO: AudioApi = {
  unlock() {},
  sfx() {},
  music() {},
  setTheme() {},
  setVolumes() {},
};

/** Creates the game's audio. Safe to call anywhere (server, old browsers). */
export function createAudio(): AudioApi {
  if (typeof window === "undefined") return SILENT_AUDIO;
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new WebAudioEngine(AudioContextClass) : SILENT_AUDIO;
}
