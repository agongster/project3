"use client";

/**
 * The Wishing Well itself: the well sprite on a starry stage with twinkling
 * sparkles. While a wish is being made a coin arcs into the water, then the
 * well glows (in the colour of the best item coming) and rumbles.
 */
import type { CSSProperties } from "react";
import { RARITY_INFO } from "@/lib/game/catalog";
import type { Rarity, ThemeId } from "@/lib/types";
import { cx } from "@/components/ui/kit";
import { FX } from "../fx";
import { useTicker } from "../hooks";
import { PixelSprite } from "../PixelSprite";
import { uiIcon, wellSprite } from "../sprites";

const WELL_SCALE = 5;
const WATER_FRAME_MS = 180;
const SPARKLE_SCALE = 3;
const COIN_SCALE = 4;
/** Soft magic glow while the well is idle. */
const IDLE_GLOW = "#7ff0ff";

/** Sparkles around the well: position (percent of the stage) and twinkle delay. */
const SPARKLES = [
  { x: 18, y: 20, delay: "0s" },
  { x: 76, y: 14, delay: "0.5s" },
  { x: 84, y: 58, delay: "1.1s" },
  { x: 12, y: 64, delay: "0.8s" },
  { x: 46, y: 8, delay: "1.4s" },
  { x: 64, y: 80, delay: "0.3s" },
];

export type WellMood = "idle" | "tossing" | "spinning";

interface WellSceneProps {
  theme: ThemeId;
  mood: WellMood;
  /** While spinning: the best rarity in the pull (tints the glow, a little hint of what's coming). */
  glowRarity: Rarity | null;
}

export function WellScene({ theme, mood, glowRarity }: WellSceneProps) {
  const frame = useTicker(WATER_FRAME_MS);
  const spinning = mood === "spinning";
  const glow = {
    "--fx-color": spinning && glowRarity ? RARITY_INFO[glowRarity].color : IDLE_GLOW,
    "--glow-size": spinning ? "340px" : "240px",
    "--rays-size": "520px",
  } as CSSProperties;

  return (
    <div className="px-panel dark relative flex h-full items-end justify-center overflow-hidden pb-4">
      <span className={FX.glow} style={glow} />
      {spinning && <span className={FX.rays} style={glow} />}
      {SPARKLES.map((sparkle) => (
        <span key={sparkle.x} className={FX.twinkle} style={{ left: `${sparkle.x}%`, top: `${sparkle.y}%`, "--delay": sparkle.delay } as CSSProperties}>
          <PixelSprite sprite={uiIcon("sparkle")} scale={SPARKLE_SCALE} />
        </span>
      ))}
      <div className={cx("relative", spinning && FX.rumble)}>
        <PixelSprite sprite={wellSprite(theme, frame)} scale={WELL_SCALE} label="The Wishing Well" />
        {mood === "tossing" && (
          <span className={FX.coinArc}>
            <PixelSprite sprite={uiIcon("coin")} scale={COIN_SCALE} />
          </span>
        )}
      </div>
    </div>
  );
}
