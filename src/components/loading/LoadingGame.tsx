"use client";

/**
 * "Bug Catch" — the loading-screen mini-game. While a repo downloads and is
 * linted, the player's own hero runs along the ground with a bug net,
 * catching friendly bugs that float down on parachutes and leaves.
 *
 * This component only owns the <canvas> and its size. The game itself lives
 * in ./bugCatch (rules in sim.ts, pictures in draw.ts, the loop in loop.ts).
 *
 * Sizing: the component fills its box. Give it a width (e.g. `w-full`) and it
 * keeps a 16:9 shape; give it a width and a height and the game is centred
 * inside. The 320×180 canvas is scaled up by the largest whole number that
 * fits, so every game pixel stays a crisp square.
 */
import { useEffect, useRef } from "react";
import { runBugCatch } from "./bugCatch/loop";
import { GAME_H, GAME_W } from "./bugCatch/tuning";
import type { LoadingGameProps } from "./types";

/** Largest whole-number zoom that fits the box; below 1× it shrinks smoothly instead. */
function fitScale(boxW: number, boxH: number): number {
  const exact = Math.min(boxW / GAME_W, boxH / GAME_H);
  return exact >= 1 ? Math.floor(exact) : exact;
}

export default function LoadingGame(props: LoadingGameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The loop reads the latest props through this ref, so it never has to restart.
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  // Keep the canvas at a crisp integer scale of its box.
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const resize = () => {
      const scale = fitScale(box.clientWidth, box.clientHeight);
      canvas.style.width = `${Math.round(GAME_W * scale)}px`;
      canvas.style.height = `${Math.round(GAME_H * scale)}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Run the game for as long as the component is mounted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return runBugCatch(canvas, () => propsRef.current);
  }, []);

  return (
    <div
      ref={boxRef}
      className={props.className}
      style={{ position: "relative", aspectRatio: `${GAME_W} / ${GAME_H}`, overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        width={GAME_W}
        height={GAME_H}
        aria-label="Bug Catch mini-game: move with the arrow keys, A and D, or the mouse"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          imageRendering: "pixelated",
          touchAction: "none",
        }}
      />
    </div>
  );
}
