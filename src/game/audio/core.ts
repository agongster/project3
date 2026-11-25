/**
 * AudioCore: the mixer plus the sfx / music logic, for ONE audio context.
 *
 * It does not care whether the context is live (AudioContext, see engine.ts)
 * or offline (OfflineAudioContext, see selftest.ts) — it never touches
 * timers, `window` or the DOM. Someone else calls `update()` regularly.
 *
 * Mixer:
 *
 *   sound effects ──────────→ sfxBus ───┐
 *                                        ├→ master → compressor → soft clipper → speakers
 *   music tracks (SongPlayer) → musicBus ┘
 *
 * - the bus gains are the two volume sliders;
 * - the compressor turns down sudden pile-ups (many sounds at once);
 * - the soft clipper is a last safety net: whatever goes in, the output can
 *   never reach ±1.0, so the speakers never get harsh digital clipping.
 */
import type { MusicTrack, SfxName } from "@/game/bridge";
import type { ThemeId } from "@/lib/types";
import { SFX } from "./sfx";
import { SONGS } from "./songs";
import { compileSong, SongPlayer } from "./sequencer";
import { getTint } from "./themes";
import { playLayers } from "./synth";

/** Seconds for one track to cross-fade into the next. */
export const CROSSFADE_SECONDS = 0.6;
/** The same sound retriggered closer together than this is ignored. */
const RETRIGGER_GAP = 0.025;
/** At most this many sound effects at once, and at most MAX_SAME copies of one sound. */
const MAX_VOICES = 16;
const MAX_SAME = 4;
/** Fixed trims so that at full volume the music sits well below the sound effects. */
const MUSIC_TRIM = 0.45;
const SFX_TRIM = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

/**
 * Transfer curve for the soft clipper (a WaveShaperNode). The input is halved
 * first, so the curve covers real inputs from −2 to +2: below 0.6 the signal
 * passes untouched, above it is bent smoothly (tanh) towards a ceiling of 0.98.
 */
function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2; // −2 … +2
    const a = Math.abs(x);
    const y = a <= 0.6 ? a : 0.6 + 0.38 * Math.tanh((a - 0.6) / 0.38);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

export interface SfxOptions {
  pitch?: number;
  volume?: number;
}

export class AudioCore {
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  private players: SongPlayer[] = []; // the current track + any still fading out
  private current: { track: MusicTrack; player: SongPlayer } | null = null;
  private theme: ThemeId = "meadow";
  private voices: { name: SfxName; end: number }[] = [];
  private lastStart = new Map<SfxName, number>();

  constructor(readonly ctx: BaseAudioContext) {
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    const master = ctx.createGain();

    // Squashes anything above −12 dB at 12:1. Note: Web Audio compressors add
    // automatic "make-up gain" (about ×1.9 with these settings), so quiet sounds
    // come out a little louder than their recipe volumes.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.2;

    const halve = ctx.createGain();
    halve.gain.value = 0.5;
    const clipper = ctx.createWaveShaper();
    clipper.curve = softClipCurve();

    this.sfxBus.connect(master);
    this.musicBus.connect(master);
    master.connect(compressor).connect(halve).connect(clipper).connect(ctx.destination);
    this.sfxBus.gain.value = SFX_TRIM;
    this.musicBus.gain.value = MUSIC_TRIM;
  }

  /** The track that is playing (or fading in), null for silence. */
  get currentTrack(): MusicTrack | null {
    return this.current?.track ?? null;
  }

  /** Number of tracks still producing sound (the current one + any fading out). */
  get activePlayers(): number {
    return this.players.length;
  }

  /**
   * Plays a sound effect at `when` (default: now). Returns false when it was
   * skipped by the retrigger / polyphony limits.
   */
  sfx(name: SfxName, opts: SfxOptions = {}, when = this.ctx.currentTime): boolean {
    const layers = SFX[name];
    if (!layers) return false;

    // 1. The same sound twice within 25 ms sounds like one louder sound — skip it.
    const last = this.lastStart.get(name);
    if (last !== undefined && Math.abs(when - last) < RETRIGGER_GAP) return false;

    // 2. Polyphony: forget voices that have finished, then check the caps.
    this.voices = this.voices.filter((v) => v.end > when);
    if (this.voices.length >= MAX_VOICES) return false;
    if (this.voices.filter((v) => v.name === name).length >= MAX_SAME) return false;

    // 3. A random ±3 % pitch so repeated sounds do not feel robotic.
    const pitch = Number.isFinite(opts.pitch) ? clamp(opts.pitch as number, 0.25, 4) : 1 + (Math.random() * 2 - 1) * 0.03;
    const volume = clamp(opts.volume ?? 1, 0, 2);
    if (volume === 0) return false;

    const end = playLayers(this.ctx, this.sfxBus, when, layers, pitch, volume);
    this.voices.push({ name, end });
    this.lastStart.set(name, when);
    return true;
  }

  /** Cross-fades to `track` (null = fade to silence). Same track again = no-op. */
  music(track: MusicTrack | null, when = this.ctx.currentTime) {
    if (track === this.currentTrack) return;
    this.current?.player.fadeOut(when, CROSSFADE_SECONDS);
    this.current = null;
    if (!track) return;

    const player = new SongPlayer(this.ctx, compileSong(SONGS[track]), this.musicBus, () => getTint(this.theme), when + 0.05);
    player.fadeIn(when, CROSSFADE_SECONDS);
    this.players.push(player);
    this.current = { track, player };
  }

  setTheme(theme: ThemeId) {
    if (theme === this.theme) return;
    this.theme = theme;
    for (const p of this.players) p.applyTint(this.ctx.currentTime);
  }

  /** 0–1 each. Glides over ~20 ms so dragging a slider does not crackle. */
  setVolumes(sfx: number, music: number) {
    const now = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(SFX_TRIM * clamp(sfx, 0, 1), now, 0.02);
    this.musicBus.gain.setTargetAtTime(MUSIC_TRIM * clamp(music, 0, 1), now, 0.02);
  }

  /**
   * Books music notes up to `until` on the audio clock and drops tracks that
   * finished fading out. Returns the number of steps booked.
   */
  update(until: number): number {
    const now = this.ctx.currentTime;
    let booked = 0;
    for (const p of this.players) booked += p.scheduleUntil(until);
    this.players = this.players.filter((p) => {
      if (!p.finished(now)) return true;
      p.dispose();
      return false;
    });
    return booked;
  }

}
