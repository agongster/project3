"use client";

/**
 * Every catalog item of one slot as a grid of tiles: found items in their
 * rarity frame ("E" when worn), the rest as mystery silhouettes. Arrow keys
 * move the selection; picking the already-selected item toggles equipping it.
 */
import type { KeyboardEvent } from "react";
import { RARITY_INFO } from "@/lib/game/catalog";
import type { ItemDef } from "@/lib/game/catalog";
import { cx } from "@/components/ui/kit";
import { ItemIcon } from "../ItemIcon";

const ICON_SCALE = 3;

/** How many columns the (auto-filling) grid currently shows, read from the browser's layout. */
function columnCount(grid: HTMLElement): number {
  return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
}

interface ItemGridProps {
  items: readonly ItemDef[];
  owned: ReadonlySet<string>;
  isWorn: (id: string) => boolean;
  selectedId: string | null;
  onSelect: (item: ItemDef) => void;
  /** Clicking (or pressing Enter on) the item that is already selected. */
  onActivate: (item: ItemDef) => void;
}

export function ItemGrid({ items, owned, isWorn, selectedId, onSelect, onActivate }: ItemGridProps) {
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const columns = columnCount(event.currentTarget);
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const step = moves[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = Math.max(0, items.findIndex((item) => item.id === selectedId));
    const next = items[Math.max(0, Math.min(items.length - 1, index + step))];
    onSelect(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-item="${next.id}"]`)?.focus();
  }

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,60px)] content-start gap-2.5 p-1" onKeyDown={onKeyDown}>
      {items.map((item) => {
        const found = owned.has(item.id);
        const selected = item.id === selectedId;
        const name = found ? item.name : `Unknown ${RARITY_INFO[item.rarity].label.toLowerCase()} item`;
        return (
          <li key={item.id}>
            <button
              type="button"
              data-item={item.id}
              aria-pressed={selected}
              aria-label={name}
              title={found ? item.name : `${RARITY_INFO[item.rarity].label} · Not found yet`}
              onClick={() => (selected ? onActivate(item) : onSelect(item))}
              className={cx(
                "block cursor-pointer outline-offset-4 transition-transform duration-75 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-gold",
                selected && "outline-3 outline-ink",
              )}
            >
              <ItemIcon item={item} scale={ICON_SCALE} found={found} equipped={found && isWorn(item.id)} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
