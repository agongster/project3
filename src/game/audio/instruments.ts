/**
 * The four "players" in the chiptune band. The sequencer decides *when* and
 * *which note*; these functions decide *how it sounds*.
 *
 *   lead    pulse wave melody with delayed vibrato (theme picks the wave)
 *   harmony soft, short square plucks playing the arpeggio
 *   bass    triangle wave — the classic NES bass channel
 *   drums   kick / snare / hat, each built from synth layers like a sound effect
 */
import type { ThemeTint } from "./themes";
import { midiToFreq, playLayers, playTone, type Layer, type Wave } from "./synth";

/** Pulse waves sound much louder than a sine at the same gain, so each lead wave gets its own level. */
const LEAD_LEVEL: Record<Wave, number> = {
  pulse25: 0.07,
  pulse12: 0.065,
  square: 0.065,
  sawtooth: 0.05,
  triangle: 0.12,
  sine: 0.13,
};

export function playLead(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, len: number, tint: ThemeTint) {
  const freq = midiToFreq(midi);
  const vol = LEAD_LEVEL[tint.leadWave];
  if (tint.bell) {
    // Music box: instant attack, no sustain, a long exponential ring, plus a faint
    // octave overtone at the start that makes it sound struck rather than blown.
    playTone(ctx, out, t, { wave: tint.leadWave, freq, attack: 0.003, dur: len + 0.6, vol });
    playTone(ctx, out, t, { wave: "sine", freq: freq * 2, attack: 0.003, dur: 0.3, vol: vol * 0.25 });
    return;
  }
  playTone(ctx, out, t, {
    wave: tint.leadWave,
    freq,
    attack: 0.012,
    hold: len * 0.65,
    dur: len * 0.95,
    vol,
    // Only longer notes get vibrato, and it fades in after 0.12 s (like a singer).
    vibrato: len > 0.25 ? { rate: tint.vibratoRate, depth: tint.vibratoDepth, delay: 0.12 } : undefined,
  });
}

export function playHarmony(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, len: number) {
  const pluck = Math.min(len, 0.35);
  playTone(ctx, out, t, { wave: "square", freq: midiToFreq(midi), attack: 0.004, hold: pluck * 0.3, dur: pluck * 0.9 + 0.05, vol: 0.035 });
}

export function playBass(ctx: BaseAudioContext, out: AudioNode, t: number, midi: number, len: number) {
  playTone(ctx, out, t, { wave: "triangle", freq: midiToFreq(midi), attack: 0.006, hold: len * 0.7, dur: len * 0.92, vol: 0.2 });
}

/** K = kick, S = snare, H = hi-hat. Used as letters in the drum patterns ("K . H . S . H ."). */
export type DrumName = "K" | "S" | "H";

export const DRUM_KIT: Record<DrumName, Layer[]> = {
  // Kick: a sine that dives from 150 Hz to 48 Hz — a soft "boomp".
  K: [{ kind: "tone", wave: "sine", freq: 150, to: 48, slide: 0.1, dur: 0.16, vol: 0.22 }],
  // Snare: band-passed noise + a short triangle "body".
  S: [
    { kind: "noise", filter: "bandpass", freq: 1800, q: 0.9, dur: 0.12, vol: 0.12 },
    { kind: "tone", wave: "triangle", freq: 220, to: 160, dur: 0.06, vol: 0.08 },
  ],
  // Hi-hat: a tiny tick of high-passed noise.
  H: [{ kind: "noise", filter: "highpass", freq: 7000, dur: 0.035, vol: 0.05 }],
};

export function playDrum(ctx: BaseAudioContext, out: AudioNode, t: number, name: DrumName) {
  playLayers(ctx, out, t, DRUM_KIT[name]);
}
