"use client";

/**
 * What the well gave: one big card for a single wish, or a 5 × 2 grid for
 * ten wishes whose cards turn face up one by one (`shown` = how many are
 * face up so far). Epic and legendary cards get rays and a flash.
 */
import type { WishResult } from "@/lib/game";
import { FX } from "../fx";
import { ItemCard } from "../ItemCard";
import { RarityFx } from "../RarityFx";
import { isBigRarity } from "./gachaData";

/** Same height for both faces of a grid card, so the grid doesn't jump while flipping. */
const GRID_CARD_HEIGHT = "h-[104px]";

interface WishResultsProps {
  results: readonly WishResult[];
  /** How many cards are face up (all of them once the reveal is done). */
  shown: number;
}

export function WishResults({ results, shown }: WishResultsProps) {
  if (results.length === 1) {
    const [only] = results;
    return (
      <div className="px-panel dark relative flex h-full items-center justify-center overflow-hidden">
        <RarityFx rarity={only.rarity} size={440} flash />
        <ItemCard item={only.item} isNew={only.isNew} refund={only.refund} className={`${FX.cardPop} relative`} />
      </div>
    );
  }

  return (
    <div className="px-panel dark flex h-full items-center justify-center overflow-hidden p-2">
      <ol className="grid grid-cols-5 gap-x-4 gap-y-2.5">
        {results.map((result, index) => (
          <li key={index} className={`relative ${GRID_CARD_HEIGHT}`}>
            {index < shown ? <FaceUp result={result} /> : <FaceDown />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FaceUp({ result }: { result: WishResult }) {
  const big = isBigRarity(result.rarity);
  return (
    <div className={`${FX.flip} relative h-full`}>
      {big && <RarityFx rarity={result.rarity} size={200} flash />}
      <ItemCard item={result.item} isNew={result.isNew} refund={result.refund} size="sm" className="relative" />
    </div>
  );
}

/** The back of a card: a purple tile with a question mark. */
function FaceDown() {
  return (
    <div
      aria-label="Not revealed yet"
      className={`flex w-[128px] ${GRID_CARD_HEIGHT} items-center justify-center bg-grape text-cream`}
      style={{
        boxShadow: "0 -4px 0 0 var(--color-ink), 0 4px 0 0 var(--color-ink), -4px 0 0 0 var(--color-ink), 4px 0 0 0 var(--color-ink), inset 0 0 0 6px #6a3fd1",
        backgroundImage: "radial-gradient(circle, rgb(255 255 255 / 0.18) 2px, transparent 3px)",
        backgroundSize: "16px 16px",
      }}
    >
      <span className="font-title text-pixel-md">?</span>
    </div>
  );
}
