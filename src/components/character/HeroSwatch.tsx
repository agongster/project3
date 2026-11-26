"use client";

/**
 * A still picture of the hero wearing one option: the creator's swatches
 * and the preset portraits. The art module caches each picture, so a grid
 * of these costs a few small paints the first time and nothing after.
 */
import { characterSwatch, type Facing, type SwatchCrop } from "@/game/art";
import { SpriteView } from "@/components/ui/kit";
import type { CharacterLook } from "@/lib/types";

interface Props {
  look: CharacterLook;
  hatId: string | null;
  crop: SwatchCrop;
  facing?: Facing;
  /** Integer zoom. */
  scale: number;
}

export function HeroSwatch({ look, hatId, crop, facing = "down", scale }: Props) {
  // Sprites are painted on <canvas>, which only exists in the browser.
  const sprite = typeof document === "undefined" ? null : characterSwatch(look, hatId, facing, crop);
  return <SpriteView sprite={sprite} scale={scale} className="block" />;
}
