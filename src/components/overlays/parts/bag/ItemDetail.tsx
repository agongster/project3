"use client";

/**
 * The bag's right column: the selected item up close with its stats in
 * plain words (and, for chest finds, the code it was forged in), and the
 * Equip / Unequip button with the slot's rules
 * explained (the weapon can only be swapped; charms have MAX_CHARMS slots).
 */
import { KeyCap, PixelButton } from "@/components/ui/kit";
import { MAX_CHARMS } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import type { Engraving } from "@/lib/types";
import { EngravingTag } from "../EngravingTag";
import { ItemIcon } from "../ItemIcon";
import { charmSwapText, itemStatLines, SLOT_LABEL } from "../itemText";
import { RarityStars } from "../RarityStars";
import { StatList } from "./StatList";

const DETAIL_ICON_SCALE = 4;

interface ItemDetailProps {
  item: ItemDef;
  found: boolean;
  worn: boolean;
  wornCharms: readonly string[];
  /** Where a chest item was found (none for starter and Wishing Well items). */
  engraving: Engraving | null;
  onToggle: () => void;
}

export function ItemDetail({ item, found, worn, wornCharms, engraving, onToggle }: ItemDetailProps) {
  if (!found) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <ItemIcon item={item} scale={DETAIL_ICON_SCALE} found={false} />
        <RarityStars rarity={item.rarity} />
        <h3 className="font-title text-pixel-sm">???</h3>
        <p className="text-sm">Not found yet. Open treasure chests or make a wish at the Wishing Well to find it!</p>
      </div>
    );
  }

  const isWeapon = item.slot === "weapon";
  const isCharm = item.slot === "charm";
  const swapNote = isCharm && !worn ? charmSwapText(wornCharms, item.id) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-center gap-1 text-center">
        <ItemIcon item={item} scale={DETAIL_ICON_SCALE} equipped={worn} />
        <RarityStars rarity={item.rarity} />
        <h3 className="text-lg font-extrabold leading-snug">{item.name}</h3>
        <p className="text-sm font-bold opacity-75">{SLOT_LABEL[item.slot]}</p>
        <p className="text-sm italic">{item.blurb}</p>
        {engraving && <EngravingTag engraving={engraving} tone="light" className="mt-1 w-full border-t-2 border-dashed border-ink/20 pt-1" />}
      </div>

      <StatList lines={itemStatLines(item)} />

      {isCharm && (
        <p className="text-sm">
          <strong>
            {wornCharms.length} / {MAX_CHARMS}
          </strong>{" "}
          charms equipped.{swapNote && ` ${swapNote}`}
        </p>
      )}
      {isWeapon && worn && <p className="text-sm">You always hold one weapon. Pick another one to swap.</p>}

      <PixelButton tone={worn ? "cream" : "leaf"} onClick={onToggle} disabled={isWeapon && worn} className="self-center">
        {worn ? (isWeapon ? "Equipped" : "Unequip") : "Equip"} {!(isWeapon && worn) && <KeyCap>E</KeyCap>}
      </PixelButton>
    </div>
  );
}
