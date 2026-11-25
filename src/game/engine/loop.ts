/**
 * The game loop: a fixed-timestep simulation driven by requestAnimationFrame.
 *
 * Why a FIXED step? If physics used the real frame time, a dash would cover a
 * slightly different distance on a 60 Hz laptop and a 144 Hz monitor, and a
 * long hiccup could teleport the hero through a wall. Instead we bank the
 * real elapsed time in an "accumulator" and spend it in exact 1/60 s slices,
 * calling `update(STEP_SEC)` once per slice. `render()` then runs once per
 * screen refresh and simply draws the latest state.
 *
 * While paused, `update` is not called at all (the world freezes) but
 * `render` keeps running, so the frozen frame still reacts to things such as
 * a theme change made in the wardrobe overlay.
 */

/** Length of one simulation step in seconds (60 updates per second). */
export const STEP_SEC = 1 / 60;

/**
 * A frame that took longer than this (tab was in the background, the
 * debugger paused the page...) only counts as this long, so the game never
 * tries to "catch up" with dozens of updates at once.
 */
const MAX_FRAME_SEC = 0.1;

export interface Loop {
  start(): void;
  stop(): void;
  /** Freeze/unfreeze the simulation. Rendering continues either way. */
  setPaused(paused: boolean): void;
  isPaused(): boolean;
}

export function createLoop(update: (dt: number) => void, render: () => void): Loop {
  let rafId = 0;
  let running = false;
  let paused = false;
  let lastTime = 0;
  let accumulator = 0;

  function frame(now: number): void {
    rafId = requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME_SEC, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (!paused) {
      accumulator += elapsed;
      while (accumulator >= STEP_SEC) {
        update(STEP_SEC);
        accumulator -= STEP_SEC;
      }
    }
    render();
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    setPaused(next) {
      paused = next;
      // Drop banked time so resuming never runs a burst of catch-up updates.
      accumulator = 0;
    },
    isPaused: () => paused,
  };
}
