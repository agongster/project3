"use client";

/**
 * The bestiary's collector shelf for one species: one small icon per colour
 * family (LOOK_FAMILIES in src/lib/game/monsterLooks.ts). Families met in
 * this save, in any repo, show in colour with their name; the others stay a
 * dim silhouette with a "?", waiting to be found.
 */
import { cx } from "@/components/ui/kit";
import { familyName, LOOK_FAMILIES, PLAIN_LOOK } from "@/lib/game/monsterLooks";
import type { MonsterKind } from "@/lib/types";
import { MonsterIcon } from "../MonsterIcon";

/** Big enough for a 32 px boss at 1× (smaller monsters get 2×). */
const SHELF_ICON_BOX = 32;

export function VariantShelf({ kind, met }: { kind: MonsterKind; met: ReadonlySet<number> }) {
  const families = LOOK_FAMILIES[kind];
  return (
    <div className="mt-1">
      <p className="text-xs font-bold">
        Variants met: {met.size} / {families.length}
      </p>
      <ul className="flex flex-wrap gap-1">
        {families.map((_, family) => {
          const seen = met.has(family);
          const name = seen ? familyName(kind, family) : "Not met yet";
          return (
            <li key={family} title={name} aria-label={name} className={cx("relative bg-cream/70", !seen && "opacity-60")}>
              <MonsterIcon kind={kind} box={SHELF_ICON_BOX} look={{ ...PLAIN_LOOK, family }} dim={!seen} />
              {!seen && <span className="absolute inset-0 flex items-center justify-center font-title text-pixel-sm text-ink">?</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
