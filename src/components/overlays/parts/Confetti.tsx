"use client";

/**
 * A burst of square pixel confetti over the whole screen for the victory
 * screen. Each piece falls once (no loop) and the whole layer removes
 * itself after CONFETTI_MS, so it never keeps animating in the background.
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { mulberry32 } from "@/lib/rng";
import { FX } from "./fx";
import { useTimeout } from "./hooks";
import { ScreenLayer } from "./ScreenLayer";

const PIECE_COUNT = 70;
/** Long enough for the slowest piece (max delay + max duration) to land. */
const CONFETTI_MS = 4200;
const COLORS = ["#ffc93c", "#ff8fab", "#7ec850", "#6ec6ff", "#c77dff", "#fff4d9", "#e5484d"];
/** Same seed every time: the layout is decorative, it doesn't need to differ. */
const SEED = 113;

interface Piece {
  left: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
  drift: string;
  turn: string;
}

/** Scatters the pieces across the top edge with varied sizes, speeds and spins. */
function makePieces(): Piece[] {
  const rng = mulberry32(SEED);
  return Array.from({ length: PIECE_COUNT }, () => ({
    left: `${Math.round(rng() * 100)}%`,
    size: rng() < 0.3 ? 8 : 4 + Math.floor(rng() * 2) * 2,
    color: COLORS[Math.floor(rng() * COLORS.length)],
    delay: `${(rng() * 1.2).toFixed(2)}s`,
    duration: `${(2 + rng() * 1.2).toFixed(2)}s`,
    drift: `${Math.round((rng() - 0.5) * 160)}px`,
    turn: `${Math.round(360 + rng() * 540)}deg`,
  }));
}

const PIECES = makePieces();

export function Confetti() {
  const [visible, setVisible] = useState(true);
  useTimeout(() => setVisible(false), CONFETTI_MS, visible);
  if (!visible) return null;

  return (
    <ScreenLayer>
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className={FX.confetti}
          style={
            {
              left: piece.left,
              width: piece.size,
              height: piece.size,
              background: piece.color,
              "--delay": piece.delay,
              "--duration": piece.duration,
              "--drift": piece.drift,
              "--turn": piece.turn,
            } as CSSProperties
          }
        />
      ))}
    </ScreenLayer>
  );
}
