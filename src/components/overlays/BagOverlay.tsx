"use client";

/**
 * The bag: equip gear and admire the collection.
 *
 *   tabs    one per item slot, with "found / total" counts
 *   left    the hero in their current look + loadout + derived stats
 *   middle  every catalog item of the slot; the ones not found yet as "?"
 *           silhouettes (a collection teaser)
 *   right   the selected item in detail, with Equip / Unequip
 *
 * Changes apply instantly: the game engine reads the save live.
 * Keys: arrows move around the grid, Left/Right on the tabs switch slot,
 * E (or picking the selected item again) equips / unequips.
 */
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/kit";
import { ALL_ITEMS, getItem } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import { equipItem, isEquipped, unequip } from "@/lib/game";
import { useStore } from "@/lib/game/useStore";
import type { ItemSlot, SaveData } from "@/lib/types";
import { HeroPanel } from "./parts/bag/HeroPanel";
import { ItemDetail } from "./parts/bag/ItemDetail";
import { ItemGrid } from "./parts/bag/ItemGrid";
import { useKeyDown } from "./parts/hooks";
import { SLOT_PLURAL, SLOTS } from "./parts/itemText";
import { PanelHeader } from "./parts/PanelHeader";
import { PANEL_LARGE } from "./parts/panelSizes";
import { Tabs } from "./parts/Tabs";
import type { OverlayProps } from "./types";

/** What to select when a tab opens: the worn item, else the first one found, else the first one. */
function defaultSelection(save: SaveData, slot: ItemSlot): string {
  const items = ALL_ITEMS.filter((item) => item.slot === slot);
  const worn = items.find((item) => isEquipped(save, item.id));
  const found = items.find((item) => save.owned.includes(item.id));
  return (worn ?? found ?? items[0]).id;
}

export default function BagOverlay({ ctx }: OverlayProps<"bag">) {
  const save = useStore(ctx.save, (state) => state);
  const [slot, setSlot] = useState<ItemSlot>("weapon");
  const [selectedId, setSelectedId] = useState(() => defaultSelection(ctx.save.get(), "weapon"));
  const owned = useMemo(() => new Set(save.owned), [save.owned]);

  const items = ALL_ITEMS.filter((item) => item.slot === slot);
  const selected = getItem(selectedId) ?? items[0];

  function changeTab(next: ItemSlot) {
    ctx.audio.sfx("uiMove");
    setSlot(next);
    setSelectedId(defaultSelection(save, next));
  }

  function select(item: ItemDef) {
    ctx.audio.sfx("uiMove");
    setSelectedId(item.id);
  }

  /** Equips the item, or takes it off if it is worn (the weapon can only be swapped, never removed). */
  function toggle(item: ItemDef) {
    if (!owned.has(item.id) || (item.slot === "weapon" && isEquipped(save, item.id))) {
      ctx.audio.sfx("error");
      return;
    }
    if (isEquipped(save, item.id)) {
      ctx.save.set((current) => unequip(current, item.slot, item.id));
      ctx.audio.sfx("uiBack");
    } else {
      ctx.save.set((current) => equipItem(current, item.id));
      ctx.audio.sfx("equip");
    }
  }

  useKeyDown((event) => {
    if (event.key === "e" || event.key === "E") toggle(selected);
  });

  const tabs = SLOTS.map((id) => {
    const inSlot = ALL_ITEMS.filter((item) => item.slot === id);
    const found = inSlot.filter((item) => owned.has(item.id)).length;
    return { id, label: `${SLOT_PLURAL[id]} ${found}/${inSlot.length}` };
  });

  return (
    <Modal label="Bag" onClose={ctx.close} className={PANEL_LARGE}>
      <PanelHeader title="Your Bag" subtitle="Gear up! Changes apply right away." onClose={ctx.close} />
      <Tabs label="Item slots" tabs={tabs} active={slot} onChange={changeTab} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(180px,1fr)_minmax(0,2fr)_minmax(216px,1fr)] gap-4">
        <HeroPanel save={save} />
        <div className="px-scroll min-h-0">
          <ItemGrid
            items={items}
            owned={owned}
            isWorn={(id) => isEquipped(save, id)}
            selectedId={selected.id}
            onSelect={select}
            onActivate={toggle}
          />
        </div>
        <div className="px-scroll min-h-0 bg-cream-deep/50 p-3">
          <ItemDetail
            item={selected}
            found={owned.has(selected.id)}
            worn={isEquipped(save, selected.id)}
            wornCharms={save.equipped.charms}
            onToggle={() => toggle(selected)}
          />
        </div>
      </div>
    </Modal>
  );
}
