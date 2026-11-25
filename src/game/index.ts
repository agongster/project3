/**
 * Public entry point of the canvas game engine.
 * (Placeholder implementation — the real engine replaces this file.)
 */
import type { GameHandle, GameOptions } from "./bridge";

export function createGame(options: GameOptions): GameHandle {
  const ctx = options.canvas.getContext("2d");
  let raf = 0;
  const draw = () => {
    if (ctx) {
      ctx.fillStyle = "#3a7d44";
      ctx.fillRect(0, 0, options.canvas.width, options.canvas.height);
      ctx.fillStyle = "#fff";
      ctx.fillText(`engine placeholder — ${options.analysis.repo.repo}`, 10, 20);
    }
    raf = requestAnimationFrame(draw);
  };
  return {
    start: () => {
      raf = requestAnimationFrame(draw);
    },
    pause: () => {},
    resume: () => {},
    destroy: () => cancelAnimationFrame(raf),
    warp: () => {},
  };
}
