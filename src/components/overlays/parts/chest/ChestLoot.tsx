"use client";

/**
 * Stages 3–4 of a chest: the loot (item card or coin pouch, with rarity
 * rays, and the code a new item was forged in), the coins counting up, and
 * "Why this code earned it", the list
 * of the file's quality highlights with a sentence on why each matters.
 */
import type { CSSProperties } from "react";
import type { ChestLoot as Loot } from "@/lib/game";
import { EngravingTag } from "../EngravingTag";
import { FX } from "../fx";
import { ItemCard } from "../ItemCard";
import { PixelSprite } from "../PixelSprite";
import { RarityFx } from "../RarityFx";
import { uiIcon } from "../sprites";
import { HIGHLIGHT_LESSONS } from "./chestSetup";

const POUCH_SCALE = 5;
const COIN_SCALE = 3;
/** Golden rays behind a coins-only reward. */
const POUCH_RAYS = { "--fx-color": "var(--color-gold)", "--rays-size": "380px" } as CSSProperties;

interface ChestLootProps {
  loot: Loot;
  /** The coin counter's current value (counts up to loot.coins). */
  coins: number;
  /** Clean files explain their quality; dungeon chests list what you did. */
  clean: boolean;
}

export function ChestLoot({ loot, coins, clean }: ChestLootProps) {
  return (
    <div className="grid h-full grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4">
      <div className="px-panel dark relative flex items-center justify-center overflow-hidden">
        {loot.item && loot.rarity ? (
          <>
            <RarityFx rarity={loot.rarity} size={440} flash />
            <div className={`${FX.cardPop} relative flex flex-col items-center gap-2 px-3`}>
              <ItemCard item={loot.item} isNew={loot.isNew} refund={loot.refund} />
              {/* A new item is engraved with the code it came from (a duplicate turned into coins instead). */}
              {loot.isNew && loot.engraving && <EngravingTag engraving={loot.engraving} tone="dark" className="max-w-[260px]" />}
            </div>
          </>
        ) : (
          <div className={`${FX.cardPop} relative flex flex-col items-center gap-3`}>
            <span aria-hidden="true" className={FX.rays} style={POUCH_RAYS} />
            <PixelSprite sprite={uiIcon("coinBig")} scale={POUCH_SCALE} className="relative" label="A pouch of coins" />
            <p className="font-title relative text-xs text-cream">A pouch of coins!</p>
          </div>
        )}
      </div>

      <section className="flex min-h-0 flex-col gap-2">
        <p className="anim-pop flex items-center gap-2 self-start bg-ink px-3 py-1 text-gold shadow-[0_0_0_3px_var(--color-gold)]" aria-live="polite">
          <PixelSprite sprite={uiIcon("coin")} scale={COIN_SCALE} />
          <span className="font-title text-base tabular-nums">+{coins}</span>
          <span className="font-bold">coins</span>
        </p>
        <div className="anim-slide-up flex min-h-0 flex-col gap-2 [animation-delay:350ms]">
          <h3 className="font-title text-xs leading-normal">{clean ? "Why this code earned it" : "What you did"}</h3>
          <ul className="px-scroll flex min-h-0 flex-col gap-2 pr-1">
            {loot.reasons.map((reason) => (
              <li key={reason} className="flex gap-2 bg-leaf/20 p-2">
                <PixelSprite sprite={uiIcon("checkmark")} scale={2} className="mt-1" />
                <div>
                  <p className="font-bold leading-tight">{reason}</p>
                  {clean && HIGHLIGHT_LESSONS[reason] && <p className="text-sm leading-snug">{HIGHLIGHT_LESSONS[reason]}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
