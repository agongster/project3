/**
 * "Listening" without ears: render sounds into a buffer with an
 * OfflineAudioContext (runs faster than real time, plays nothing) and check
 * the samples — non-silent, never clipping, no NaNs, sensible lengths, and
 * music clearly quieter than sound effects.
 *
 * Everything goes through the real AudioCore mixer (compressor + clipper),
 * so what is measured here is what the player hears.
 */
import type { MusicTrack, SfxName } from "@/game/bridge";
import type { ThemeId } from "@/lib/types";
import { AudioCore, type SfxOptions } from "./core";
import { SFX_NAMES } from "./sfx";
import { MUSIC_TRACKS, SONGS } from "./songs";
import { compileSong } from "./sequencer";
import { THEME_TINTS } from "./themes";

const SAMPLE_RATE = 44100;

/**
 * Chrome's compressor starts "cold" (its automatic make-up gain ramps up over
 * ~0.2 s), which would make sounds at t = 0 measure too quiet. In the game the
 * mixer runs for minutes, so every test render starts its sounds at 0.3 s and
 * measures from there.
 */
const WARMUP = 0.3;

/** Longest acceptable length per sound effect (s); anything not listed must stay under 0.6 s. */
const MAX_SECONDS: Partial<Record<SfxName, number>> = {
  victory: 2.1,
  revealLegendary: 2.1,
  levelUp: 2.1,
  gachaSpin: 1.3,
  bossRoar: 1.3,
  bossDown: 1.3,
  purify: 1.3,
  revealRare: 1.3,
  revealEpic: 1.3,
  chestOpen: 1.3,
  faint: 1.3,
};
const DEFAULT_MAX_SECONDS = 0.6;

export interface BufferStats {
  /** Largest |sample|. Must stay below 1.0 (= digital clipping). */
  peak: number;
  /** Root-mean-square level of the sounding part — a rough "loudness". */
  rms: number;
  /** Seconds until the sound last rises above −60 dB. */
  seconds: number;
  hasNaN: boolean;
}

/** Measures a rendered buffer from `fromSeconds` onwards. */
export function measureBuffer(buf: AudioBuffer, fromSeconds = WARMUP, silence = 0.001): BufferStats {
  const data = buf.getChannelData(0).subarray(Math.floor(fromSeconds * buf.sampleRate));
  let peak = 0;
  let sumSquares = 0;
  let last = -1;
  let hasNaN = false;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    if (!Number.isFinite(x)) {
      hasNaN = true;
      continue;
    }
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sumSquares += x * x;
    if (a > silence) last = i;
  }
  const sounding = Math.max(1, last + 1);
  return { peak, rms: Math.sqrt(sumSquares / sounding), seconds: sounding / buf.sampleRate, hasNaN };
}

/** An offline context long enough for the warm-up plus `seconds` of sound. */
function offlineContext(seconds: number) {
  return new OfflineAudioContext(1, Math.ceil((WARMUP + seconds) * SAMPLE_RATE), SAMPLE_RATE);
}

/**
 * Renders `seconds` of audio after calling `play(core, t0)`, where t0 is the
 * time sounds should start at. Measure the result with `measureBuffer`.
 */
export async function renderWith(play: (core: AudioCore, t0: number) => void, seconds = 3): Promise<AudioBuffer> {
  const ctx = offlineContext(seconds);
  play(new AudioCore(ctx), WARMUP);
  return ctx.startRendering();
}

/** Renders one sound effect (pitch fixed at 1 so results repeat). */
export function renderSfx(name: SfxName, opts: SfxOptions = { pitch: 1 }, seconds = 3): Promise<AudioBuffer> {
  return renderWith((core, t0) => core.sfx(name, opts, t0), seconds);
}

/** Renders the first `seconds` of a music track in a theme. */
export function renderMusic(track: MusicTrack, seconds = 8, theme: ThemeId = "meadow"): Promise<AudioBuffer> {
  return renderWith((core, t0) => {
    core.setTheme(theme);
    core.music(track, t0);
    core.update(t0 + seconds); // offline there is no timer: book every note at once
  }, seconds);
}

/** Title for 2 s, then a cross-fade into the overworld theme (uses suspend/resume on the offline clock). */
async function renderCrossfade(seconds = 4): Promise<AudioBuffer> {
  const ctx = offlineContext(seconds);
  const core = new AudioCore(ctx);
  core.music("title", WARMUP);
  core.update(WARMUP + 2.2);
  ctx.suspend(WARMUP + 2).then(() => {
    core.music("overworld");
    core.update(WARMUP + seconds);
    ctx.resume();
  });
  return ctx.startRendering();
}

/**
 * Simulates a starved scheduler (e.g. a throttled background tab): notes are
 * booked up to 0.2 s, then the timer "sleeps" until 1.5 s. A correct sequencer
 * skips the steps it missed; a naive one would book them all at once (they
 * would play late, as a burst). Returns how many steps the late update booked.
 */
async function renderStarved(seconds = 3): Promise<{ buffer: AudioBuffer; bookedAfterGap: number }> {
  const ctx = offlineContext(seconds);
  const core = new AudioCore(ctx);
  let bookedAfterGap = 0;
  core.music("overworld", WARMUP);
  core.update(WARMUP + 0.2);
  ctx.suspend(WARMUP + 1.5).then(() => {
    bookedAfterGap = core.update(WARMUP + seconds);
    ctx.resume();
  });
  const buffer = await ctx.startRendering();
  return { buffer, bookedAfterGap };
}

export interface AudioReportRow {
  group: "sfx" | "music" | "theme" | "loop" | "stress";
  name: string;
  peak: number;
  rms: number;
  seconds: number;
  ok: boolean;
  note: string;
}

export interface AudioReport {
  allOk: boolean;
  rows: AudioReportRow[];
}

const round = (x: number) => Math.round(x * 1000) / 1000;

function row(group: AudioReportRow["group"], name: string, s: BufferStats, problems: string[], note = ""): AudioReportRow {
  if (s.hasNaN) problems.push("NaN samples");
  if (s.peak >= 1) problems.push("clips");
  return {
    group,
    name,
    peak: round(s.peak),
    rms: round(s.rms),
    seconds: round(s.seconds),
    ok: problems.length === 0,
    note: [...problems, note].filter(Boolean).join("; "),
  };
}

/**
 * Runs every check. Used by the sound-test page (window.__audioReport).
 * `fullLoops` also renders every song's complete form once (+3 s past the loop
 * point) — slower, but proves no section anywhere clips.
 */
export async function runAudioSelfTest(options: { fullLoops?: boolean } = {}): Promise<AudioReport> {
  const rows: AudioReportRow[] = [];

  // 1. Every sound effect on its own.
  const sfxPeaks: number[] = [];
  for (const name of SFX_NAMES) {
    const s = measureBuffer(await renderSfx(name));
    const limit = MAX_SECONDS[name] ?? DEFAULT_MAX_SECONDS;
    const problems: string[] = [];
    if (s.peak < 0.02) problems.push("silent");
    if (s.seconds > limit) problems.push(`longer than ${limit}s`);
    sfxPeaks.push(s.peak);
    rows.push(row("sfx", name, s, problems, `limit ${limit}s`));
  }
  const sortedPeaks = [...sfxPeaks].sort((a, b) => a - b);
  const medianSfxPeak = sortedPeaks[Math.floor(sortedPeaks.length / 2)];
  const musicCeiling = 0.35 * medianSfxPeak;

  // 2. Every music track (8 s, default theme). Song patterns are validated by compileSong.
  for (const track of MUSIC_TRACKS) {
    const problems: string[] = [];
    try {
      const steps = compileSong(SONGS[track]).steps.length;
      const s = measureBuffer(await renderMusic(track, 8));
      if (s.rms < 0.01) problems.push("silent");
      if (s.rms > musicCeiling) problems.push(`rms above ${round(musicCeiling)} (0.35 × median sfx peak)`);
      rows.push(row("music", track, s, problems, `${steps / 8} bars @ ${SONGS[track].bpm} bpm`));
    } catch (e) {
      rows.push({ group: "music", name: track, peak: 0, rms: 0, seconds: 0, ok: false, note: String(e) });
    }
  }

  if (options.fullLoops) {
    for (const track of MUSIC_TRACKS) {
      const song = SONGS[track];
      const loopSeconds = (compileSong(song).steps.length * 60) / song.bpm / 2;
      const s = measureBuffer(await renderMusic(track, loopSeconds + 3));
      rows.push(row("loop", track, s, s.rms > musicCeiling ? ["too loud"] : [], `whole form: ${round(loopSeconds)} s`));
    }
  }

  // 3. The most-heard track in every theme tint.
  for (const theme of Object.keys(THEME_TINTS) as ThemeId[]) {
    const s = measureBuffer(await renderMusic("overworld", 8, theme));
    const problems: string[] = [];
    if (s.rms < 0.01) problems.push("silent");
    if (s.rms > musicCeiling) problems.push("too loud");
    rows.push(row("theme", `overworld @ ${theme}`, s, problems));
  }

  // 4. Stress tests for the limits and the master limiter.
  const single = measureBuffer(await renderSfx("coin"));
  const burst = measureBuffer(await renderWith((core, t0) => {
    for (let i = 0; i < 30; i++) core.sfx("coin", { pitch: 1 }, t0);
  }));
  rows.push(row("stress", "30 coins in one frame", burst, Math.abs(burst.peak - single.peak) > 0.01 ? ["retrigger limit failed"] : [], "should equal one coin"));

  const combo = measureBuffer(await renderWith((core, t0) => {
    for (let i = 0; i < 12; i++) core.sfx("coin", { pitch: 0.8 + (1.2 * i) / 11 }, t0 + i * 0.07);
  }));
  rows.push(row("stress", "coin combo 0.8×→2×", combo, combo.peak < 0.02 ? ["silent"] : [], "12 coins, 70 ms apart"));

  for (const pitch of [0.8, 2]) {
    rows.push(row("stress", `coin @ ${pitch}×`, measureBuffer(await renderSfx("coin", { pitch })), []));
  }

  const storm = measureBuffer(await renderWith((core, t0) => {
    for (const name of SFX_NAMES) core.sfx(name, { pitch: 1, volume: 1 }, t0);
  }));
  rows.push(row("stress", "every sfx at once", storm, [], "compressor + soft clipper"));

  const loud = measureBuffer(await renderWith((core, t0) => {
    core.music("boss", t0);
    core.update(t0 + 3);
    for (let i = 0; i < 10; i++) {
      core.sfx("slam", { pitch: 1 }, t0 + i * 0.2);
      core.sfx("hit", { pitch: 1 }, t0 + i * 0.2 + 0.05);
    }
  }));
  rows.push(row("stress", "boss music + 20 hits", loud, []));

  rows.push(row("stress", "cross-fade title→overworld", measureBuffer(await renderCrossfade()), []));

  // After the gap only the steps from 1.5 s to 3 s should be booked (overworld: 8th = 0.268 s → ~6).
  const { buffer, bookedAfterGap } = await renderStarved(3);
  const expected = Math.ceil(1.5 / (60 / SONGS.overworld.bpm / 2));
  rows.push(
    row("stress", "scheduler starved 1.3 s", measureBuffer(buffer, WARMUP + 1.5), bookedAfterGap > expected + 1 ? ["missed notes piled up"] : [], `booked ${bookedAfterGap} steps after the gap (expected ≤ ${expected + 1})`),
  );

  return { allOk: rows.every((r) => r.ok), rows };
}
