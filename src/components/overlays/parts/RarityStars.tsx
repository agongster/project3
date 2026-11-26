"use client";

/** "Epic ★★★": the rarity name in its colour plus one star sprite per rarity level. */
import { RARITY_INFO } from "@/lib/game/catalog";
import type { Rarity } from "@/lib/types";
import { cx } from "@/components/ui/kit";
import { PixelSprite } from "./PixelSprite";
import { uiIcon } from "./sprites";

interface RarityStarsProps {
  rarity: Rarity;
  /** Zoom of the star sprites. */
  scale?: number;
  /** Hide the rarity word and show only the stars. */
  starsOnly?: boolean;
  className?: string;
}

export function RarityStars({ rarity, scale = 2, starsOnly, className }: RarityStarsProps) {
  const info = RARITY_INFO[rarity];
  return (
    <span data-rarity={rarity} className={cx("inline-flex items-center gap-1", className)} aria-label={`${info.label}, ${info.stars} stars`}>
      {!starsOnly && <span className="rarity-text bg-ink px-1 font-extrabold uppercase tracking-wide">{info.label}</span>}
      <span className="inline-flex gap-px" aria-hidden="true">
        {Array.from({ length: info.stars }, (_, index) => (
          <PixelSprite key={index} sprite={uiIcon("star")} scale={scale} />
        ))}
      </span>
    </span>
  );
}
