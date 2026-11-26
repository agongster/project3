"use client";

/**
 * An item's icon in a square tile framed in its rarity colour. Items not
 * found yet show as a dark silhouette with a "?" (a collection teaser), and
 * equipped items get a little "E" tag.
 */
import type { CSSProperties } from "react";
import type { ItemDef } from "@/lib/game/catalog";
import { cx } from "@/components/ui/kit";
import { PixelSprite } from "./PixelSprite";
import { itemSprite } from "./sprites";

/** Item icons are 16 × 16 art pixels. */
const ICON_PX = 16;
/** Space between the icon and the frame, in screen pixels (normal / tight). */
const TILE_PADDING = 6;
const TIGHT_PADDING = 2;

interface ItemIconProps {
  item: ItemDef;
  /** Zoom of the 16 px icon. */
  scale?: number;
  /** False shows a mystery silhouette. */
  found?: boolean;
  equipped?: boolean;
  /** Less padding around the icon (small summary rows). */
  tight?: boolean;
  className?: string;
}

export function ItemIcon({ item, scale = 3, found = true, equipped, tight, className }: ItemIconProps) {
  const size = ICON_PX * scale + (tight ? TIGHT_PADDING : TILE_PADDING) * 2;
  const tileStyle: CSSProperties = found
    ? { width: size, height: size, background: "color-mix(in srgb, var(--rarity) 28%, var(--color-cream))" }
    : { width: size, height: size, background: "var(--color-night-soft)" };

  return (
    <span data-rarity={item.rarity} className={cx("rarity-ring relative inline-flex shrink-0 items-center justify-center", className)} style={tileStyle}>
      <PixelSprite sprite={itemSprite(item.id)} scale={scale} silhouette={!found} label={found ? item.name : "Not found yet"} />
      {!found && (
        <span aria-hidden="true" className="font-title absolute inset-0 flex items-center justify-center text-pixel-sm text-cream/80">
          ?
        </span>
      )}
      {equipped && (
        <span className="absolute -right-2 -top-2 bg-gold px-1 text-xs font-bold leading-4 text-ink shadow-[0_0_0_2px_var(--color-ink)]" title="Equipped">
          E
        </span>
      )}
    </span>
  );
}
