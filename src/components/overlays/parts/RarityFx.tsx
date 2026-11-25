"use client";

/**
 * Celebration effects behind a revealed item, scaled to how rare it is:
 *
 *   every rarity   turning light rays + twinkling sparkles in its colour
 *   epic+          a flash of light when it appears
 *   legendary      a golden shimmer and falling stars over the whole screen
 */
import type { CSSProperties } from "react";
import type { Rarity } from "@/lib/types";
import { FX } from "./fx";
import { PixelSprite } from "./PixelSprite";
import { ScreenLayer } from "./ScreenLayer";
import { uiIcon } from "./sprites";

/** Where the sparkles sit around the item (percent of the box) and when each one twinkles. */
const SPARKLES = [
  { x: 8, y: 18, delay: "0s" },
  { x: 84, y: 10, delay: "0.4s" },
  { x: 92, y: 62, delay: "0.9s" },
  { x: 14, y: 78, delay: "1.2s" },
  { x: 50, y: 2, delay: "0.7s" },
  { x: 70, y: 88, delay: "0.2s" },
];

/** Falling stars for a legendary: horizontal position (vw %), start delay and fall time. */
const FALLING_STARS = [
  { x: 6, delay: "0s", duration: "2.6s" },
  { x: 18, delay: "1.1s", duration: "3.2s" },
  { x: 31, delay: "0.5s", duration: "2.8s" },
  { x: 44, delay: "1.7s", duration: "3.4s" },
  { x: 57, delay: "0.2s", duration: "2.9s" },
  { x: 69, delay: "1.4s", duration: "3.1s" },
  { x: 81, delay: "0.8s", duration: "2.7s" },
  { x: 93, delay: "1.9s", duration: "3.3s" },
];

const SPARKLE_SCALE = 3;
const STAR_SCALE = 3;

interface RarityFxProps {
  rarity: Rarity;
  /** Diameter of the ray disc in px. */
  size?: number;
  /** Play the one-time flash (on the moment of the reveal). */
  flash?: boolean;
}

/** Rays and sparkles centred on the parent (which must be `position: relative`). */
export function RarityFx({ rarity, size = 340, flash = false }: RarityFxProps) {
  const big = rarity === "epic" || rarity === "legendary";
  return (
    <span data-rarity={rarity} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className={FX.rays} style={{ "--rays-size": `${size}px` } as CSSProperties} />
      {flash && big && <span className={FX.burst} />}
      {SPARKLES.map((sparkle) => (
        <span
          key={`${sparkle.x}-${sparkle.y}`}
          className={FX.twinkle}
          style={{ left: `${sparkle.x}%`, top: `${sparkle.y}%`, "--delay": sparkle.delay } as CSSProperties}
        >
          <PixelSprite sprite={uiIcon("sparkle")} scale={SPARKLE_SCALE} />
        </span>
      ))}
      {rarity === "legendary" && <LegendaryFx />}
    </span>
  );
}

/** Screen-filling shimmer and starfall for a legendary. */
function LegendaryFx() {
  return (
    <ScreenLayer>
      <div className={FX.shimmer} />
      {FALLING_STARS.map((star) => (
        <span
          key={star.x}
          className={FX.starfall}
          style={{ left: `${star.x}%`, "--delay": star.delay, "--duration": star.duration } as CSSProperties}
        >
          <PixelSprite sprite={uiIcon("star")} scale={STAR_SCALE} />
        </span>
      ))}
    </ScreenLayer>
  );
}
