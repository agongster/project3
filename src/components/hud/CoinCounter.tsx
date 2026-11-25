"use client";

/** Coin purse: a spinning coin and a total that counts up (or down) smoothly. */
import { uiSprite, UI_FRAMES } from "@/game/art/ui";
import { useTicker } from "@/components/character/useTicker";
import { useStore } from "@/lib/game/useStore";
import type { SaveData, Store } from "@/lib/types";
import { ArtSprite } from "./ArtSprite";
import { ap, TEXT_OUTLINE } from "./units";
import { useTweenedNumber } from "./useTweenedNumber";

/** The coin turns slowly, like the coins lying around in the world. */
const COIN_FRAME_MS = 160;

export function CoinCounter({ save }: { save: Store<SaveData> }) {
  const coins = useStore(save, (s) => s.coins);
  const shown = useTweenedNumber(coins);
  const frame = useTicker(COIN_FRAME_MS) % UI_FRAMES.coin;

  return (
    <div className="flex items-center font-bold text-gold" style={{ gap: ap(2), textShadow: TEXT_OUTLINE }}>
      <ArtSprite sprite={uiSprite("coin", frame)} />
      <span className="tabular-nums" aria-label={`${coins} coins`}>
        {shown}
      </span>
    </div>
  );
}
