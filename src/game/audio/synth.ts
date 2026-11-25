/**
 * Synth core — the few building blocks every sound in Lintlands is made of.
 *
 *   noteToFreq("A4")             → 440 Hz            (note names → frequencies)
 *   playTone(ctx, out, t, spec)  one oscillator with a volume envelope,
 *                                 optional pitch slide, vibrato and filter
 *   playNoise(ctx, out, t, spec) filtered white noise with the same envelope
 *   playLayers(ctx, out, t, ls)  plays a list of tone / noise "layers" = one sound
 *
 * Every function takes a `BaseAudioContext` plus a destination node, so the
 * exact same code can play live (AudioContext) or render silently into a
 * buffer (OfflineAudioContext — that is how the self-test "listens").
 *
 * Nothing here touches `window` at import time, so the module is safe to
 * import while Next.js renders on the server.
 */

/** Oscillator shapes. "pulse25"/"pulse12" are the thin, nasal NES-style pulse waves. */
export type Wave = "sine" | "triangle" | "square" | "sawtooth" | "pulse25" | "pulse12";

/** A pitch: either Hz or a note name such as "C4", "F#5" or "Bb3". */
export type Pitch = number | string;

// ───────────────────────────── Notes ─────────────────────────────

const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4" → 60, "A4" → 69 (MIDI note numbers: one number per piano key). */
export function noteToMidi(name: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note name "${name}"`);
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + LETTER_SEMITONE[m[1].toUpperCase()] + accidental;
}

/** Equal temperament: every semitone multiplies the frequency by 2^(1/12); A4 = 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteToFreq(name: string): number {
  return midiToFreq(noteToMidi(name));
}

export function toFreq(p: Pitch): number {
  return typeof p === "number" ? p : noteToFreq(p);
}

/** Pitch class of a note letter ("C" → 0 … "B" → 11), accepts "F#" / "Bb". */
export function pitchClass(name: string): number {
  const m = /^([A-Ga-g])([#b]?)$/.exec(name.trim());
  if (!m) throw new Error(`Bad pitch class "${name}"`);
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return (LETTER_SEMITONE[m[1].toUpperCase()] + accidental + 12) % 12;
}

// ───────────────────────── Wave shapes ───────────────────────────

/**
 * Web Audio only has a 50 % square. Narrower pulses (12.5 %, 25 %) are what give
 * chiptunes their bright, reedy colour, so we build them from their Fourier
 * series: a pulse of duty d has cosine terms sin(2πnd)/(πn) and sine terms
 * (1 − cos(2πnd))/(πn). We stop at 24 harmonics, which also keeps them soft.
 */
const HARMONICS = 24;
const waveCache = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let perCtx = waveCache.get(ctx);
  if (!perCtx) waveCache.set(ctx, (perCtx = new Map()));
  let wave = perCtx.get(duty);
  if (!wave) {
    const real = new Float32Array(HARMONICS + 1);
    const imag = new Float32Array(HARMONICS + 1);
    for (let n = 1; n <= HARMONICS; n++) {
      real[n] = Math.sin(2 * Math.PI * n * duty) / (Math.PI * n);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (Math.PI * n);
    }
    wave = ctx.createPeriodicWave(real, imag);
    perCtx.set(duty, wave);
  }
  return wave;
}

function setWave(ctx: BaseAudioContext, osc: OscillatorNode, wave: Wave) {
  if (wave === "pulse25") osc.setPeriodicWave(pulseWave(ctx, 0.25));
  else if (wave === "pulse12") osc.setPeriodicWave(pulseWave(ctx, 0.125));
  else osc.type = wave;
}

// ─────────────────────────── Noise ──────────────────────────────

/** One second of white noise per context, made once and looped. Seeded so offline renders repeat exactly. */
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 0x2f6b1d; // tiny linear-congruential generator
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = seed / 0x80000000 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return buf;
}

// ────────────────────────── Envelope ────────────────────────────

/** Gain we fade to; exponential ramps cannot reach exactly 0. ≈ −80 dB, inaudible. */
const SILENT = 0.0001;

export interface Envelope {
  /** Seconds from silence to full volume (default 5 ms — fast but click-free). */
  attack?: number;
  /** Seconds to stay at full volume before fading out (default 0 = percussive). */
  hold?: number;
}

/**
 * The envelope every sound uses:   ╱‾‾‾‾╲___
 *   0 → `vol` in `attack` s, stay for `hold` s, then an exponential fade
 *   that reaches silence exactly at `end`.
 */
function applyEnvelope(gain: AudioParam, t: number, end: number, vol: number, env: Envelope) {
  const attack = Math.max(0.001, env.attack ?? 0.005);
  const holdEnd = Math.min(t + attack + (env.hold ?? 0), end - 0.005);
  // Silent *before* t too: a GainNode starts at 1.0, and a source that starts
  // between two samples can leak one full-volume sample — an audible click.
  gain.value = 0;
  gain.setValueAtTime(0, t);
  gain.linearRampToValueAtTime(vol, t + attack);
  if (holdEnd > t + attack) gain.setValueAtTime(vol, holdEnd);
  gain.exponentialRampToValueAtTime(SILENT, Math.max(end, t + attack + 0.005));
}

// ─────────────────────────── Tones ──────────────────────────────

export interface ToneSpec extends Envelope {
  wave: Wave;
  freq: Pitch;
  /** Slide the pitch to this value (exponentially — sounds even across octaves). */
  to?: Pitch;
  /** How long the slide takes (default: the whole sound). */
  slide?: number;
  /** Start offset in seconds, relative to when the sound is triggered. */
  at?: number;
  /** Total length in seconds, including the fade-out. */
  dur: number;
  /** Peak gain, 0–1. Keep these small: many sounds can overlap. */
  vol: number;
  /** Pitch wobble: `rate` Hz, `depth` cents (100 cents = 1 semitone), fades in after `delay` s. */
  vibrato?: { rate: number; depth: number; delay?: number };
  /** Optional filter, e.g. a low-pass to soften a buzzy wave. */
  filter?: { type: BiquadFilterType; freq: number; q?: number };
}

/** Plays one oscillator note starting at time `t`. `pitchMul` scales every frequency. */
export function playTone(ctx: BaseAudioContext, out: AudioNode, t: number, spec: ToneSpec, pitchMul = 1) {
  const end = t + spec.dur;
  const osc = ctx.createOscillator();
  setWave(ctx, osc, spec.wave);

  const f0 = toFreq(spec.freq) * pitchMul;
  osc.frequency.setValueAtTime(f0, t);
  if (spec.to !== undefined) {
    const f1 = toFreq(spec.to) * pitchMul;
    osc.frequency.exponentialRampToValueAtTime(f1, t + Math.min(spec.slide ?? spec.dur, spec.dur));
  }

  if (spec.vibrato && spec.vibrato.depth > 0) {
    // A slow "LFO" oscillator wiggles the main oscillator's detune (in cents).
    const lfo = ctx.createOscillator();
    lfo.frequency.value = spec.vibrato.rate;
    const depth = ctx.createGain();
    const delay = spec.vibrato.delay ?? 0;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(spec.vibrato.depth, t + delay + 0.05);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(end + 0.02);
  }

  let last: AudioNode = osc;
  if (spec.filter) {
    const f = ctx.createBiquadFilter();
    f.type = spec.filter.type;
    f.frequency.value = Math.min(spec.filter.freq * pitchMul, ctx.sampleRate / 2 - 100);
    f.Q.value = spec.filter.q ?? 0.7;
    last = last.connect(f);
  }
  const amp = ctx.createGain();
  applyEnvelope(amp.gain, t, end, spec.vol, spec);
  last.connect(amp).connect(out);

  osc.start(t);
  osc.stop(end + 0.02);
  // Disconnect when finished so long sessions do not keep dead nodes attached.
  osc.onended = () => amp.disconnect();
}

// ─────────────────────────── Noise ──────────────────────────────

export interface NoiseSpec extends Envelope {
  /** Filter that shapes the noise: low-pass = thump/rumble, band-pass = whoosh, high-pass = hiss/hat. */
  filter: BiquadFilterType;
  freq: number;
  /** Sweep the filter to this frequency over the sound. */
  to?: number;
  q?: number;
  at?: number;
  dur: number;
  vol: number;
}

export function playNoise(ctx: BaseAudioContext, out: AudioNode, t: number, spec: NoiseSpec, pitchMul = 1) {
  const end = t + spec.dur;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const nyquist = ctx.sampleRate / 2 - 100;
  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 0.8;
  filter.frequency.setValueAtTime(Math.min(spec.freq * pitchMul, nyquist), t);
  if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.min(spec.to * pitchMul, nyquist), end);

  const amp = ctx.createGain();
  applyEnvelope(amp.gain, t, end, spec.vol, spec);
  src.connect(filter).connect(amp).connect(out);

  // Start somewhere random in the buffer so repeated hits are not identical.
  src.start(t, Math.random() * 0.9);
  src.stop(end + 0.02);
  src.onended = () => amp.disconnect();
}

// ─────────────────────────── Layers ─────────────────────────────

/** One ingredient of a sound effect / drum hit. A sound = a list of layers. */
export type Layer = ({ kind: "tone" } & ToneSpec) | ({ kind: "noise" } & NoiseSpec);

/** Length of a layered sound in seconds (when its last layer has faded out). */
export function layersDuration(layers: Layer[]): number {
  return layers.reduce((max, l) => Math.max(max, (l.at ?? 0) + l.dur), 0);
}

/**
 * Plays every layer, offset from `t` by its own `at`. `pitchMul` scales every
 * frequency, `volMul` every volume. Returns the time the sound ends.
 */
export function playLayers(ctx: BaseAudioContext, out: AudioNode, t: number, layers: Layer[], pitchMul = 1, volMul = 1): number {
  for (const layer of layers) {
    const start = t + (layer.at ?? 0);
    const vol = layer.vol * volMul;
    if (layer.kind === "tone") playTone(ctx, out, start, { ...layer, vol }, pitchMul);
    else playNoise(ctx, out, start, { ...layer, vol }, pitchMul);
  }
  return t + layersDuration(layers);
}
