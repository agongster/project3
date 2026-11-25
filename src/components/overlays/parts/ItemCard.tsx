"use client";

/**
 * The reveal card for a won item (chests and the Wishing Well): icon, name,
 * rarity stars, slot, its key stat in words, the blurb, and either a
 * bouncing "NEW!" badge or the coins a duplicate turned into.
 *
 *   size "lg"  one big reveal (chest, single wish)
 *   size "sm"  a tile in the ten-wish grid: icon, stars, name, corner badges
 */
import type { ItemDef } from "@/lib/game/catalog";
import { cx } from "@/components/ui/kit";
import { FX } from "./fx";
import { ItemIcon } from "./ItemIcon";
import { itemHeadlineStat, SLOT_LABEL } from "./itemText";
import { RarityStars } from "./RarityStars";

interface ItemCardProps {
  item: ItemDef;
  isNew: boolean;
  /** Coins given back because it was a duplicate (0 when new). */
  refund: number;
  size?: "lg" | "sm";
  className?: string;
}

export function ItemCard({ item, isNew, refund, size = "lg", className }: ItemCardProps) {
  const small = size === "sm";
  return (
    <div
      data-rarity={item.rarity}
      className={cx(
        "rarity-ring relative flex flex-col items-center bg-cream text-center text-ink",
        small ? "h-[104px] w-[128px] gap-1 px-1 pt-2" : "w-[244px] gap-1 px-3 pb-3 pt-4",
        className,
      )}
    >
      {isNew && <NewBadge small={small} />}
      <ItemIcon item={item} scale={small ? 2 : 4} />
      <RarityStars rarity={item.rarity} scale={small ? 1 : 2} starsOnly={small} className="text-xs" />
      <h3 className={cx("leading-tight", small ? "line-clamp-2 text-xs font-bold" : "font-title text-xs leading-snug")}>{item.name}</h3>
      {!small && (
        <>
          <p className="text-xs font-bold">
            {SLOT_LABEL[item.slot]} · {itemHeadlineStat(item)}
          </p>
          <p className="text-xs italic opacity-80">{item.blurb}</p>
        </>
      )}
      {!isNew && <DuplicateNote refund={refund} small={small} />}
    </div>
  );
}

function NewBadge({ small }: { small: boolean }) {
  return (
    <span
      className={cx(
        FX.newBadge,
        "font-title absolute bg-berry text-cream shadow-[0_0_0_3px_var(--color-ink)]",
        small ? "-left-2 -top-2 px-1 py-0.5 text-[8px]" : "-left-3 -top-3 px-2 py-1 text-[10px]",
      )}
    >
      NEW!
    </span>
  );
}

/** What a duplicate turned into: a line on the big card, a corner tag on the small one. */
function DuplicateNote({ refund, small }: { refund: number; small: boolean }) {
  if (small) {
    return (
      <span title={`Already owned: +${refund} coins`} className="absolute -right-2 -top-2 bg-gold px-1 text-xs font-bold text-ink shadow-[0_0_0_2px_var(--color-ink)]">
        +{refund}
      </span>
    );
  }
  return <p className="bg-gold/40 px-2 text-xs font-bold">Already owned → +{refund} coins</p>;
}
