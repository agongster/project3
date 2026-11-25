/**
 * Item icons: one 16×16 picture for every item in the catalog (weapons,
 * charms, hats, pets, trails), used in the inventory, the shop of wishes
 * and loot pop-ups.
 *
 *   <img src={spriteToDataUrl(itemIcon("bugNet"), 4)} />
 *   drawSprite(ctx, itemIcon(id), cx, cy);   // anchor = centre (8, 8)
 *
 * Unknown ids get a "?" placeholder instead of throwing. The drawings live in
 * itemsGear.ts (weapons, charms) and itemsCosmetic.ts (hats, pets, trails).
 */
import { cached, Pix, type Sprite } from "./engine";
import { HAT_ICONS, PET_ICONS, trailIcon } from "./itemsCosmetic";
import { CHARM_ICONS, WEAPON_ICONS, type IconArt } from "./itemsGear";
import { outlined, placeCenter } from "./uiKit";

export const ICON_SIZE = 16;

const ICONS: Record<string, IconArt> = { ...WEAPON_ICONS, ...CHARM_ICONS, ...HAT_ICONS, ...PET_ICONS };

/** A rounded lilac tag with a "?" on it. */
const UNKNOWN: IconArt = {
  rows: [".hhhhhhhhh.", "hbbbbkkkbbs", "hbbbkbbbkbs", "hbbbbbbbkbs", "hbbbbbbkbbs", "hbbbbbkbbbs", "hbbbbbkbbbs", "hbbbbbbbbbs", "hbbbbbkbbbs", ".sssssssss."],
  pal: { h: "#e8dcff", b: "#c9b6f2", s: "#9a86c8" },
};

function paintIcon(id: string): Pix {
  const trail = trailIcon(id);
  if (trail) return trail;
  const art = ICONS[id] ?? UNKNOWN;
  return placeCenter(outlined(art.rows, art.pal, { after: art.after, line: art.line }), ICON_SIZE, ICON_SIZE);
}

const store = new Map<string, Sprite>();

/** The icon for an item id, anchored at its centre. Cached. */
export function itemIcon(id: string): Sprite {
  return cached(store, id, () => paintIcon(id).toSprite(ICON_SIZE / 2, ICON_SIZE / 2));
}
