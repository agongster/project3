/**
 * Theme "tints": the same song, coloured to match the scenery.
 *
 * Changing theme never changes the track — the sequencer simply reads these
 * numbers every time it schedules a note, so a new tint takes effect within a
 * fraction of a second (and the filter / echo glide smoothly).
 */
import type { ThemeId } from "@/lib/types";
import type { Wave } from "./synth";

export interface ThemeTint {
  /** Multiplies the song's tempo (0.9 = 10 % slower). */
  tempo: number;
  /** Shifts every voice by this many semitones. */
  transpose: number;
  /** Extra octaves for the lead only (night = −1: lower and mellower). */
  leadOctave: number;
  /** Oscillator shape of the lead melody. */
  leadWave: Wave;
  /** true = lead notes ring and fade like a music box instead of sustaining. */
  bell: boolean;
  /** Lead vibrato speed (Hz) and depth (cents; 100 = one semitone). */
  vibratoRate: number;
  vibratoDepth: number;
  /** Low-pass cutoff on the melodic voices (Hz): lower = softer, warmer. */
  cutoff: number;
  /** Echo amount 0–1 (an "airy" tempo-synced delay). */
  echo: number;
  /** How late off-beat 8th notes land, as a fraction of a step (0 = straight, 0.33 = triplet swing). */
  swing: number;
  /** Nudge lead notes onto the song's 5-note (pentatonic) scale. */
  pentatonic: boolean;
}

export const THEME_TINTS: Record<ThemeId, ThemeTint> = {
  // Sunny default: bright pulse lead, light vibrato.
  meadow: { tempo: 1, transpose: 0, leadOctave: 0, leadWave: "pulse25", bell: false, vibratoRate: 5.5, vibratoDepth: 10, cutoff: 3200, echo: 0.12, swing: 0, pentatonic: false },
  // Softer and airier: hollow square lead, slow vibrato, pentatonic melody, more echo.
  sakura: { tempo: 0.95, transpose: 0, leadOctave: 0, leadWave: "square", bell: false, vibratoRate: 3.5, vibratoDepth: 16, cutoff: 2200, echo: 0.3, swing: 0, pentatonic: true },
  // Warmer and a little slower: lower key, darker filter, a lazy hint of swing.
  autumn: { tempo: 0.93, transpose: -2, leadOctave: 0, leadWave: "pulse25", bell: false, vibratoRate: 4.5, vibratoDepth: 12, cutoff: 2000, echo: 0.15, swing: 0.08, pentatonic: false },
  // Music box: sine lead that rings out like a bell, slower, lots of echo.
  snow: { tempo: 0.86, transpose: 0, leadOctave: 0, leadWave: "sine", bell: true, vibratoRate: 0, vibratoDepth: 0, cutoff: 2800, echo: 0.35, swing: 0, pentatonic: false },
  // Brighter and bouncier: up a tone, open filter, swung rhythm.
  beach: { tempo: 1.05, transpose: 2, leadOctave: 0, leadWave: "pulse25", bell: false, vibratoRate: 6, vibratoDepth: 10, cutoff: 5200, echo: 0.1, swing: 0.3, pentatonic: false },
  // An octave lower, slower and mellow: soft triangle lead, dark filter.
  night: { tempo: 0.84, transpose: 0, leadOctave: -1, leadWave: "triangle", bell: false, vibratoRate: 4, vibratoDepth: 14, cutoff: 1500, echo: 0.25, swing: 0, pentatonic: false },
};

export function getTint(theme: ThemeId): ThemeTint {
  return THEME_TINTS[theme] ?? THEME_TINTS.meadow;
}
