/**
 * Lintlands audio — every sound is synthesized at runtime with the Web Audio
 * API (no audio files). Map of the module:
 *
 *   synth.ts        oscillators, noise, envelopes, note names → Hz
 *   sfx.ts          one recipe (list of synth layers) per sound effect
 *   instruments.ts  how the lead / harmony / bass / drums sound
 *   sequencer.ts    song format, compiler and the look-ahead step sequencer
 *   songs.ts        the six original loops, as text patterns
 *   themes.ts       per-theme music tints (tempo, wave, filter, swing …)
 *   core.ts         mixer + sfx limits + music cross-fades, for any audio context
 *   engine.ts       createAudio(): the live AudioApi (unlock, timer, tab visibility)
 *   selftest.ts     offline rendering + automatic checks for the sound-test page
 */
export { createAudio, WebAudioEngine } from "./engine";
export { AudioCore, CROSSFADE_SECONDS, type SfxOptions } from "./core";
export { SFX, SFX_NAMES } from "./sfx";
export { SONGS, MUSIC_TRACKS } from "./songs";
export { THEME_TINTS, type ThemeTint } from "./themes";
export { compileSong, type Song } from "./sequencer";
export { noteToFreq, noteToMidi, midiToFreq } from "./synth";
export {
  renderSfx,
  renderMusic,
  renderWith,
  measureBuffer,
  runAudioSelfTest,
  type AudioReport,
  type AudioReportRow,
  type BufferStats,
} from "./selftest";
