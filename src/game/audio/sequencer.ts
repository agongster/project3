/**
 * Step sequencer: turns a song written as text patterns into notes on the
 * audio clock.
 *
 * ── How a song is written (see songs.ts) ──────────────────────────────
 * Time is a grid of 8th-note "steps", 8 per bar (4/4 time). Patterns are
 * strings with one token per step; "|" separates bars and is ignored:
 *
 *   lead   "D5 . B4 . D5 . G5 - | - . E5 ..."   note names; "-" = keep holding, "." = rest
 *   chords "G | Em | C | Am D"                  one or more chords per bar
 *   arp    "1 3 5 3 8 5 3 5"                    chord degrees (1 = root, 3 = third, 5 = fifth,
 *   bass   "1 . 5 . 8 . 5 ."                     7 = seventh, 8 = octave, 10 = high third)
 *   drums  "K . H . S . H ."                    K kick, S snare, H hat ("KH" = both)
 *
 * The arp and bass are generated from the chords, so a song is mostly "a chord
 * progression + a hand-written melody". `compileSong` flattens the whole form
 * (e.g. A B A B with variations) into one array of steps; each step lists the
 * notes that *start* there and how many steps they last.
 *
 * ── How notes are timed (the look-ahead scheduler) ────────────────────
 * JavaScript timers (setInterval / setTimeout) are jittery: they can fire tens
 * of milliseconds late, and browsers slow them to once per second in a
 * background tab. The AudioContext clock (`ctx.currentTime`), on the other
 * hand, is sample-accurate. So we never *play* a note from a timer. Instead:
 *
 *   1. a cheap timer wakes up every ~25 ms (engine.ts),
 *   2. it asks the player to `scheduleUntil(currentTime + lookAhead)`,
 *   3. the player books every step whose start time falls inside that window
 *      on the audio clock (osc.start(exactTime)), then remembers where it stopped.
 *
 * As long as the timer wakes up again before the window runs out, playback is
 * perfectly steady. The look-ahead is 0.15 s normally and 1.5 s while the tab
 * is hidden (when timers only fire about once a second). If the timer was
 * starved for longer than that, the missed steps are skipped silently rather
 * than all played at once — notes never "pile up" after a pause. While the
 * AudioContext is suspended its clock stops, so nothing new gets booked.
 */
import { noteToMidi, pitchClass } from "./synth";
import { playBass, playDrum, playHarmony, playLead, type DrumName } from "./instruments";
import type { ThemeTint } from "./themes";

export const STEPS_PER_BAR = 8;

export type Voice = "lead" | "arp" | "bass" | "drums";

/** A block of bars, e.g. the A or B part of a tune. */
export interface Section {
  chords: string;
  lead: string;
  /** Override the song's default arp / bass / drum patterns for this section. */
  arp?: string;
  bass?: string;
  drums?: string;
}

/** One entry of a song's form: which section to play, with optional variations. */
export interface Part {
  section: string;
  /** Play the melody this many octaves up (+1) or down (−1). */
  leadOctave?: number;
  /** Voices that sit this part out. */
  mute?: Voice[];
  arp?: string;
  bass?: string;
  drums?: string;
}

export interface Song {
  title: string;
  /** Human-readable key, tempo and form — for the docs and the dev page. */
  about: string;
  /** Home note and mode (used by the pentatonic tint). */
  tonic: string;
  mode: "major" | "minor";
  bpm: number;
  /** Default 1-bar (or longer) patterns, repeated every bar. */
  arp: string;
  bass: string;
  drums: string;
  sections: Record<string, Section>;
  /** The order sections are played in; loops back to the start. */
  form: Part[];
}

interface NoteEvent {
  midi: number;
  /** Length in steps. */
  steps: number;
}

/** Everything that starts on one 8th-note step. */
export interface Step {
  lead?: NoteEvent;
  arp?: NoteEvent;
  bass?: NoteEvent;
  drums: DrumName[];
}

export interface CompiledSong {
  song: Song;
  steps: Step[];
}

// ─────────────────────────── Chords ─────────────────────────────

/** Semitones above the root for each chord quality ("" = major). */
const CHORD_QUALITIES: Record<string, number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

interface Chord {
  root: number; // pitch class 0–11
  tones: number[];
}

function parseChord(symbol: string): Chord {
  const m = /^([A-G][#b]?)(.*)$/.exec(symbol);
  const tones = m ? CHORD_QUALITIES[m[2]] : undefined;
  if (!m || !tones) throw new Error(`Unknown chord "${symbol}"`);
  return { root: pitchClass(m[1]), tones };
}

/** A chord degree from a pattern ("1", "3", "5", "7", "8", "10", "12") → semitones above the root. */
function degreeToSemitones(degree: string, chord: Chord): number {
  const [, third, fifth, seventh] = chord.tones;
  switch (degree) {
    case "1": return 0;
    case "3": return third;
    case "5": return fifth;
    case "7": return seventh ?? 12;
    case "8": return 12;
    case "10": return 12 + third;
    case "12": return 12 + fifth;
  }
  throw new Error(`Unknown chord degree "${degree}"`);
}

/** Lowest MIDI note ≥ `low` with the given pitch class — keeps each voice in its own register. */
function rootAtOrAbove(pc: number, low: number): number {
  return low + ((pc - (low % 12) + 12) % 12);
}

const BASS_LOW = 40; // E2: bass roots land in E2–D#3
const ARP_LOW = 53; // F3: arp roots land in F3–E4, below the melody
const LEAD_FLOOR = 55; // G3: a melody shifted lower than this (night tint + octave-down part) comes back up

// ────────────────────────── Compiling ───────────────────────────

const tokens = (pattern: string) => pattern.split(/\s+/).filter((t) => t !== "" && t !== "|");

const compiled = new Map<Song, CompiledSong>();

/** Flattens a song's form into one array of steps (cached). Throws on malformed patterns. */
export function compileSong(song: Song): CompiledSong {
  const cached = compiled.get(song);
  if (cached) return cached;

  const steps: Step[] = [];
  // The note each melodic voice is currently holding, so "-" can lengthen it.
  const holding: Record<"lead" | "arp" | "bass", NoteEvent | null> = { lead: null, arp: null, bass: null };

  for (const part of song.form) {
    const section = song.sections[part.section];
    if (!section) throw new Error(`${song.title}: no section "${part.section}"`);
    const where = `${song.title} / ${part.section}`;
    const muted = (v: Voice) => part.mute?.includes(v) ?? false;

    const bars = section.chords.split("|").map((bar) => tokens(bar).map(parseChord));
    const totalSteps = bars.length * STEPS_PER_BAR;
    const lead = tokens(section.lead);
    const arp = tokens(part.arp ?? section.arp ?? song.arp);
    const bass = tokens(part.bass ?? section.bass ?? song.bass);
    const drums = tokens(part.drums ?? section.drums ?? song.drums);
    if (lead.length !== totalSteps) throw new Error(`${where}: lead has ${lead.length} steps, chords need ${totalSteps}`);
    for (const [name, pattern] of [["arp", arp], ["bass", bass], ["drums", drums]] as const) {
      if (pattern.length === 0 || pattern.length % STEPS_PER_BAR !== 0) throw new Error(`${where}: ${name} pattern must be whole bars`);
    }

    /** Applies one token of a melodic voice to `step`. */
    const place = (step: Step, voice: "lead" | "arp" | "bass", token: string, toMidi: (t: string) => number) => {
      if (token === "-") {
        const held = holding[voice];
        if (held) held.steps++;
        return;
      }
      holding[voice] = null;
      if (token === ".") return;
      const note = { midi: toMidi(token), steps: 1 }; // parse even when muted, so typos are caught
      if (muted(voice)) return;
      step[voice] = note;
      holding[voice] = note;
    };

    for (let i = 0; i < totalSteps; i++) {
      const barChords = bars[Math.floor(i / STEPS_PER_BAR)];
      const chord = barChords[Math.floor(((i % STEPS_PER_BAR) * barChords.length) / STEPS_PER_BAR)];
      if (!chord) throw new Error(`${where}: empty bar`);
      const step: Step = { drums: [] };

      place(step, "lead", lead[i], (t) => noteToMidi(t) + 12 * (part.leadOctave ?? 0));
      place(step, "arp", arp[i % arp.length], (t) => rootAtOrAbove(chord.root, ARP_LOW) + degreeToSemitones(t, chord));
      place(step, "bass", bass[i % bass.length], (t) => rootAtOrAbove(chord.root, BASS_LOW) + degreeToSemitones(t, chord));

      const hit = drums[i % drums.length];
      if (hit !== "." && !muted("drums")) {
        for (const d of hit) {
          if (d !== "K" && d !== "S" && d !== "H") throw new Error(`${where}: unknown drum "${d}"`);
          step.drums.push(d);
        }
      }
      steps.push(step);
    }
  }

  const result = { song, steps };
  compiled.set(song, result);
  return result;
}

/**
 * Sakura tint: nudge the two scale notes that are not in the pentatonic scale
 * onto neighbours that are (major: 4th → 3rd, 7th → octave; minor: 2nd → ♭3rd,
 * 6th → 5th). Notes outside the scale are left alone.
 */
function toPentatonic(midi: number, tonic: number, mode: "major" | "minor"): number {
  const degree = (((midi - tonic) % 12) + 12) % 12;
  if (mode === "major") {
    if (degree === 5) return midi - 1;
    if (degree === 11) return midi + 1;
  } else {
    if (degree === 2) return midi + 1;
    if (degree === 8 || degree === 9) return midi - (degree - 7);
  }
  return midi;
}

// ─────────────────────────── Player ─────────────────────────────

/**
 * Plays one song in a loop on its own little mixer:
 *
 *   lead / arp / bass → low-pass ─┬──────────────────────────→ fade → out
 *                                 └→ echo delay ⇄ feedback → wet ─┘
 *   drums ───────────────────────────────────────────────────→ fade
 *
 * `fade` is what cross-fades one track into the next. Drums skip the low-pass
 * (it would muffle the hi-hat) and the echo (it would smear the beat).
 */
export class SongPlayer {
  private step = 0;
  private nextTime: number;
  private endTime = Infinity;
  private readonly fade: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly echo: DelayNode;
  private readonly echoFeedback: GainNode;
  private readonly echoWet: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly song: CompiledSong,
    out: AudioNode,
    private readonly getTint: () => ThemeTint,
    startTime: number,
  ) {
    this.nextTime = startTime;
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.value = 0.5;
    this.echo = ctx.createDelay(2);
    this.echoFeedback = ctx.createGain();
    this.echoFeedback.gain.value = 0.3;
    this.echoWet = ctx.createGain();

    this.filter.connect(this.fade);
    this.filter.connect(this.echo);
    this.echo.connect(this.echoFeedback).connect(this.echo);
    this.echo.connect(this.echoWet).connect(this.fade);
    this.fade.connect(out);
    this.applyTint(ctx.currentTime, true);
  }

  /** 8th-note length in seconds at the current tempo. */
  private stepSeconds(): number {
    return 60 / (this.song.song.bpm * this.getTint().tempo) / 2;
  }

  /** Re-reads the theme tint: glides the filter / echo (instantly when `immediate`). */
  applyTint(at: number, immediate = false) {
    const tint = this.getTint();
    const set = (param: AudioParam, value: number) => {
      if (immediate) param.setValueAtTime(value, at);
      else param.setTargetAtTime(value, at, 0.25);
    };
    set(this.filter.frequency, tint.cutoff);
    set(this.echoWet.gain, tint.echo);
    // A dotted-8th echo (3 sixteenths) locks to the beat.
    set(this.echo.delayTime, Math.min(1.9, this.stepSeconds() * 1.5));
  }

  fadeIn(at: number, seconds: number) {
    this.fade.gain.setValueAtTime(0, at);
    this.fade.gain.linearRampToValueAtTime(1, at + seconds);
  }

  /** Fades to silence and stops booking notes after the fade. */
  fadeOut(at: number, seconds: number) {
    const g = this.fade.gain;
    const current = g.value;
    g.cancelScheduledValues(at);
    g.setValueAtTime(current, at);
    g.linearRampToValueAtTime(0, at + seconds);
    this.endTime = at + seconds;
  }

  /** True once the fade-out has finished (the core then calls `dispose`). */
  finished(now: number) {
    return now > this.endTime + 0.1;
  }

  dispose() {
    this.endTime = -Infinity;
    this.fade.disconnect();
    this.echo.disconnect();
    this.echoWet.disconnect();
    this.filter.disconnect();
  }

  /**
   * Books every step that starts before `until` (seconds on the audio clock).
   * Returns how many steps were booked (the self-test checks this).
   */
  scheduleUntil(until: number): number {
    const now = this.ctx.currentTime;
    // Fell behind (timer starved, computer slept)? Skip the missed steps silently,
    // keeping the beat grid, instead of firing them all at once.
    let skipped = 0;
    while (this.nextTime < now - 0.02) {
      if (++skipped > 10_000) {
        this.nextTime = now + 0.02; // a gap of many minutes: simply restart from "now"
        break;
      }
      this.advance();
    }

    let booked = 0;
    const limit = Math.min(until, this.endTime);
    while (this.nextTime < limit) {
      this.playStep(this.song.steps[this.step], this.nextTime);
      this.advance();
      booked++;
    }
    return booked;
  }

  private advance() {
    this.nextTime += this.stepSeconds();
    this.step = (this.step + 1) % this.song.steps.length;
  }

  private playStep(step: Step, time: number) {
    const tint = this.getTint();
    const stepLen = this.stepSeconds();
    // Swing: every off-beat 8th (odd step) lands a little late.
    const t = this.step % 2 === 1 ? time + tint.swing * stepLen : time;
    const { song } = this.song;

    if (step.lead) {
      let midi = step.lead.midi;
      if (tint.pentatonic) midi = toPentatonic(midi, pitchClass(song.tonic), song.mode);
      midi += tint.transpose + 12 * tint.leadOctave;
      while (midi < LEAD_FLOOR) midi += 12;
      playLead(this.ctx, this.filter, t, midi, step.lead.steps * stepLen, tint);
    }
    if (step.arp) playHarmony(this.ctx, this.filter, t, step.arp.midi + tint.transpose, step.arp.steps * stepLen);
    if (step.bass) playBass(this.ctx, this.filter, t, step.bass.midi + tint.transpose, step.bass.steps * stepLen);
    for (const d of step.drums) playDrum(this.ctx, this.fade, t, d);
  }
}
