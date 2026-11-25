/**
 * Sound-effect recipes. Every sound is just *data*: a list of layers
 * (oscillator tones and filtered-noise bursts) for `playLayers` to play.
 *
 * Reading a layer:  tone({ wave: "pulse25", freq: "G5", to: "G6", at: 0.05, dur: 0.12, vol: 0.12 })
 *   = a 25 % pulse wave starting at G5, sliding up to G6, 0.05 s after the
 *     trigger, lasting 0.12 s, peaking at gain 0.12.
 *
 * Volumes are deliberately small (0.05–0.4): sounds overlap, and the master
 * compressor (see core.ts) only has to catch the rare pile-up.
 * `Record<SfxName, …>` makes TypeScript complain if any SfxName lacks a recipe.
 */
import type { SfxName } from "@/game/bridge";
import type { Layer, NoiseSpec, Pitch, ToneSpec } from "./synth";

// ─────────────────────────── Helpers ────────────────────────────

const tone = (spec: ToneSpec): Layer => ({ kind: "tone", ...spec });
const noise = (spec: NoiseSpec): Layer => ({ kind: "noise", ...spec });

type NoteOptions = Omit<ToneSpec, "freq" | "at"> & { at?: number };

/** Notes played one after another, `step` seconds apart: chimes, jingles, fanfares. */
function arp(notes: Pitch[], o: NoteOptions & { step: number }): Layer[] {
  const { step, at = 0, ...rest } = o;
  return notes.map((freq, i) => tone({ ...rest, freq, at: at + i * step }));
}

/** Notes played together. */
function chord(notes: Pitch[], o: NoteOptions): Layer[] {
  return arp(notes, { ...o, step: 0 });
}

/**
 * `count` clicks that speed up and rise in pitch over `length` seconds, like a
 * prize wheel winding up. Click i happens at length·(1 − (1 − i/n)^1.8): the
 * gaps shrink as i grows, so the clicks accelerate.
 */
function rattle(count: number, length: number, fromHz: number, toHz: number): Layer[] {
  const layers: Layer[] = [];
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const at = length * (1 - Math.pow(1 - p, 1.8));
    const freq = fromHz * Math.pow(toHz / fromHz, p);
    layers.push(tone({ wave: "pulse25", freq, at, dur: 0.035, vol: 0.06 + 0.05 * p }));
    layers.push(noise({ filter: "highpass", freq: 4000, at, dur: 0.02, vol: 0.05 }));
  }
  return layers;
}

const SOFT = { type: "lowpass", freq: 1800 } as const;

// ─────────────────────────── Recipes ────────────────────────────

export const SFX: Record<SfxName, Layer[]> = {
  // ── Menus & dialogue ─────────────────────────────────────────
  /** Tiny tick when the cursor moves. */
  uiMove: [tone({ wave: "pulse25", freq: "E6", dur: 0.035, vol: 0.09 })],

  /** Cheerful two-note "bli-ip!" (a fifth up). */
  uiSelect: arp(["C6", "G6"], { wave: "pulse25", step: 0.06, dur: 0.09, vol: 0.12 }),

  /** Falling blip. */
  uiBack: [tone({ wave: "pulse25", freq: "G5", to: "C5", dur: 0.11, vol: 0.12 })],

  /** Dialogue "blip" — plays every few letters, the caller varies the pitch. */
  talk: [tone({ wave: "square", freq: 587, dur: 0.045, vol: 0.1, filter: SOFT })],

  /** Gentle "nuh-uh": two low, slightly buzzy notes falling a major third. */
  error: [
    tone({ wave: "square", freq: "E4", dur: 0.1, hold: 0.05, vol: 0.13, vibrato: { rate: 28, depth: 30 }, filter: { type: "lowpass", freq: 900 } }),
    tone({ wave: "square", freq: "C4", at: 0.12, dur: 0.18, hold: 0.07, vol: 0.13, vibrato: { rate: 28, depth: 30 }, filter: { type: "lowpass", freq: 900 } }),
  ],

  // ── Moving around ────────────────────────────────────────────
  /** Very quiet soft tap: it plays on every footstep. */
  step: [
    noise({ filter: "lowpass", freq: 900, dur: 0.035, vol: 0.05 }),
    tone({ wave: "triangle", freq: 150, to: 90, dur: 0.03, vol: 0.05 }),
  ],

  /** Quick swish: band-passed noise sweeping downwards. */
  dash: [
    noise({ filter: "bandpass", freq: 2600, to: 900, q: 1.4, attack: 0.01, dur: 0.13, vol: 0.3 }),
    tone({ wave: "triangle", freq: 600, to: 300, dur: 0.1, vol: 0.06 }),
  ],

  /** Wooden creak (buzzy saw with fast wobble) then a thunk. */
  door: [
    tone({ wave: "sawtooth", freq: 170, to: 250, attack: 0.03, hold: 0.1, dur: 0.24, vol: 0.12, vibrato: { rate: 24, depth: 70 }, filter: { type: "bandpass", freq: 900, q: 2 } }),
    tone({ wave: "sine", freq: 130, to: 55, at: 0.22, dur: 0.16, vol: 0.3 }),
    noise({ filter: "lowpass", freq: 700, at: 0.22, dur: 0.09, vol: 0.2 }),
  ],

  /** Crunchy rustle for bushes, pots and crates: three quick noise crunches. */
  break: [
    noise({ filter: "bandpass", freq: 1800, q: 0.7, dur: 0.07, vol: 0.32 }),
    noise({ filter: "bandpass", freq: 1200, q: 0.9, at: 0.04, dur: 0.08, vol: 0.26 }),
    noise({ filter: "highpass", freq: 3500, at: 0.08, dur: 0.12, vol: 0.12 }),
    tone({ wave: "square", freq: 220, to: 90, dur: 0.06, vol: 0.08, filter: { type: "lowpass", freq: 1200 } }),
  ],

  // ── Combat ───────────────────────────────────────────────────
  /** Airy whoosh: noise whose band-pass sweeps upwards. */
  swing: [noise({ filter: "bandpass", freq: 700, to: 3200, q: 1.2, attack: 0.04, dur: 0.17, vol: 0.3 })],

  /** Plucky "pew": fast downward pitch slide. */
  shoot: [
    tone({ wave: "pulse25", freq: 1400, to: 380, dur: 0.12, vol: 0.12 }),
    tone({ wave: "triangle", freq: 700, to: 220, dur: 0.1, vol: 0.12 }),
  ],

  /** Ground slam: low sine "kick" + rumbling noise. */
  slam: [
    tone({ wave: "sine", freq: 160, to: 40, dur: 0.32, vol: 0.5 }),
    tone({ wave: "triangle", freq: 90, to: 45, dur: 0.25, vol: 0.25 }),
    noise({ filter: "lowpass", freq: 1400, to: 200, dur: 0.28, vol: 0.35 }),
  ],

  /** Punchy thwack: a falling thump + a short noise slap. */
  hit: [
    tone({ wave: "sine", freq: 200, to: 60, dur: 0.11, vol: 0.4 }),
    tone({ wave: "square", freq: 330, to: 110, dur: 0.08, vol: 0.1, filter: { type: "lowpass", freq: 2000 } }),
    noise({ filter: "bandpass", freq: 2200, q: 0.8, dur: 0.07, vol: 0.32 }),
  ],

  /** Critical hit: brighter thwack plus a two-note sparkle on top. */
  crit: [
    tone({ wave: "sine", freq: 240, to: 70, dur: 0.12, vol: 0.4 }),
    tone({ wave: "square", freq: 520, to: 160, dur: 0.08, vol: 0.1, filter: { type: "lowpass", freq: 3000 } }),
    noise({ filter: "highpass", freq: 2500, dur: 0.08, vol: 0.25 }),
    ...arp(["C7", "G7"], { wave: "triangle", at: 0.05, step: 0.05, dur: 0.13, vol: 0.12 }),
  ],

  /**
   * A monster is squashed — the most-heard reward sound, so it is short and sweet:
   * a bubbly "pop" (sine diving down), a chirp sliding up an octave, and a tiny twinkle.
   */
  squash: [
    tone({ wave: "sine", freq: 720, to: 180, dur: 0.07, vol: 0.32 }),
    noise({ filter: "bandpass", freq: 1600, q: 1, dur: 0.03, vol: 0.12 }),
    tone({ wave: "pulse25", freq: "G5", to: "G6", slide: 0.08, at: 0.045, dur: 0.12, vol: 0.11 }),
    tone({ wave: "triangle", freq: "D7", at: 0.13, dur: 0.16, vol: 0.12 }),
  ],

  /** Boss growl: detuned low saw + square, wobbling (vibrato) and muffled (low-pass). */
  bossRoar: [
    tone({ wave: "sawtooth", freq: 92, to: 62, attack: 0.08, hold: 0.4, dur: 1.0, vol: 0.32, vibrato: { rate: 9, depth: 70 }, filter: { type: "lowpass", freq: 650, q: 2 } }),
    tone({ wave: "square", freq: 46, to: 36, attack: 0.08, hold: 0.4, dur: 0.95, vol: 0.18, vibrato: { rate: 6.5, depth: 50 }, filter: { type: "lowpass", freq: 400 } }),
    noise({ filter: "lowpass", freq: 600, to: 250, attack: 0.1, hold: 0.3, dur: 0.85, vol: 0.2 }),
  ],

  /** Boss defeated: a puff, a run down, a run back up and a ringing high note. */
  bossDown: [
    noise({ filter: "lowpass", freq: 2000, to: 150, dur: 0.45, vol: 0.3 }),
    tone({ wave: "sine", freq: 180, to: 40, dur: 0.4, vol: 0.35 }),
    ...arp(["G5", "E5", "C5", "G4"], { wave: "pulse25", at: 0.05, step: 0.07, dur: 0.09, vol: 0.1 }),
    ...arp(["C5", "E5", "G5", "C6"], { wave: "pulse25", at: 0.36, step: 0.07, dur: 0.1, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "E6", at: 0.64, hold: 0.15, dur: 0.5, vol: 0.11, vibrato: { rate: 6, depth: 15, delay: 0.1 } }),
    tone({ wave: "triangle", freq: "C5", at: 0.64, hold: 0.15, dur: 0.5, vol: 0.18 }),
  ],

  /** Soft "oof" — a rounded triangle dropping an octave, no harsh noise. */
  hurt: [
    tone({ wave: "triangle", freq: 340, to: 170, dur: 0.17, vol: 0.32 }),
    tone({ wave: "square", freq: 230, to: 140, dur: 0.13, vol: 0.06, filter: { type: "lowpass", freq: 800 } }),
  ],

  /** Sad little slide down an octave, with a wobble. */
  faint: [
    tone({ wave: "pulse25", freq: "E5", to: "E4", attack: 0.02, hold: 0.1, dur: 0.6, vol: 0.1, vibrato: { rate: 6, depth: 30, delay: 0.1 } }),
    tone({ wave: "triangle", freq: "E4", to: "E3", attack: 0.02, hold: 0.1, dur: 0.6, vol: 0.18 }),
  ],

  // ── Pickups ──────────────────────────────────────────────────
  /**
   * Bright two-tone ding (A → E, a fifth). Callers raise `pitch` for combo
   * pickups (0.8×–2×), so it is kept short and not too sharp.
   */
  coin: [
    tone({ wave: "pulse25", freq: "A5", dur: 0.06, hold: 0.04, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "E6", at: 0.055, hold: 0.06, dur: 0.26, vol: 0.11 }),
    tone({ wave: "triangle", freq: "E6", at: 0.055, dur: 0.2, vol: 0.1 }),
  ],

  /** Warm rising arpeggio (C major), triangle with a whisper of square. */
  heart: [
    ...arp(["C5", "E5", "G5", "C6"], { wave: "triangle", step: 0.06, dur: 0.2, vol: 0.2 }),
    ...arp(["C5", "E5", "G5", "C6"], { wave: "square", step: 0.06, dur: 0.14, vol: 0.04, filter: { type: "lowpass", freq: 2500 } }),
  ],

  /** Creak + thunk of the lid, then a shimmering run of notes. */
  chestOpen: [
    tone({ wave: "sawtooth", freq: 160, to: 230, attack: 0.02, hold: 0.06, dur: 0.18, vol: 0.1, vibrato: { rate: 26, depth: 60 }, filter: { type: "bandpass", freq: 900, q: 2 } }),
    tone({ wave: "sine", freq: 150, to: 70, at: 0.15, dur: 0.1, vol: 0.3 }),
    ...arp(["C6", "E6", "G6", "B6", "D7"], { wave: "triangle", at: 0.2, step: 0.05, dur: 0.32, vol: 0.11 }),
    ...arp(["C6", "E6", "G6", "B6", "D7"], { wave: "pulse12", at: 0.2, step: 0.05, dur: 0.12, vol: 0.04 }),
    noise({ filter: "highpass", freq: 6000, at: 0.2, attack: 0.12, dur: 0.45, vol: 0.05 }),
  ],

  /** Equipping gear: click-clack with a little metallic ring. */
  equip: [
    tone({ wave: "square", freq: 1800, dur: 0.025, vol: 0.08 }),
    noise({ filter: "highpass", freq: 3000, dur: 0.02, vol: 0.14 }),
    tone({ wave: "square", freq: 1250, at: 0.07, dur: 0.03, vol: 0.08 }),
    noise({ filter: "highpass", freq: 2500, at: 0.07, dur: 0.025, vol: 0.14 }),
    tone({ wave: "triangle", freq: "G6", at: 0.07, dur: 0.15, vol: 0.06 }),
  ],

  // ── Wishing Well (gacha) ─────────────────────────────────────
  /** Coin plops into the well: a glint, a rising "bloop" and a splash. */
  splash: [
    tone({ wave: "triangle", freq: "E7", dur: 0.06, vol: 0.08 }),
    tone({ wave: "sine", freq: 350, to: 1100, at: 0.12, dur: 0.09, vol: 0.3 }),
    noise({ filter: "bandpass", freq: 1600, to: 500, q: 0.8, at: 0.13, attack: 0.02, dur: 0.28, vol: 0.2 }),
    tone({ wave: "sine", freq: 500, to: 1300, at: 0.26, dur: 0.06, vol: 0.12 }),
  ],

  /** ~1.2 s of anticipation: an accelerating, rising rattle over a swelling tone. */
  gachaSpin: [
    ...rattle(22, 1.1, 300, 1300),
    tone({ wave: "triangle", freq: 220, to: 880, attack: 0.9, dur: 1.2, vol: 0.12 }),
    noise({ filter: "bandpass", freq: 800, to: 4000, q: 1, attack: 1.0, dur: 1.2, vol: 0.06 }),
  ],

  /** Reveals escalate: 3 notes → 4 notes + ring → run + chord → run + big chord + twinkles. */
  revealCommon: [
    ...arp(["C5", "E5", "G5"], { wave: "pulse25", step: 0.08, dur: 0.12, vol: 0.11 }),
    tone({ wave: "triangle", freq: "C6", at: 0.24, hold: 0.05, dur: 0.3, vol: 0.18 }),
  ],

  revealRare: [
    ...arp(["C5", "E5", "G5", "C6"], { wave: "pulse25", step: 0.07, dur: 0.12, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "E6", at: 0.28, hold: 0.1, dur: 0.45, vol: 0.1, vibrato: { rate: 6, depth: 12, delay: 0.1 } }),
    tone({ wave: "triangle", freq: "C5", at: 0.28, hold: 0.1, dur: 0.45, vol: 0.18 }),
    ...arp(["G6", "C7"], { wave: "triangle", at: 0.36, step: 0.08, dur: 0.2, vol: 0.08 }),
  ],

  revealEpic: [
    ...arp(["G4", "C5", "E5", "G5", "C6"], { wave: "pulse25", step: 0.06, dur: 0.1, vol: 0.11 }),
    ...chord(["E5", "G5", "C6"], { wave: "pulse25", at: 0.32, hold: 0.25, dur: 0.75, vol: 0.06, vibrato: { rate: 5.5, depth: 12, delay: 0.15 } }),
    tone({ wave: "triangle", freq: "C4", at: 0.32, hold: 0.25, dur: 0.75, vol: 0.22 }),
    ...arp(["E6", "G6", "C7", "E7"], { wave: "triangle", at: 0.45, step: 0.07, dur: 0.25, vol: 0.08 }),
    noise({ filter: "highpass", freq: 5000, at: 0.32, attack: 0.1, dur: 0.6, vol: 0.05 }),
  ],

  /** The jackpot: a fast scale run, a crash, a big shimmering C-major chord and twinkles. */
  revealLegendary: [
    ...arp(["C5", "D5", "E5", "G5", "A5", "C6", "D6", "E6"], { wave: "pulse25", step: 0.045, dur: 0.09, vol: 0.1 }),
    noise({ filter: "lowpass", freq: 3000, at: 0.4, dur: 0.3, vol: 0.18 }),
    tone({ wave: "triangle", freq: "C3", at: 0.4, hold: 0.5, dur: 1.3, vol: 0.25 }),
    ...chord(["C5", "E5", "G5", "C6"], { wave: "pulse25", at: 0.4, hold: 0.45, dur: 1.2, vol: 0.05, vibrato: { rate: 5.5, depth: 15, delay: 0.2 } }),
    tone({ wave: "triangle", freq: "E6", at: 0.4, hold: 0.45, dur: 1.2, vol: 0.1 }),
    noise({ filter: "highpass", freq: 6000, at: 0.4, attack: 0.2, dur: 1.3, vol: 0.05 }),
    ...arp(["G6", "C7", "E7", "G6", "D7", "G7", "E7", "C7"], { wave: "triangle", at: 0.55, step: 0.13, dur: 0.2, vol: 0.07 }),
  ],

  // ── Big moments ──────────────────────────────────────────────
  /** A dungeon is cleansed: a slow-swelling sine chord, rising hiss and a sparkle run. */
  purify: [
    ...chord(["C5", "E5", "G5"], { wave: "sine", attack: 0.45, hold: 0.2, dur: 1.2, vol: 0.1, vibrato: { rate: 5, depth: 10 } }),
    tone({ wave: "triangle", freq: "C4", to: "C5", slide: 0.5, attack: 0.4, dur: 1.1, vol: 0.12 }),
    noise({ filter: "highpass", freq: 2500, to: 9000, attack: 0.55, dur: 1.15, vol: 0.06 }),
    ...arp(["C6", "E6", "G6", "C7", "E7"], { wave: "triangle", at: 0.45, step: 0.08, dur: 0.35, vol: 0.09 }),
  ],

  /** Rising C-major arpeggio landing on a held chord. */
  levelUp: [
    ...arp(["C5", "E5", "G5", "C6", "E6"], { wave: "pulse25", step: 0.075, dur: 0.12, vol: 0.11 }),
    ...chord(["G5", "C6", "E6"], { wave: "pulse25", at: 0.45, hold: 0.3, dur: 0.8, vol: 0.06, vibrato: { rate: 6, depth: 12, delay: 0.15 } }),
    tone({ wave: "triangle", freq: "C4", at: 0.45, hold: 0.3, dur: 0.8, vol: 0.22 }),
    ...arp(["G6", "C7"], { wave: "triangle", at: 0.6, step: 0.1, dur: 0.25, vol: 0.07 }),
  ],

  /**
   * The ~2 s victory fanfare (C major): E–G–C up, a held C, then A–B leading
   * back to a long C with harmony, bass and three cymbal-ish noise hits.
   */
  victory: [
    // lead
    tone({ wave: "pulse25", freq: "E5", dur: 0.1, hold: 0.06, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "G5", at: 0.11, dur: 0.1, hold: 0.06, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "C6", at: 0.22, dur: 0.36, hold: 0.22, vol: 0.11, vibrato: { rate: 6, depth: 10, delay: 0.1 } }),
    tone({ wave: "pulse25", freq: "A5", at: 0.6, dur: 0.16, hold: 0.1, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "B5", at: 0.78, dur: 0.16, hold: 0.1, vol: 0.11 }),
    tone({ wave: "pulse25", freq: "C6", at: 0.96, dur: 0.85, hold: 0.45, vol: 0.11, vibrato: { rate: 6, depth: 14, delay: 0.15 } }),
    // harmony (a third / sixth below the lead)
    tone({ wave: "square", freq: "E5", at: 0.22, dur: 0.36, hold: 0.22, vol: 0.04, filter: SOFT }),
    tone({ wave: "square", freq: "F5", at: 0.6, dur: 0.16, hold: 0.1, vol: 0.04, filter: SOFT }),
    tone({ wave: "square", freq: "G5", at: 0.78, dur: 0.16, hold: 0.1, vol: 0.04, filter: SOFT }),
    ...chord(["E5", "G5"], { wave: "square", at: 0.96, dur: 0.85, hold: 0.45, vol: 0.035, filter: SOFT }),
    // bass: C … F G C
    tone({ wave: "triangle", freq: "C3", dur: 0.55, hold: 0.4, vol: 0.25 }),
    tone({ wave: "triangle", freq: "F3", at: 0.6, dur: 0.17, hold: 0.1, vol: 0.25 }),
    tone({ wave: "triangle", freq: "G3", at: 0.78, dur: 0.17, hold: 0.1, vol: 0.25 }),
    tone({ wave: "triangle", freq: "C3", at: 0.96, dur: 0.85, hold: 0.45, vol: 0.25 }),
    // cymbal-ish hits
    noise({ filter: "highpass", freq: 5000, dur: 0.25, vol: 0.07 }),
    noise({ filter: "highpass", freq: 5000, at: 0.22, dur: 0.25, vol: 0.06 }),
    noise({ filter: "highpass", freq: 4000, at: 0.96, dur: 0.6, vol: 0.08 }),
  ],

  // ── Silly & mini-game ────────────────────────────────────────
  /** Rubber duck: nasal saw through a narrow band-pass, wobbling and dropping. */
  quack: [
    tone({ wave: "sawtooth", freq: 560, to: 380, attack: 0.01, hold: 0.06, dur: 0.17, vol: 0.3, vibrato: { rate: 35, depth: 60 }, filter: { type: "bandpass", freq: 1100, q: 4 } }),
    tone({ wave: "square", freq: 280, to: 190, attack: 0.01, hold: 0.05, dur: 0.15, vol: 0.06, filter: { type: "lowpass", freq: 900 } }),
  ],

  /** Snappy net-catch: a noise snap, an upward "pop" and a tiny confirm note. */
  catch: [
    noise({ filter: "bandpass", freq: 3200, q: 1.2, dur: 0.03, vol: 0.18 }),
    tone({ wave: "sine", freq: 500, to: 1400, dur: 0.07, vol: 0.2 }),
    tone({ wave: "pulse25", freq: "C6", at: 0.05, dur: 0.08, vol: 0.09 }),
  ],
};

/** Every sound-effect name, in the order above (handy for the sound-test page). */
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
