/**
 * The running game: owns the sim, the effects, input and the
 * requestAnimationFrame loop. Plain TypeScript (no React), so the component
 * only has to start it in an effect and stop it on unmount:
 *
 *   const stop = runBugCatch(canvas, () => latestProps);
 *   ...
 *   stop();
 *
 * FIXED TIMESTEP: the screen may refresh at 60, 120 or 144 Hz, but the rules
 * always advance in steps of exactly STEP_SECONDS. Real elapsed time is
 * collected in an "accumulator" and spent one fixed step at a time, so the
 * game plays the same on every monitor.
 */
import type { AudioApi } from "@/game/bridge";
import { getTheme } from "@/lib/game/catalog";
import type { CharacterLook, ThemeId } from "@/lib/types";
import { createAmbient, updateAmbient, type Ambient } from "./ambient";
import { drawScene } from "./draw";
import { createEffects, effectsForEvent, updateEffects } from "./effects";
import { listenForInput } from "./input";
import { createSim, stepSim, type SimState } from "./sim";
import { createSoundPlayer } from "./sounds";
import { STEP_SECONDS } from "./tuning";

/** The props the loop reads every frame (they may change while it runs). */
export interface LoopProps {
  audio: AudioApi;
  look: CharacterLook;
  hatId: string | null;
  theme: ThemeId;
  paused?: boolean;
  onScore?: (score: number) => void;
}

/** A long hitch (tab switch, debugger) is capped to this, so the game never "fast-forwards". */
const MAX_FRAME_SECONDS = 0.1;

declare global {
  interface Window {
    /** Development only: the live sim state, for scripted checks and the browser console. */
    __bugCatch?: SimState;
  }
}

/** Starts a fresh game on `canvas`. Returns a function that stops it and removes every listener. */
export function runBugCatch(canvas: HTMLCanvasElement, readProps: () => LoopProps): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  // Every loading screen is a new little game, so a random seed is fine here.
  const seed = Math.floor(Math.random() * 2 ** 31);
  const sim = createSim(seed);
  const fx = createEffects(seed + 1);
  let ambient: Ambient = createAmbient(getTheme(readProps().theme).ambient, seed + 2);
  const sounds = createSoundPlayer(() => readProps().audio);
  const input = listenForInput(canvas, { onFirstGesture: () => readProps().audio.unlock() });
  if (process.env.NODE_ENV !== "production") window.__bugCatch = sim;

  let lastScore = 0;
  let accumulator = 0;
  let lastFrameAt = performance.now();
  let rafId = 0;

  /** One fixed step of the rules plus everything that reacts to it. */
  const tick = (props: LoopProps): void => {
    const events = stepSim(sim, input.read(), STEP_SECONDS);
    for (const event of events) {
      sounds.play(event, sim.time);
      effectsForEvent(fx, event);
    }
    updateEffects(fx, STEP_SECONDS);
    updateAmbient(ambient, STEP_SECONDS);
    if (sim.score !== lastScore) {
      lastScore = sim.score;
      props.onScore?.(sim.score);
    }
  };

  let hasDrawn = false;

  const frame = (now: number): void => {
    rafId = requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME_SECONDS, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    const props = readProps();
    const frozen = props.paused || document.hidden;
    // Frozen: keep the last picture on screen (but draw once if we start paused).
    if (frozen && hasDrawn) return;

    const style = getTheme(props.theme).ambient;
    if (ambient.style !== style) ambient = createAmbient(style, seed + 2);

    if (!frozen) {
      accumulator += elapsed;
      while (accumulator >= STEP_SECONDS) {
        accumulator -= STEP_SECONDS;
        tick(props);
      }
    }
    drawScene(ctx, { sim, fx, ambient, theme: props.theme, look: props.look, hatId: props.hatId });
    hasDrawn = true;
  };

  // Key-ups are lost while the window is in the background: forget held keys.
  const releaseKeys = () => input.releaseAll();
  window.addEventListener("blur", releaseKeys);
  document.addEventListener("visibilitychange", releaseKeys);
  rafId = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(rafId);
    input.dispose();
    window.removeEventListener("blur", releaseKeys);
    document.removeEventListener("visibilitychange", releaseKeys);
    if (window.__bugCatch === sim) delete window.__bugCatch;
  };
}
