"use client";

/**
 * Stages 1–2 of a chest: the sealed chest wobbling in a glow that hints at
 * what's inside, then the burst of light as the lid flies open.
 */
import { useState } from "react";
import type { CSSProperties } from "react";
import { KeyCap } from "@/components/ui/kit";
import { RARITY_INFO } from "@/lib/game/catalog";
import type { Rarity } from "@/lib/types";
import { FX } from "../fx";
import { useTimeout } from "../hooks";
import { PixelSprite } from "../PixelSprite";
import { uiIcon } from "../sprites";

const CHEST_SCALE = 7;
/** How long the half-open frame shows before the lid is fully open. */
const LID_MS = 220;
/** Glow for a chest holding only coins. */
const COIN_GLOW = "var(--color-gold)";

interface ChestSealedProps {
  /** True once the player opened it (the burst is playing). */
  opening: boolean;
  /** Rarity of the item inside, or null for coins only; tints the hint glow. */
  rarity: Rarity | null;
  onOpen: () => void;
}

export function ChestSealed({ opening, rarity, onOpen }: ChestSealedProps) {
  const [lidOpen, setLidOpen] = useState(false);
  useTimeout(() => setLidOpen(true), LID_MS, opening);
  const sprite = uiIcon(!opening ? "chestClosed" : lidOpen ? "chestOpen" : "chestOpening");
  const glow = { "--fx-color": rarity ? RARITY_INFO[rarity].color : COIN_GLOW, "--glow-size": "260px" } as CSSProperties;

  return (
    <div className="px-panel dark flex h-full flex-col items-center justify-center gap-3 overflow-hidden">
      <button
        type="button"
        onClick={onOpen}
        disabled={opening}
        aria-label="Open the chest"
        className="relative flex h-40 w-48 cursor-pointer items-end justify-center pb-4 focus-visible:outline-3 focus-visible:outline-gold disabled:cursor-default"
      >
        <span className={FX.glow} style={glow} />
        {opening && <span className={FX.burst} style={glow} />}
        <PixelSprite sprite={sprite} scale={CHEST_SCALE} className={opening ? FX.hop : FX.wobble} />
      </button>
      <p className={opening ? "invisible" : "anim-bob font-bold text-cream"}>
        Press <KeyCap>Space</KeyCap> to open!
      </p>
    </div>
  );
}
